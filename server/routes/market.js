import { Router } from 'express';
import { getDb } from '../db/database.js';
import { fetchPrice } from '../services/price.js';
import { createLogger } from '../utils/logger.js';
import { normalizeApiTimestamp } from '../utils/datetime.js';

const router = Router();
const log = createLogger('market');
const FRESH_CACHE_WINDOW_MS = 5 * 60 * 1000;

function buildCachedResult(asset, cachedRow, { stale = false, emptyCache = false } = {}) {
  return {
    asset_id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    type: asset.type,
    price: cachedRow?.price || null,
    currency: cachedRow?.currency || null,
    source: cachedRow?.source || asset.data_source || null,
    fetched_at: normalizeApiTimestamp(cachedRow?.fetched_at || null, { assumeUtcWhenNoTimezone: true }),
    cached: true,
    stale,
    empty_cache: emptyCache,
  };
}

// GET 所有资产价格
router.get('/prices', async (req, res) => {
  const db = getDb();
  const assets = db.prepare('SELECT * FROM assets').all();
  const force = req.query.force === '1';

  if (!force) {
    const results = assets.map((asset) => {
      const cached = db.prepare('SELECT * FROM price_cache WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 1').get(asset.id);
      if (!cached) {
        return buildCachedResult(asset, null, { stale: true, emptyCache: true });
      }

      const fetchedAt = new Date(cached.fetched_at).getTime();
      const stale = Number.isNaN(fetchedAt) ? true : (Date.now() - fetchedAt > FRESH_CACHE_WINDOW_MS);
      return buildCachedResult(asset, cached, { stale });
    });

    log.info('Prices served from cache', {
      total: assets.length,
      cached: results.filter((item) => item.fetched_at).length,
      empty: results.filter((item) => item.empty_cache).length,
    });

    res.json({ success: true, data: results });
    return;
  }

  const fetched = await Promise.allSettled(assets.map((asset) => fetchPrice(asset)));
  const freshResults = assets.map((asset, index) => {
    const result = fetched[index].status === 'fulfilled' ? fetched[index].value : null;
    if (result) {
      db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)')
        .run(asset.id, result.price, result.currency, result.source);
      const cached = db.prepare('SELECT * FROM price_cache WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 1').get(asset.id);
      return {
        asset_id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        type: asset.type,
        price: result.price,
        currency: result.currency,
        source: result.source,
        details: result.details,
        fetched_at: normalizeApiTimestamp(cached?.fetched_at || null, { assumeUtcWhenNoTimezone: true }),
        cached: false,
        stale: false,
        empty_cache: false,
      };
    }

    const old = db.prepare('SELECT * FROM price_cache WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 1').get(asset.id);
    return buildCachedResult(asset, old, { stale: true, emptyCache: !old });
  });

  log.info('Prices fetched', {
    total: assets.length,
    fresh: freshResults.filter((item) => !item.cached).length,
    fallback: freshResults.filter((item) => item.cached && !item.empty_cache).length,
    empty: freshResults.filter((item) => item.empty_cache).length,
  });

  res.json({ success: true, data: freshResults });
});

// GET 当前汇率
router.get('/rate', async (req, res) => {
  try {
    const { getUsdCny } = await import('../services/price.js');
    const rate = await getUsdCny();
    res.json({ success: true, data: { usd_cny: rate, updated: new Date().toISOString() } });
  } catch (e) {
    res.status(500).json({ success: false, error: '获取汇率失败' });
  }
});

// GET 单个
router.get('/prices/:assetId', async (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId);
  if (!asset) return res.status(404).json({ success: false, error: 'Not found' });

  const realtime = await fetchPrice(asset);
  if (realtime) {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)')
      .run(asset.id, realtime.price, realtime.currency, realtime.source);
  }
  const price = realtime?.price;
  res.json({ success: true, data: { ...asset, price, currency: realtime?.currency, details: realtime?.details } });
});

export default router;
