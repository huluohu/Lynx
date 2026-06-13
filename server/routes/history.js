import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 历史列表
router.get('/', (req, res) => {
  const db = getDb();
  const { limit = 50, offset = 0 } = req.query;
  const rows = db.prepare(`SELECT h.*, a.name as asset_name, a.symbol
    FROM trade_history h JOIN assets a ON h.asset_id = a.id
    ORDER BY h.executed_at DESC LIMIT ? OFFSET ?`).all(Number(limit), Number(offset));
  const total = db.prepare('SELECT COUNT(*) as count FROM trade_history').get().count;
  res.json({ success: true, data: rows, total });
});

// POST 添加历史记录
router.post('/', (req, res) => {
  const db = getDb();
  const { asset_id, type, quantity, price, total, pnl, pnl_pct, executed_at, reason, tags } = req.body;
  const info = db.prepare(`INSERT INTO trade_history (asset_id, type, quantity, price, total, pnl, pnl_pct, executed_at, reason, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(asset_id, type, quantity, price, total, pnl || null, pnl_pct || null, executed_at, reason || null, tags || null);

  const row = db.prepare('SELECT * FROM trade_history WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// PUT 编辑复盘
router.put('/:id', (req, res) => {
  const db = getDb();
  const { reason, tags } = req.body;
  db.prepare('UPDATE trade_history SET reason=?, tags=? WHERE id=?').run(reason || null, tags || null, req.params.id);
  res.json({ success: true });
});

// DELETE
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM trade_history WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
