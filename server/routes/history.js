import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 历史列表
router.get('/', (req, res) => {
  const db = getDb();
  const { limit = 50, offset = 0 } = req.query;
  const rows = db.prepare(`SELECT h.*, a.name as asset_name, a.symbol, a.type as asset_type,
      COALESCE(h.currency, a.currency, 'CNY') as currency
    FROM trade_history h JOIN assets a ON h.asset_id = a.id
    ORDER BY h.executed_at DESC LIMIT ? OFFSET ?`).all(Number(limit), Number(offset));
  const total = db.prepare('SELECT COUNT(*) as count FROM trade_history').get().count;
  res.json({ success: true, data: rows, total });
});

// POST 添加历史记录
router.post('/', (req, res) => {
  const db = getDb();
  const { asset_id, type, quantity, price, total, pnl, pnl_pct, executed_at, reason, tags, currency } = req.body;

  if (!asset_id || !type || quantity === undefined || quantity === null || price === undefined || price === null) {
    return res.status(400).json({ success: false, error: '缺少必要字段: asset_id, type, quantity, price' });
  }

  const qty = Number(quantity);
  const prc = Number(price);
  const amt = Number(total) || qty * prc;
  const tradeCurrency = currency || db.prepare('SELECT currency FROM assets WHERE id = ?').get(asset_id)?.currency || 'CNY';

  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(prc) || prc <= 0) {
    return res.status(400).json({ success: false, error: '数量和价格必须大于 0' });
  }

  const holding = db.prepare("SELECT * FROM holdings WHERE asset_id = ? AND status = 'active'").get(asset_id);
  if (type === 'sell' && (!holding || holding.quantity <= 0)) {
    return res.status(400).json({ success: false, error: '当前没有可卖出的持仓，请先创建或买入该资产持仓' });
  }

  const doInsert = db.transaction(() => {
    // 1. Insert trade record
    const info = db.prepare(`INSERT INTO trade_history (asset_id, type, quantity, price, total, pnl, pnl_pct, executed_at, reason, tags, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(asset_id, type, qty, prc, amt, pnl || null, pnl_pct || null, executed_at, reason || null, tags || null, tradeCurrency);

    // 2. Update holding based on trade type
    if (type === 'buy') {
      if (holding) {
        // Update existing holding: increase quantity, recalculate avg cost
        const newQty = holding.quantity + qty;
        const newTotalInvested = holding.total_invested + amt;
        const newAvgCost = newQty > 0 ? newTotalInvested / newQty : 0;
        db.prepare(`UPDATE holdings SET quantity = ?, avg_cost = ?, total_invested = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(newQty, newAvgCost, newTotalInvested, holding.id);
      } else {
        // Create new holding
        db.prepare(`INSERT INTO holdings (asset_id, quantity, avg_cost, total_invested) VALUES (?, ?, ?, ?)`)
          .run(asset_id, qty, prc, amt);
      }
    } else if (type === 'sell') {
      const newQty = Math.max(0, holding.quantity - qty);
      const newTotalInvested = newQty > 0 ? newQty * holding.avg_cost : 0;
      if (newQty <= 0) {
        // Close holding
        db.prepare(`UPDATE holdings SET quantity = 0, total_invested = 0, status = 'closed', updated_at = datetime('now') WHERE id = ?`)
          .run(holding.id);
      } else {
        // Reduce quantity, keep avg_cost unchanged
        db.prepare(`UPDATE holdings SET quantity = ?, total_invested = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(newQty, newTotalInvested, holding.id);
      }
    }

    return info.lastInsertRowid;
  });

  const rowId = doInsert();
  const row = db.prepare(`SELECT h.*, a.name as asset_name, a.symbol, a.type as asset_type,
      COALESCE(h.currency, a.currency, 'CNY') as currency
    FROM trade_history h JOIN assets a ON h.asset_id = a.id WHERE h.id = ?`).get(rowId);
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
