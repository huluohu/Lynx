import { Router } from 'express';
import { getDb } from '../db/database.js';
import { fetchPrice } from '../services/price.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const log = createLogger('market');

// GET 所有资产实时价格 — 并行获取
router.get('/prices', async (req, res) => {
  const db = getDb();
  const assets = db.prepare('SELECT * FROM assets').all();

  // 分离: 有缓存的直接返回, 无缓存的并行请求
  const cachedResults = [];
  const toFetch = [];

  for (const a of assets) {
    const cached = db.prepare("SELECT * FROM price_cache WHERE asset_id = ? AND fetched_at > datetime('now', '-5 minutes') ORDER BY fetched_at DESC LIMIT 1").get(a.id);
    if (cached) {
      cachedResults.push({ asset_id: a.id, name: a.name, symbol: a.symbol, type: a.type, price: cached.price, currency: cached.currency, source: cached.source, cached: true });
    } else {
      toFetch.push(a);
    }
  }

  // 并行获取所有无缓存的行情
  const fetched = await Promise.allSettled(toFetch.map(a => fetchPrice(a)));
  const freshResults = toFetch.map((a, i) => {
    const result = fetched[i].status === 'fulfilled' ? fetched[i].value : null;
    if (result) {
      db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)').run(a.id, result.price, result.currency, result.source);
      return { asset_id: a.id, name: a.name, symbol: a.symbol, type: a.type, price: result.price, currency: result.currency, source: result.source, details: result.details, cached: false };
    }
    // 无实时数据 → 用旧缓存
    const old = db.prepare('SELECT * FROM price_cache WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 1').get(a.id);
    return { asset_id: a.id, name: a.name, symbol: a.symbol, type: a.type, price: old?.price || null, currency: old?.currency || null, source: old?.source || null, cached: true, stale: true };
  });

  const results = [...cachedResults, ...freshResults];
  log.info('Prices fetched', { total: assets.length, cached: cachedResults.length, fresh: freshResults.filter(r => !r.stale).length });
  res.json({ success: true, data: results });
});

// GET 单个
router.get('/prices/:assetId', async (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId);
  if (!asset) return res.status(404).json({ success: false, error: 'Not found' });

  const realtime = await fetchPrice(asset);
  if (realtime) {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)').run(asset.id, realtime.price, realtime.currency, realtime.source);
  }
  const price = realtime?.price;
  res.json({ success: true, data: { ...asset, price, currency: realtime?.currency, details: realtime?.details } });
});

export default router;
