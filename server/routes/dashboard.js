import { Router } from 'express';
import { getDb } from '../db/database.js';
import { getUsdCny } from '../services/price.js';
import { getLatestPriceRows } from '../services/latest-price.js';
import { buildPortfolioProfitTrend } from '../services/trend.js';
import { getLatestSignals } from './signals.js';
import { normalizeApiTimestamp } from '../utils/datetime.js';

const router = Router();

function convertToCny(value, currency, usdCny) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  if (currency === 'USD' || currency === 'USDT') return amount * usdCny;
  return amount;
}

function buildSummary(db, usdCny) {
  const holdings = db.prepare(`SELECT h.*, a.name, a.symbol, a.type, a.icon, a.currency
    FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.status = 'active'`).all();

  // 最新价格
  const prices = {};
  const priceRows = getLatestPriceRows(db);
  for (const p of priceRows) prices[p.asset_id] = p.price;

  let totalInvested = 0, totalMarketValue = 0, totalPL = 0;
  const allocation = [];

  for (const h of holdings) {
    const hasRealPrice = !!prices[h.asset_id];
    const price = prices[h.asset_id] || h.avg_cost;
    const marketValue = h.quantity * price;
    const pl = marketValue - h.total_invested;
    const totalInvestedBase = convertToCny(h.total_invested, h.currency, usdCny);
    const marketValueBase = convertToCny(marketValue, h.currency, usdCny);
    const plBase = hasRealPrice ? convertToCny(pl, h.currency, usdCny) : null;
    totalInvested += totalInvestedBase;
    totalMarketValue += marketValueBase;
    if (plBase !== null) totalPL += plBase;
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
      total_invested_base: totalInvestedBase,
      market_value: marketValue,
      market_value_base: marketValueBase,
      pl: hasRealPrice ? pl : null,
      pl_base: plBase,
      pl_pct: hasRealPrice && h.total_invested ? (pl / h.total_invested * 100) : null,
      weight: 0,
    });
  }

  // 权重
  for (const a of allocation) {
    a.weight = totalMarketValue ? (a.market_value_base / totalMarketValue * 100) : 0;
  }

  // 活跃计划
  const activePlans = db.prepare(`SELECT p.*, a.name as asset_name, a.symbol
    FROM trading_plans p
    JOIN assets a ON p.asset_id = a.id
    LEFT JOIN plan_sets ps ON ps.id = p.plan_set_id
    WHERE p.status IN ('pending', 'triggered', 'partial')
      AND (p.plan_set_id IS NULL OR ps.status = 'active')
    ORDER BY p.seq`).all();

  const activeStrategyCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM strategies
    WHERE status = 'active'
  `).get().count;

  // 最近交易
  const recentTrades = db.prepare(`SELECT h.*, a.name, a.symbol, COALESCE(h.currency, a.currency, 'CNY') AS currency
    FROM trade_history h JOIN assets a ON h.asset_id = a.id
    WHERE COALESCE(h.reverted, 0) = 0
    ORDER BY h.executed_at DESC, h.id DESC LIMIT 5`).all();

  return {
    summary: {
      total_invested: totalInvested,
      total_market_value: totalMarketValue,
      total_pl: totalPL,
      total_pl_pct: totalInvested ? (totalPL / totalInvested * 100) : 0,
      active_strategy_count: activeStrategyCount,
      base_currency: 'CNY',
    },
    allocation,
    active_plans: activePlans,
    recent_trades: recentTrades,
  };
}

function buildAlerts(db) {
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

  return rows.map(r => ({
    id: r.id,
    level: levelMap[r.severity] || 'info',
    type: r.type,
    asset_name: r.asset_name,
    asset_icon: r.icon,
    symbol: r.symbol,
    message: r.message,
    plan_id: r.plan_id,
    strategy_id: r.strategy_id,
    time: normalizeApiTimestamp(r.created_at, { assumeUtcWhenNoTimezone: true }),
  }));
}

// GET 仪表盘总览
router.get('/summary', async (req, res) => {
  try {
    const db = getDb();
    const usdCny = await getUsdCny();
    const data = buildSummary(db, usdCny);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const db = getDb();
    const [usd_cny, latestSignals] = await Promise.all([
      getUsdCny(),
      Promise.resolve(getLatestSignals(db)),
    ]);

    res.json({
      success: true,
      data: {
        ...buildSummary(db, usd_cny),
        alerts: buildAlerts(db),
        latest_signals: latestSignals,
        usd_cny,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/profit-trend', async (req, res) => {
  try {
    const db = getDb();
    const usdCny = await getUsdCny();
    const data = buildPortfolioProfitTrend(db, req.query.range, usdCny);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET 提醒/告警（统一从 notifications 表读取）
router.get('/alerts', (req, res) => {
  const db = getDb();
  const alerts = buildAlerts(db);

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
