import { getDb } from '../db/database.js';
import { simulateBacktest } from './backtest.js';

const SCENARIOS = [
  { key: 'crash_30', label: '暴跌 30%', days: 30 },
  { key: 'crash_50', label: '暴跌 50%', days: 60 },
  { key: 'slow_bleed', label: '阴跌 20%', days: 90 },
  { key: 'sideways', label: '震荡行情', days: 60 },
  { key: 'recovery_v', label: 'V 型反弹', days: 60 },
  { key: 'bull_run', label: '牛市上涨', days: 60 },
];

export function generateScenarioPrices(basePrice, scenario, days = 60) {
  const prices = [];
  const start = Date.now();
  for (let i = 0; i < days; i++) {
    const t = i / days;
    let factor = 1;
    switch (scenario) {
      case 'crash_30': factor = 1 - 0.3 * t; break;
      case 'crash_50': factor = 1 - 0.5 * t; break;
      case 'slow_bleed': factor = 1 - 0.2 * t; break;
      case 'sideways': factor = 1 + 0.05 * Math.sin(t * Math.PI * 4); break;
      case 'recovery_v': factor = t < 0.4 ? 1 - 0.5 * t : 0.8 + 0.5 * (t - 0.4); break;
      case 'bull_run': factor = 1 + 0.4 * t; break;
      default: factor = 1;
    }
    prices.push({
      price: Number((basePrice * factor).toFixed(4)),
      fetched_at: new Date(start + i * 86400000).toISOString(),
    });
  }
  return prices;
}

export function runStressTest(strategyId) {
  const db = getDb();
  const strategy = db.prepare(`SELECT s.*, a.name AS asset_name, a.symbol,
      h.quantity AS holding_quantity, h.avg_cost AS holding_avg_cost, h.total_invested AS holding_total_invested
    FROM strategies s
    LEFT JOIN assets a ON s.asset_id = a.id
    LEFT JOIN holdings h ON h.asset_id = s.asset_id AND h.status = 'active'
    WHERE s.id = ?`).get(strategyId);

  if (!strategy) throw new Error('策略不存在');

  const plans = db.prepare(`SELECT * FROM trading_plans
    WHERE strategy_id = ?
    ORDER BY seq ASC, id ASC`).all(strategyId);
  if (!plans.length) throw new Error('策略暂无操盘计划');

  const assetId = strategy.asset_id || plans[0]?.asset_id;
  if (!assetId) throw new Error('策略未关联资产');

  const latestPrice = db.prepare(`SELECT price, fetched_at FROM price_cache
    WHERE asset_id = ?
    ORDER BY datetime(fetched_at) DESC, id DESC
    LIMIT 1`).get(assetId);
  if (!latestPrice?.price) throw new Error('缺少当前价格数据');

  const basePrice = Number(latestPrice.price);
  if (!Number.isFinite(basePrice) || basePrice <= 0) throw new Error('当前价格无效');

  return SCENARIOS.map((scenario) => {
    const prices = generateScenarioPrices(basePrice, scenario.key, scenario.days);
    const result = simulateBacktest({ strategy, plans, prices, assetId });
    return {
      scenario_name: scenario.key,
      scenario_label: scenario.label,
      final_value: result.final_value,
      return_pct: result.total_return_pct,
      max_drawdown_pct: result.max_drawdown_pct,
      plans_triggered: result.plans_triggered,
      start_date: result.start_date,
      end_date: result.end_date,
    };
  });
}
