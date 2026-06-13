import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 交易列表
router.get('/', (req, res) => {
  const db = getDb();
  const { asset_id, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT t.*, a.name, a.symbol FROM transactions t JOIN assets a ON t.asset_id = a.id';
  const params = [];
  if (asset_id) { sql += ' WHERE t.asset_id = ?'; params.push(asset_id); }
  sql += ' ORDER BY t.executed_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
  res.json({ success: true, data: rows, total });
});

// POST 添加交易 → 自动更新持仓 + 触发策略
router.post('/', (req, res) => {
  const db = getDb();
  const { asset_id, type, quantity, price, fee = 0, executed_at, notes } = req.body;
  if (!asset_id || !type || !quantity || !price) return res.status(400).json({ success: false, error: 'missing fields' });

  const total = quantity * price + (type === 'buy' ? fee : -fee);
  const info = db.prepare(`INSERT INTO transactions (asset_id, type, quantity, price, total, fee, executed_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(asset_id, type, quantity, price, total, fee, executed_at || new Date().toISOString(), notes || null);

  // 1. 自动更新持仓
  const holding = db.prepare('SELECT * FROM holdings WHERE asset_id = ? AND status = ?').get(asset_id, 'active');
  if (holding) {
    if (type === 'buy') {
      const newQty = holding.quantity + quantity;
      const newTotal = holding.total_invested + total;
      const newAvgCost = newTotal / newQty;
      db.prepare('UPDATE holdings SET quantity = ?, avg_cost = ?, total_invested = ? WHERE id = ?')
        .run(newQty, Math.round(newAvgCost * 100) / 100, Math.round(newTotal * 100) / 100, holding.id);
    } else {
      const newQty = Math.max(0, holding.quantity - quantity);
      const ratio = newQty / holding.quantity;
      const newTotal = holding.total_invested * ratio;
      const newAvgCost = newQty > 0 ? newTotal / newQty : 0;
      db.prepare('UPDATE holdings SET quantity = ?, avg_cost = ?, total_invested = ? WHERE id = ?')
        .run(newQty, Math.round(newAvgCost * 100) / 100, Math.round(newTotal * 100) / 100, holding.id);
    }
  }

  // 2. 检查触发操盘计划
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id);
  if (asset) {
    const priceRows = db.prepare(`SELECT price, currency FROM price_cache
      WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 1`).all(asset_id);
    const currentPrice = priceRows[0]?.price || price;

    // 获取该资产所有 pending 计划
    const plans = db.prepare('SELECT p.* FROM trading_plans p WHERE p.asset_id = ? AND p.status = ?').all(asset_id, 'pending');
    const notifications = [];

    for (const plan of plans) {
      const triggerVal = parseFloat(plan.trigger_value);
      if (!triggerVal) continue;

      let triggered = false;
      if (plan.trigger_type === 'price_below' && currentPrice <= triggerVal) triggered = true;
      if (plan.trigger_type === 'price_above' && currentPrice >= triggerVal) triggered = true;

      if (triggered) {
        db.prepare('UPDATE trading_plans SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('triggered', plan.id);

        // 获取 plan 关联的 strategy
        const strategy = db.prepare('SELECT name FROM strategies WHERE id = ?').get(plan.strategy_id);

        // 创建通知
        notifications.push({
          type: 'plan_triggered',
          title: `${plan.action === 'buy' ? '补仓' : '减仓'}机会`,
          message: `${asset.name} ${plan.action === 'buy' ? '跌至' : '涨至'} ${triggerVal}，建议${plan.action === 'buy' ? '买入' : '卖出'} ${plan.quantity || '-'}`,
          asset_id: asset.id,
          plan_id: plan.id,
        });
      }
    }

    // 批量插入通知
    for (const n of notifications) {
      db.prepare('INSERT INTO notifications (type, title, message, asset_id, plan_id, channel) VALUES (?, ?, ?, ?, ?, ?)')
        .run(n.type, n.title, n.message, n.asset_id, n.plan_id, 'all');
    }

    // 交易本身也记一条通知
    db.prepare('INSERT INTO notifications (type, title, message, asset_id, channel) VALUES (?, ?, ?, ?, ?)')
      .run('trade_executed', `${type === 'buy' ? '买入' : '卖出'} ${asset.name}`, `${type === 'buy' ? '买入' : '卖出'} ${quantity} ${asset.symbol} @ ¥${price}，金额 ¥${Math.round(total)}`, asset_id, 'all');
  }

  const row = db.prepare('SELECT t.*, a.name, a.symbol FROM transactions t JOIN assets a ON t.asset_id = a.id WHERE t.id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

export default router;
