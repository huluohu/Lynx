import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 持仓列表
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT h.*, a.name, a.symbol, a.type, a.icon, a.currency,
    pc.price AS current_price, pc.fetched_at AS price_updated_at
    FROM holdings h
    JOIN assets a ON h.asset_id = a.id
    LEFT JOIN (
      SELECT pc1.asset_id, pc1.price, pc1.fetched_at
      FROM price_cache pc1
      JOIN (SELECT asset_id, MAX(fetched_at) AS max_ts FROM price_cache GROUP BY asset_id) pc2
        ON pc1.asset_id = pc2.asset_id AND pc1.fetched_at = pc2.max_ts
    ) pc ON pc.asset_id = h.asset_id
    WHERE h.status = 'active' ORDER BY h.id`).all();
  res.json({ success: true, data: rows });
});

// GET 单个持仓
router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT h.*, a.name, a.symbol, a.type, a.icon FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

// POST 创建持仓
router.post('/', (req, res) => {
  const db = getDb();
  const { asset_id, quantity, avg_cost, total_invested, target_price, stop_loss, notes } = req.body;
  if (!asset_id || !quantity || !avg_cost) return res.status(400).json({ success: false, error: 'asset_id/quantity/avg_cost required' });

  // Prevent duplicate active holdings for the same asset
  const existing = db.prepare("SELECT id FROM holdings WHERE asset_id = ? AND status = 'active'").get(asset_id);
  if (existing) {
    return res.status(400).json({ success: false, error: '该资产已存在活跃持仓，请直接编辑现有持仓' });
  }

  const total = total_invested || (quantity * avg_cost);
  const info = db.prepare(`INSERT INTO holdings (asset_id, quantity, avg_cost, total_invested, target_price, stop_loss, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(asset_id, quantity, avg_cost, total, target_price || null, stop_loss || null, notes || null);

  const row = db.prepare('SELECT h.*, a.name, a.symbol FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// PUT 编辑
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM holdings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const { quantity, avg_cost, total_invested, target_price, stop_loss, notes, status, currency } = req.body;
  db.prepare(`UPDATE holdings SET quantity=?, avg_cost=?, total_invested=?,
    target_price=?, stop_loss=?, notes=?, status=?, updated_at=datetime('now')
    WHERE id=?`).run(
    quantity ?? existing.quantity, avg_cost ?? existing.avg_cost,
    total_invested ?? existing.total_invested, target_price ?? existing.target_price,
    stop_loss ?? existing.stop_loss, notes ?? existing.notes,
    status ?? existing.status, req.params.id
  );

  // Update asset currency if provided
  if (currency) {
    db.prepare('UPDATE assets SET currency = ?, updated_at = datetime(?) WHERE id = ?')
      .run(currency, new Date().toISOString(), existing.asset_id);
  }

  const row = db.prepare('SELECT h.*, a.name, a.symbol, a.currency FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.id = ?').get(req.params.id);
  res.json({ success: true, data: row });
});

export default router;
