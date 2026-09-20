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
    const sellPrice = Number(sl.price);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) continue; // 无效触发价会导致数量为 Infinity
    const sellQty = sl.quantity || Number(sl.amount) / sellPrice;
    plans.push({
      seq: plans.length + 1,
      asset_id: sl.asset_id || null,
      trigger_type: 'price_above',
      trigger_value: sellPrice,
      action: 'sell',
      quantity: sellQty,
      amount: sl.amount,
      new_avg_cost: null,
      notes: sl.notes || '',
    });
  }

  return plans;
}

/**
 * 参考价：优先最新行情价（路由层注入 latest_price），无行情时回退持仓成本。
 */
function referencePrice(holding) {
  const latest = Number(holding?.latest_price);
  if (Number.isFinite(latest) && latest > 0) return latest;
  const avg = Number(holding?.avg_cost);
  if (Number.isFinite(avg) && avg > 0) return avg;
  throw new Error('缺少可用参考价格（无行情缓存且无持仓成本），无法生成定投/价值平均计划');
}

/**
 * DCA 定投策略
 */
export function generateDCA(holding, params = {}) {
  const { frequency = 'weekly', amount_per = 1000, periods = 10 } = params;
  const refPrice = referencePrice(holding);
  const plans = [];
  for (let i = 0; i < periods; i++) {
    plans.push({
      seq: i + 1,
      trigger_type: 'time',
      trigger_value: i * (frequency === 'weekly' ? 7 : 1),
      action: 'buy',
      quantity: amount_per / refPrice,
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
  const perGridAmount = Number(params.amount_per) > 0
    ? Number(params.amount_per)
    : (Number(params.budget) > 0 ? Number(params.budget) / grids : 0);
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
      amount: perGridAmount,
      new_avg_cost: null,
      notes: `网格第${i + 1}档买入`,
    });
    plans.push({
      seq: ++seq,
      trigger_type: 'price_above',
      trigger_value: Math.round(sellPrice * 100) / 100,
      action: 'sell',
      // 卖单也带金额：执行链可按 成交价=金额/数量 推导数量，否则计划永远无法执行
      quantity: null,
      amount: perGridAmount,
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
  const refPrice = referencePrice(holding);
  const plans = [];
  for (let i = 0; i < periods; i++) {
    const t = target_value * Math.pow(1 + growth_rate, i + 1);
    const current = (Number(holding?.quantity || 0) * Number(holding?.avg_cost || 0)) * Math.pow(1 + growth_rate, i);
    const need = Math.max(0, t - current);
    plans.push({
      seq: i + 1,
      trigger_type: 'time',
      trigger_value: i * 30,
      action: need > 0 ? 'buy' : 'sell',
      quantity: need / refPrice,
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
