import { Router } from 'express';
import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';
import { getCachedMarketSnapshot, getMarketSnapshot } from '../services/market-cache.js';
import { buildAssetPriceTrend } from '../services/trend.js';
import { normalizeSqliteUtcTimestamp } from '../utils/datetime.js';

const router = Router();
const log = createLogger('market');

// GET 所有资产价格
router.get('/prices', async (req, res) => {
  const db = getDb();
  const assets = db.prepare('SELECT * FROM assets').all();
  const force = req.query.force === '1';

  if (!force) {
    const results = assets.map((asset) => getCachedMarketSnapshot(db, asset));

    log.info('Prices served from cache', {
      total: assets.length,
      cached: results.filter((item) => item.fetched_at).length,
      empty: results.filter((item) => item.empty_cache).length,
    });

    res.json({ success: true, data: results });
    return;
  }

  const freshResults = await Promise.all(assets.map((asset) => getMarketSnapshot(db, asset, { forceRefresh: true })));

  log.info('Prices fetched', {
    total: assets.length,
    fresh: freshResults.filter((item) => !item.cached).length,
    fallback: freshResults.filter((item) => item.cached && item.cache_status !== 'missing').length,
    empty: freshResults.filter((item) => item.empty_cache).length,
  });

  res.json({ success: true, data: freshResults });
});

// POST 手工更新单个资产行情
router.post('/prices/:assetId/manual', (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId);
  if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ success: false, error: 'price must be greater than 0' });
  }

  const currency = String(req.body?.currency || asset.currency || 'CNY').trim().toUpperCase();
  const fetchedAt = req.body?.fetched_at
    ? normalizeSqliteUtcTimestamp(req.body.fetched_at, { assumeLocalWhenNoTimezone: true })
    : null;

  if (req.body?.fetched_at && !fetchedAt) {
    return res.status(400).json({ success: false, error: 'invalid fetched_at' });
  }

  if (fetchedAt && new Date(`${fetchedAt.replace(' ', 'T')}Z`).getTime() - Date.now() > 60 * 1000) {
    return res.status(400).json({ success: false, error: 'fetched_at cannot be in the future' });
  }

  if (fetchedAt) {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source, fetched_at) VALUES (?, ?, ?, ?, ?)')
      .run(asset.id, price, currency, 'manual', fetchedAt);
  } else {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)')
      .run(asset.id, price, currency, 'manual');
  }

  const snapshot = getCachedMarketSnapshot(db, asset);
  log.info('Manual price saved', { assetId: asset.id, price, currency });
  res.status(201).json({ success: true, data: snapshot });
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

// GET 单个资产价格趋势
router.get('/prices/:assetId/trend', (req, res) => {
  const db = getDb();
  const data = buildAssetPriceTrend(db, Number(req.params.assetId), req.query.range);
  if (!data) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data });
});

// GET 单个
router.get('/prices/:assetId', async (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId);
  if (!asset) return res.status(404).json({ success: false, error: 'Not found' });

  const forceRefresh = req.query.force === '1' || req.query.cache !== '1';
  const snapshot = await getMarketSnapshot(db, asset, { forceRefresh });
  res.json({ success: true, data: { ...asset, ...snapshot } });
});

export default router;
