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

// GET 提醒/告警
router.get('/alerts', (req, res) => {
  const db = getDb();
  const alerts = [];

  // 1. 已触发的计划
  const triggeredPlans = db.prepare(`SELECT p.*, a.name as asset_name, a.symbol, a.icon, a.type
    FROM trading_plans p JOIN assets a ON p.asset_id = a.id
    WHERE p.status = 'triggered' ORDER BY p.seq`).all();

  for (const p of triggeredPlans) {
    alerts.push({
      id: `plan-${p.id}`,
      level: 'danger',
      type: 'plan_triggered',
      asset_name: p.asset_name,
      asset_icon: p.icon,
      symbol: p.symbol,
      message: `${p.action === 'buy' ? '📥 补仓机会' : '📤 减仓机会'}：${p.asset_name} ${p.action === 'buy' ? '跌至' : '涨至'} ${p.trigger_value}，建议${p.action === 'buy' ? '买入' : '卖出'} ${p.quantity || '-'}`,
      action: p.action,
      quantity: p.quantity,
      trigger_value: p.trigger_value,
      plan_id: p.id,
      strategy_id: p.strategy_id,
      time: p.updated_at || p.created_at,
    });
  }

  // 2. 接近触发线（价格与触发值差 ≤ 5%）
  const pendingPlans = db.prepare(`SELECT p.*, a.name as asset_name, a.symbol, a.icon, a.type
    FROM trading_plans p JOIN assets a ON p.asset_id = a.id
    WHERE p.status = 'pending' ORDER BY p.seq`).all();

  const prices = {};
  const priceRows = db.prepare(`SELECT pc.* FROM price_cache pc
    JOIN (SELECT asset_id, MAX(fetched_at) as max_ts FROM price_cache GROUP BY asset_id) latest
    ON pc.asset_id = latest.asset_id AND pc.fetched_at = latest.max_ts`).all();
  for (const p of priceRows) prices[p.asset_id] = { price: p.price, currency: p.currency || 'CNY' };

  for (const p of pendingPlans) {
    const priceData = prices[p.asset_id];
    if (!priceData) continue;
    const price = priceData.price;
    const trigger = parseFloat(p.trigger_value);
    if (!trigger) continue;
    const diffPct = Math.abs((price - trigger) / trigger * 100);
    if (diffPct <= 5) {
      const direction = p.trigger_type === 'price_below' ? (price <= trigger) : (price >= trigger);
      const nearLabel = direction ? '已到达' : (price < trigger ? '差' : '超') + diffPct.toFixed(1) + '%';
      alerts.push({
        id: `near-${p.id}`,
        level: direction ? 'danger' : 'warning',
        type: 'plan_approaching',
        asset_name: p.asset_name,
        asset_icon: p.icon,
        symbol: p.symbol,
        message: direction
          ? `⚡ ${p.asset_name} 已触及 ${p.action === 'buy' ? '补仓线' : '减仓线'} ${p.trigger_value}`
          : `⏳ ${p.asset_name} 距 ${p.action === 'buy' ? '补仓' : '减仓'}线 ${p.trigger_value} ${nearLabel}（当前 ${priceData.currency === 'USD' ? '$' : '¥'}${price}）`,
        action: direction ? p.action : null,
        quantity: direction ? p.quantity : null,
        trigger_value: p.trigger_value,
        current_price: price,
        diff_pct: diffPct,
        plan_id: p.id,
        strategy_id: p.strategy_id,
        time: new Date().toISOString(),
      });
    }
  }

  // 3. 持仓止损监控
  const holdings = db.prepare(`SELECT h.*, a.name, a.symbol, a.icon, a.type
    FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.status = 'active'`).all();

  for (const h of holdings) {
    const priceData = prices[h.asset_id];
    if (!priceData || !h.stop_loss) continue;
    const price = priceData.price;
    const stopLoss = parseFloat(h.stop_loss);
    const diffPct = (price - stopLoss) / stopLoss * 100;
    if (diffPct <= 5) {
      alerts.push({
        id: `stop-${h.id}`,
        level: diffPct <= 0 ? 'danger' : 'warning',
        type: 'stop_loss',
        asset_name: h.name,
        asset_icon: h.icon,
        symbol: h.symbol,
        message: diffPct <= 0
          ? `🚨 ${h.name} 触发止损线 ${stopLoss}！`
          : `⚠️ ${h.name} 距止损线 ${stopLoss} 仅 ${diffPct.toFixed(1)}%（当前 ${priceData.currency === 'USD' ? '$' : '¥'}${price}）`,
        current_price: price,
        stop_loss: stopLoss,
        diff_pct: diffPct,
        time: new Date().toISOString(),
      });
    }
  }

  // 4. 价格大幅波动
  for (const [assetId, priceData] of Object.entries(prices)) {
    const lastTwo = db.prepare(`SELECT price, fetched_at FROM price_cache
      WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 2`).all(assetId);
    if (lastTwo.length < 2) continue;
    const changePct = (lastTwo[0].price - lastTwo[1].price) / lastTwo[1].price * 100;
    if (Math.abs(changePct) >= 2) {
      const asset = db.prepare('SELECT name, icon, symbol FROM assets WHERE id = ?').get(assetId);
      if (!asset) continue;
      alerts.push({
        id: `vol-${assetId}-${Date.now()}`,
        level: Math.abs(changePct) >= 5 ? 'danger' : 'info',
        type: 'price_swing',
        asset_name: asset.name,
        asset_icon: asset.icon,
        symbol: asset.symbol,
        message: changePct >= 0
          ? `📈 ${asset.name} 大涨 +${changePct.toFixed(1)}%`
          : `📉 ${asset.name} 大跌 ${changePct.toFixed(1)}%`,
        change_pct: changePct,
        time: lastTwo[0].fetched_at,
      });
    }
  }

  const levelOrder = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || a.type.localeCompare(b.type));

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
