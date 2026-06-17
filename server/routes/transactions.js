import { Router } from 'express';
import { getDb } from '../db/database.js';
import { createNotification } from './notifications.js';

const router = Router();

// GET 交易列表
router.get('/', (req, res) => {
  const db = getDb();
  const { asset_id, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT t.*, a.name, a.symbol FROM transactions t JOIN assets a ON t.asset_id = a.id';
  let countSql = 'SELECT COUNT(*) as count FROM transactions';
  const params = [];
  const countParams = [];
  if (asset_id) {
    sql += ' WHERE t.asset_id = ?'; params.push(asset_id);
    countSql += ' WHERE asset_id = ?'; countParams.push(asset_id);
  }
  sql += ' ORDER BY t.executed_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare(countSql).get(...countParams).count;
  res.json({ success: true, data: rows, total });
});

// POST 添加交易 → 自动更新持仓 + 触发策略
router.post('/', (req, res) => {
  const db = getDb();
  const { asset_id, type, quantity, price, fee = 0, executed_at, notes } = req.body;
  if (!asset_id || !type || !quantity || !price) return res.status(400).json({ success: false, error: 'missing fields' });

  // Validate type
  if (!['buy', 'sell'].includes(type)) {
    return res.status(400).json({ success: false, error: 'type must be "buy" or "sell"' });
  }

  // Validate sell doesn't exceed holding
  if (type === 'sell') {
    const holding = db.prepare('SELECT * FROM holdings WHERE asset_id = ? AND status = ?').get(asset_id, 'active');
    if (!holding || holding.quantity < quantity) {
      return res.status(400).json({ success: false, error: '卖出数量不能超过持仓数量' });
    }
  }

  // Wrap everything in a transaction for atomicity
  const executeTransaction = db.transaction(() => {
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
        const newQty = holding.quantity - quantity;
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
          notifications.push({
            type: 'plan_triggered',
            title: `${plan.action === 'buy' ? '补仓' : '减仓'}机会`,
            message: `${asset.name} ${plan.action === 'buy' ? '跌至' : '涨至'} ${triggerVal}，建议${plan.action === 'buy' ? '买入' : '卖出'} ${plan.quantity || '-'}`,
            asset_id: asset.id,
            plan_id: plan.id,
            strategy_id: plan.strategy_id || null,
          });
        }
      }

      // 批量插入通知
      for (const n of notifications) {
        createNotification(db, {
          type: n.type,
          title: n.title,
          message: n.message,
          asset_id: n.asset_id,
          plan_id: n.plan_id,
          strategy_id: n.strategy_id || null,
          severity: 'danger',
          channel: 'all',
        });
      }

      // 交易本身也记一条通知
      const currSymbol = asset.currency === 'USD'
        ? '$'
        : asset.currency === 'USDT'
          ? 'USDT '
          : '¥';
      createNotification(db, {
        type: 'trade_executed',
        title: `${type === 'buy' ? '买入' : '卖出'} ${asset.name}`,
        message: `${type === 'buy' ? '买入' : '卖出'} ${quantity} ${asset.symbol} @ ${currSymbol}${price}，金额 ${currSymbol}${Math.round(total)}`,
        asset_id,
        severity: 'info',
        channel: 'all',
      });
    }

    return info.lastInsertRowid;
  });

  try {
    const lastId = executeTransaction();
    const row = db.prepare('SELECT t.*, a.name, a.symbol FROM transactions t JOIN assets a ON t.asset_id = a.id WHERE t.id = ?').get(lastId);
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    res.status(500).json({ success: false, error: '交易处理失败: ' + e.message });
  }
});

export default router;
