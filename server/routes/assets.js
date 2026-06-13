import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 全部资产
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT a.*, h.id as holding_id, h.quantity, h.avg_cost, h.total_invested
    FROM assets a LEFT JOIN holdings h ON a.id = h.asset_id AND h.status = 'active'
    ORDER BY a.id`).all();
  res.json({ success: true, data: rows });
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
  const { name, symbol, type, currency = 'CNY', icon, data_source } = req.body;
  if (!name || !symbol || !type) return res.status(400).json({ success: false, error: 'name/symbol/type required' });

  const info = db.prepare(`INSERT INTO assets (name, symbol, type, currency, icon, data_source)
    VALUES (?, ?, ?, ?, ?, ?)`).run(name, symbol, type, currency, icon || null, data_source || null);

  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// PUT 编辑
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const { name, symbol, type, currency, icon, data_source } = req.body;
  db.prepare(`UPDATE assets SET name=?, symbol=?, type=?, currency=?, icon=?, data_source=?, updated_at=datetime('now')
    WHERE id=?`).run(
    name ?? existing.name, symbol ?? existing.symbol, type ?? existing.type,
    currency ?? existing.currency, icon ?? existing.icon, data_source ?? existing.data_source,
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
