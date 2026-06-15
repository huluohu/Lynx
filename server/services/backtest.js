import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('backtest');

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJson(text, fallback = {}) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function calculateSharpeRatio(equityCurve) {
  if (!Array.isArray(equityCurve) || equityCurve.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = safeNumber(equityCurve[i - 1]);
    const current = safeNumber(equityCurve[i]);
    if (prev > 0) returns.push((current - prev) / prev);
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, item) => sum + item, 0) / returns.length;
  const variance = returns.reduce((sum, item) => sum + ((item - mean) ** 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return mean / std * Math.sqrt(returns.length);
}

function calculateMaxDrawdown(equityCurve) {
  if (!Array.isArray(equityCurve) || equityCurve.length === 0) return 0;
  let peak = equityCurve[0];
  let maxDrawdown = 0;
  for (const value of equityCurve) {
    if (value > peak) peak = value;
    if (peak > 0) {
      const drawdown = ((peak - value) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

export function runBacktest(strategyId) {
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

  const prices = db.prepare(`SELECT asset_id, price, fetched_at
    FROM price_cache
    WHERE asset_id = ?
    ORDER BY datetime(fetched_at) ASC, id ASC`).all(assetId);
  if (!prices.length) throw new Error('缺少历史价格数据');

  const params = parseJson(strategy.parameters, {});
  const plannedBuyCapital = plans
    .filter(plan => plan.action === 'buy')
    .reduce((sum, plan) => sum + safeNumber(plan.amount), 0);

  let cash = safeNumber(params.budget, plannedBuyCapital || 10000);
  let position = safeNumber(strategy.holding_quantity);
  let averageCost = safeNumber(strategy.holding_avg_cost);
  const initialPrice = safeNumber(prices[0].price);
  const initialInvestment = cash + position * initialPrice;

  const executedPlanIds = new Set();
  const details = [];
  const equityCurve = [initialInvestment];
  let sellTrades = 0;
  let winningTrades = 0;

  for (const tick of prices) {
    const currentPrice = safeNumber(tick.price);
    if (currentPrice <= 0) continue;

    for (const plan of plans) {
      if (executedPlanIds.has(plan.id)) continue;

      const triggerValue = safeNumber(plan.trigger_value);
      const isTriggered = (plan.trigger_type === 'price_below' && currentPrice <= triggerValue)
        || (plan.trigger_type === 'price_above' && currentPrice >= triggerValue);
      if (!isTriggered) continue;

      if (plan.action === 'buy') {
        let quantity = safeNumber(plan.quantity);
        let amount = safeNumber(plan.amount);
        if (quantity <= 0 && amount > 0) quantity = amount / currentPrice;
        if (amount <= 0 && quantity > 0) amount = quantity * currentPrice;
        if (quantity <= 0 || amount <= 0 || cash <= 0) continue;
        if (amount > cash) {
          amount = cash;
          quantity = amount / currentPrice;
        }
        if (quantity <= 0 || amount <= 0) continue;

        const prevPosition = position;
        position += quantity;
        cash -= amount;
        averageCost = position > 0
          ? ((prevPosition * averageCost) + amount) / position
          : 0;

        executedPlanIds.add(plan.id);
        details.push({
          plan_id: plan.id,
          seq: plan.seq,
          action: 'buy',
          trigger_type: plan.trigger_type,
          trigger_value: triggerValue,
          executed_at: tick.fetched_at,
          price: currentPrice,
          quantity,
          amount,
          cash_after: cash,
          position_after: position,
          equity_after: cash + position * currentPrice,
        });
      } else if (plan.action === 'sell') {
        let quantity = safeNumber(plan.quantity);
        if (quantity <= 0 && safeNumber(plan.amount) > 0) {
          quantity = safeNumber(plan.amount) / currentPrice;
        }
        quantity = Math.min(quantity || position, position);
        if (quantity <= 0 || position <= 0) continue;

        const proceeds = quantity * currentPrice;
        const pnl = (currentPrice - averageCost) * quantity;
        position -= quantity;
        cash += proceeds;
        if (position <= 1e-8) {
          position = 0;
          averageCost = 0;
        }

        sellTrades += 1;
        if (pnl > 0) winningTrades += 1;
        executedPlanIds.add(plan.id);
        details.push({
          plan_id: plan.id,
          seq: plan.seq,
          action: 'sell',
          trigger_type: plan.trigger_type,
          trigger_value: triggerValue,
          executed_at: tick.fetched_at,
          price: currentPrice,
          quantity,
          amount: proceeds,
          pnl,
          cash_after: cash,
          position_after: position,
          equity_after: cash + position * currentPrice,
        });
      }
    }

    equityCurve.push(cash + position * currentPrice);
  }

  const finalPrice = safeNumber(prices[prices.length - 1].price);
  const finalValue = cash + position * finalPrice;
  const totalReturnPct = initialInvestment > 0
    ? ((finalValue - initialInvestment) / initialInvestment) * 100
    : 0;
  const maxDrawdownPct = calculateMaxDrawdown(equityCurve);
  const winRate = sellTrades > 0 ? (winningTrades / sellTrades) * 100 : 0;
  const totalTrades = details.length;
  const sharpeRatio = calculateSharpeRatio(equityCurve);

  const insert = db.prepare(`INSERT INTO backtest_results (
      strategy_id, asset_id, start_date, end_date, initial_investment, final_value,
      total_return_pct, max_drawdown_pct, win_rate, total_trades, sharpe_ratio, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const info = insert.run(
    strategy.id,
    assetId,
    prices[0].fetched_at,
    prices[prices.length - 1].fetched_at,
    initialInvestment,
    finalValue,
    totalReturnPct,
    maxDrawdownPct,
    winRate,
    totalTrades,
    sharpeRatio,
    JSON.stringify(details)
  );

  const result = db.prepare('SELECT * FROM backtest_results WHERE id = ?').get(info.lastInsertRowid);
  result.details = details;
  log.info('Backtest completed', { strategyId, trades: totalTrades, totalReturnPct: totalReturnPct.toFixed(2) });
  return result;
}
