import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 仪表盘总览
router.get('/summary', (req, res) => {
  const db = getDb();

  // 持仓汇总
  const holdings = db.prepare(`SELECT h.*, a.name, a.symbol, a.type, a.icon, a.currency
    FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.status = 'active'`).all();

  // 最新价格
  const prices = {};
  const priceRows = db.prepare(`SELECT pc.* FROM price_cache pc
    JOIN (SELECT asset_id, MAX(fetched_at) as max_ts FROM price_cache GROUP BY asset_id) latest
    ON pc.asset_id = latest.asset_id AND pc.fetched_at = latest.max_ts`).all();
  for (const p of priceRows) prices[p.asset_id] = p.price;

  let totalInvested = 0, totalMarketValue = 0, totalPL = 0;
  const allocation = [];

  for (const h of holdings) {
    const hasRealPrice = !!prices[h.asset_id];
    const price = prices[h.asset_id] || h.avg_cost;
    const marketValue = h.quantity * price;
    const pl = marketValue - h.total_invested;
    totalInvested += h.total_invested;
    totalMarketValue += marketValue;
    if (hasRealPrice) totalPL += pl;
    allocation.push({
      asset_id: h.asset_id,
      name: h.name,
      symbol: h.symbol,
      type: h.type,
      icon: h.icon,
      currency: h.currency || 'CNY',
      quantity: h.quantity,
      avg_cost: h.avg_cost,
      price,
      has_real_price: hasRealPrice,
      total_invested: h.total_invested,
      market_value: marketValue,
      pl: hasRealPrice ? pl : null,
      pl_pct: hasRealPrice && h.total_invested ? (pl / h.total_invested * 100) : null,
      weight: 0,
    });
  }

  // 权重
  for (const a of allocation) {
    a.weight = totalMarketValue ? (a.market_value / totalMarketValue * 100) : 0;
  }

  // 活跃计划
  const activePlans = db.prepare(`SELECT p.*, a.name as asset_name, a.symbol
    FROM trading_plans p JOIN assets a ON p.asset_id = a.id
    WHERE p.status IN ('pending', 'triggered') ORDER BY p.seq`).all();

  // 最近交易
  const recentTrades = db.prepare(`SELECT t.*, a.name, a.symbol
    FROM transactions t JOIN assets a ON t.asset_id = a.id
    ORDER BY t.executed_at DESC LIMIT 5`).all();

  res.json({ success: true, data: {
    summary: {
      total_invested: totalInvested,
      total_market_value: totalMarketValue,
      total_pl: totalPL,
      total_pl_pct: totalInvested ? (totalPL / totalInvested * 100) : 0,
    },
    allocation,
    active_plans: activePlans,
    recent_trades: recentTrades,
  }});
});

// GET 提醒/告警（统一从 notifications 表读取）
router.get('/alerts', (req, res) => {
  const db = getDb();

  const rows = db.prepare(`
    SELECT n.*, a.name AS asset_name, a.symbol, a.icon
    FROM notifications n
    LEFT JOIN assets a ON n.asset_id = a.id
    WHERE n.status IN ('pending', 'sent')
    ORDER BY
      CASE n.severity WHEN 'danger' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
      n.created_at DESC
  `).all();

  const levelMap = { danger: 'danger', warning: 'warning', info: 'info' };

  const alerts = rows.map(r => ({
    id: r.id,
    level: levelMap[r.severity] || 'info',
    type: r.type,
    asset_name: r.asset_name,
    asset_icon: r.icon,
    symbol: r.symbol,
    message: r.message,
    plan_id: r.plan_id,
    strategy_id: r.strategy_id,
    time: r.created_at,
  }));

  res.json({ success: true, data: alerts });
});

// GET 资产配置
router.get('/allocation', (req, res) => {
  const db = getDb();
  // 按资产类型汇总
  const rows = db.prepare(`SELECT a.type, SUM(h.total_invested) as invested, COUNT(*) as count
    FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.status = 'active'
    GROUP BY a.type`).all();

  res.json({ success: true, data: rows });
});

export default router;
