import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 所有/某策略下的计划
router.get('/', (req, res) => {
  const db = getDb();
  const { strategy_id, asset_id } = req.query;
  let sql = 'SELECT p.*, a.name as asset_name, a.symbol, a.type as asset_type FROM trading_plans p JOIN assets a ON p.asset_id = a.id WHERE 1=1';
  const params = [];
  if (strategy_id) { sql += ' AND p.strategy_id = ?'; params.push(strategy_id); }
  if (asset_id) { sql += ' AND p.asset_id = ?'; params.push(asset_id); }
  sql += ' ORDER BY p.seq';

  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

// PUT 编辑
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const { trigger_type, trigger_value, action, quantity, amount, status, notes } = req.body;
  db.prepare(`UPDATE trading_plans SET trigger_type=?, trigger_value=?, action=?, quantity=?, amount=?,
    status=?, notes=?, updated_at=datetime('now') WHERE id=?`).run(
    trigger_type ?? existing.trigger_type, trigger_value ?? existing.trigger_value,
    action ?? existing.action, quantity ?? existing.quantity, amount ?? existing.amount,
    status ?? existing.status, notes ?? existing.notes, req.params.id
  );

  const row = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: row });
});

// POST 标记触发
router.post('/:id/trigger', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE trading_plans SET status='triggered', updated_at=datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// POST 标记已执行
router.post('/:id/execute', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE trading_plans SET status='executed', updated_at=datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
