import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getLatestPriceMap } from '../services/latest-price.js';

const router = Router();

// GET 持仓列表
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT h.*, a.name, a.symbol, a.type, a.icon, a.currency
    FROM holdings h
    JOIN assets a ON h.asset_id = a.id
    WHERE h.status = 'active' ORDER BY h.id`).all();
  const latestPriceMap = getLatestPriceMap(db, rows.map((row) => row.asset_id));
  const data = rows.map((row) => {
    const latestPrice = latestPriceMap.get(row.asset_id);
    return {
      ...row,
      current_price: latestPrice?.price ?? null,
      price_updated_at: latestPrice?.fetched_at ?? null,
    };
  });
  res.json({ success: true, data });
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
