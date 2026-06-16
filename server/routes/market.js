import { Router } from 'express';
import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';
import { getCachedMarketSnapshot, getMarketSnapshot } from '../services/market-cache.js';

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

  const snapshot = await getMarketSnapshot(db, asset, { forceRefresh: true });
  res.json({ success: true, data: { ...asset, ...snapshot } });
});

export default router;
