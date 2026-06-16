import { Router } from 'express';
import { getDb } from '../db/database.js';
import { analyzeAllAssets, analyzeMarketSignals } from '../services/market-signal.js';
import { normalizeApiTimestampFields } from '../utils/datetime.js';

const router = Router();

function normalizeSignal(row) {
  if (!row) return null;
  let indicators = row.indicators;
  try { indicators = typeof indicators === 'string' ? JSON.parse(indicators) : indicators; } catch {}
  return normalizeApiTimestampFields({
    ...row,
    strength: row.strength == null ? null : Number(row.strength),
    indicators,
  }, ['created_at', 'valid_until'], { assumeUtcWhenNoTimezone: true });
}

function getLatestSignals(db, assetId = null) {
  const params = [];
  let sql = `SELECT ms.*, a.name AS asset_name, a.symbol, a.icon, a.type, a.currency
    FROM market_signals ms
    JOIN (
      SELECT asset_id, MAX(id) AS max_id
      FROM market_signals
      WHERE asset_id IS NOT NULL
      GROUP BY asset_id
    ) latest ON latest.max_id = ms.id
    LEFT JOIN assets a ON ms.asset_id = a.id`;

  if (assetId) {
    sql += ' WHERE ms.asset_id = ?';
    params.push(assetId);
  }

  sql += ' ORDER BY a.id ASC';
  return db.prepare(sql).all(...params).map(normalizeSignal);
}

router.get('/', (req, res) => {
  const db = getDb();
  const { asset_id, limit = 20 } = req.query;
  let sql = `SELECT ms.*, a.name AS asset_name, a.symbol, a.icon, a.type, a.currency
    FROM market_signals ms
    LEFT JOIN assets a ON ms.asset_id = a.id`;
  const params = [];
  if (asset_id) {
    sql += ' WHERE ms.asset_id = ?';
    params.push(asset_id);
  }
  sql += ' ORDER BY ms.created_at DESC, ms.id DESC LIMIT ?';
  params.push(Number(limit) || 20);
  const rows = db.prepare(sql).all(...params).map(normalizeSignal);
  res.json({ success: true, data: rows });
});

router.get('/latest', (req, res) => {
  const db = getDb();
  res.json({ success: true, data: getLatestSignals(db) });
});

router.post('/analyze', async (req, res) => {
  try {
    const db = getDb();
    const assetId = Number(req.body?.asset_id || 0);
    if (assetId) {
      await analyzeMarketSignals(assetId);
    } else {
      await analyzeAllAssets();
    }

    const data = getLatestSignals(db, assetId || null);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
