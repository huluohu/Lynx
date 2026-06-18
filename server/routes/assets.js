import { Router } from 'express';
import { getDb } from '../db/database.js';
import { buildAssetProfitTrend } from '../services/trend.js';

const router = Router();

// GET 全部资产
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT a.*, h.id as holding_id, h.quantity, h.avg_cost, h.total_invested
    FROM assets a LEFT JOIN holdings h ON a.id = h.asset_id AND h.status = 'active'
    ORDER BY a.id`).all();
  res.json({ success: true, data: rows });
});

// GET 单个资产收益趋势
router.get('/:id/profit-trend', (req, res) => {
  const db = getDb();
  const data = buildAssetProfitTrend(db, Number(req.params.id), req.query.range);
  if (!data) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data });
});

// GET 单个
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT a.*, h.id as holding_id, h.quantity, h.avg_cost, h.total_invested,
      h.target_price, h.stop_loss, h.notes as holding_notes, h.opened_at
    FROM assets a LEFT JOIN holdings h ON a.id = h.asset_id AND h.status = 'active'
    WHERE a.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

// POST 创建
router.post('/', (req, res) => {
  const db = getDb();
  const { name, symbol, type, currency = 'CNY', icon, data_source, subtype, quote_currency, unit, provider_symbols } = req.body;
  if (!name || !symbol || !type) return res.status(400).json({ success: false, error: 'name/symbol/type required' });

  const info = db.prepare(`INSERT INTO assets (name, symbol, type, currency, icon, data_source, subtype, quote_currency, unit, provider_symbols)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      name,
      symbol,
      type,
      currency,
      icon || null,
      data_source || null,
      subtype || null,
      quote_currency || currency || null,
      unit || null,
      provider_symbols ? (typeof provider_symbols === 'string' ? provider_symbols : JSON.stringify(provider_symbols)) : null,
    );

  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// PUT 编辑
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const { name, symbol, type, currency, icon, data_source, subtype, quote_currency, unit, provider_symbols } = req.body;
  db.prepare(`UPDATE assets SET name=?, symbol=?, type=?, currency=?, icon=?, data_source=?, subtype=?, quote_currency=?, unit=?, provider_symbols=?, updated_at=datetime('now')
    WHERE id=?`).run(
    name ?? existing.name, symbol ?? existing.symbol, type ?? existing.type,
    currency ?? existing.currency, icon ?? existing.icon, data_source ?? existing.data_source,
    subtype ?? existing.subtype, quote_currency ?? existing.quote_currency, unit ?? existing.unit,
    provider_symbols == null ? existing.provider_symbols : (typeof provider_symbols === 'string' ? provider_symbols : JSON.stringify(provider_symbols)),
    req.params.id
  );

  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: row });
});

// DELETE
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
