import { Router } from 'express';
import { getDb } from '../db/database.js';
import { fetchPrice } from '../services/price.js';

const router = Router();

// GET 所有资产实时价格
router.get('/prices', async (req, res) => {
  const db = getDb();
  const assets = db.prepare('SELECT * FROM assets').all();
  const results = [];

  for (const a of assets) {
    let price = null;
    // 先查缓存（5分钟内）
    const cached = db.prepare("SELECT * FROM price_cache WHERE asset_id = ? AND fetched_at > datetime('now', '-5 minutes') ORDER BY fetched_at DESC LIMIT 1").get(a.id);
    if (cached) {
      results.push({ asset_id: a.id, name: a.name, symbol: a.symbol, type: a.type, price: cached.price, currency: cached.currency, source: cached.source, cached: true });
      continue;
    }

    // 查实时
    const realtime = await fetchPrice(a);
    if (realtime) {
      db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)').run(a.id, realtime.price, realtime.currency, realtime.source);
      results.push({ asset_id: a.id, name: a.name, symbol: a.symbol, type: a.type, price: realtime.price, currency: realtime.currency, source: realtime.source, details: realtime.details, cached: false });
    } else {
      // 用旧缓存
      const old = db.prepare('SELECT * FROM price_cache WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 1').get(a.id);
      results.push({ asset_id: a.id, name: a.name, symbol: a.symbol, type: a.type, price: old?.price || null, currency: old?.currency || null, source: old?.source || null, cached: true });
    }
  }

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
