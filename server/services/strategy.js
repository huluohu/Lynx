/**
 * 智能策略生成
 * 输入: 持仓 + 约束 → 输出: 完整 trading_plans 数组
 */

/**
 * 扭亏策略（现有逻辑）
 * 当前持仓亏损 → 计算补仓量 + 反弹减仓线
 */
export function generateRecovery(holding, params = {}) {
  const {
    budget = 20000,
    buy_lines = [],     // [{price, amount, ratio, asset_id}]
    sell_lines = [],    // [{price, amount, asset_id}]
  } = params;

  const plans = [];
  const cost = holding.avg_cost;
  let remaining = budget;

  // 补仓线
  for (const bl of buy_lines) {
    const amt = typeof bl.amount === 'number' ? bl.amount : bl.ratio * budget;
    if (amt <= remaining && bl.price < cost) {
      const newQty = holding.quantity + amt / bl.price;
      const newAvg = (holding.total_invested + amt) / newQty;
      plans.push({
        seq: plans.length + 1,
        asset_id: bl.asset_id || null,
        trigger_type: 'price_below',
        trigger_value: bl.price,
        action: 'buy',
        quantity: amt / bl.price,
        amount: amt,
        new_avg_cost: Math.round(newAvg * 100) / 100,
        notes: `补仓降至均价${Math.round(newAvg)}`,
      });
      remaining -= amt;
    }
  }

  // 减仓线
  for (const sl of sell_lines) {
    plans.push({
      seq: plans.length + 1,
      asset_id: sl.asset_id || null,
      trigger_type: 'price_above',
      trigger_value: sl.price,
      action: 'sell',
      quantity: sl.quantity || sl.amount / sl.price,
      amount: sl.amount,
      new_avg_cost: null,
      notes: sl.notes || '',
    });
  }

  return plans;
}

/**
 * DCA 定投策略
 */
export function generateDCA(holding, params = {}) {
  const { frequency = 'weekly', amount_per = 1000, periods = 10 } = params;
  const plans = [];
  for (let i = 0; i < periods; i++) {
    plans.push({
      seq: i + 1,
      trigger_type: 'time',
      trigger_value: i * (frequency === 'weekly' ? 7 : 1),
      action: 'buy',
      quantity: amount_per / holding.avg_cost,
      amount: amount_per,
      new_avg_cost: null,
      notes: `第${i + 1}期定投`,
    });
  }
  return plans;
}

/**
 * 网格交易
 */
export function generateGrid(holding, params = {}) {
  const { low, high, grids = 5 } = params;
  const step = (high - low) / grids;
  const plans = [];
  let seq = 0;

  for (let i = 0; i < grids; i++) {
    const buyPrice = high - step * (i + 1);
    const sellPrice = low + step * (i + 1);
    plans.push({
      seq: ++seq,
      trigger_type: 'price_below',
      trigger_value: Math.round(buyPrice * 100) / 100,
      action: 'buy',
      quantity: null,
      amount: params.amount_per || (params.budget / grids),
      new_avg_cost: null,
      notes: `网格第${i + 1}档买入`,
    });
    plans.push({
      seq: ++seq,
      trigger_type: 'price_above',
      trigger_value: Math.round(sellPrice * 100) / 100,
      action: 'sell',
      quantity: null,
      amount: null,
      new_avg_cost: null,
      notes: `网格第${i + 1}档卖出`,
    });
  }

  return plans;
}

/**
 * 价值平均
 */
export function generateValueAvg(holding, params = {}) {
  const { target_value = 50000, periods = 10, growth_rate = 0.02 } = params;
  const plans = [];
  for (let i = 0; i < periods; i++) {
    const t = target_value * Math.pow(1 + growth_rate, i + 1);
    const current = (holding.quantity * holding.avg_cost) * Math.pow(1 + growth_rate, i);
    const need = Math.max(0, t - current);
    plans.push({
      seq: i + 1,
      trigger_type: 'time',
      trigger_value: i * 30,
      action: need > 0 ? 'buy' : 'sell',
      quantity: need / holding.avg_cost,
      amount: Math.abs(need),
      new_avg_cost: null,
      notes: `第${i + 1}期调整至${Math.round(t)}元`,
    });
  }
  return plans;
}

// 策略生成入口
const GENERATORS = {
  recovery: generateRecovery,
  dca: generateDCA,
  grid: generateGrid,
  value_avg: generateValueAvg,
};

export function generatePlan(holding, strategyType, params) {
  const gen = GENERATORS[strategyType];
  if (!gen) throw new Error(`Unknown strategy type: ${strategyType}`);
  return gen(holding, params);
}
