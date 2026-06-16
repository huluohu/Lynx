/**
 * Agent Evaluator — quality scoring, plan validation, auto-fix, self-consistency checks.
 *
 * Four pillars:
 *  1. scoreDataQuality  — how complete/fresh is the input context?
 *  2. validatePlans     — do plans satisfy price/budget/completeness constraints?
 *  3. autoFixPlans      — deterministically fix common issues before saving
 *  4. evaluateOutput    — overall output quality score + structured issues
 */

// ============================================================
// 1. Data Quality Scoring
// ============================================================

/**
 * Score context data quality on a 0–1 scale.
 * Used to warn users when the Agent is operating with thin data.
 */
export function scoreDataQuality(collectedData) {
  const { assets, recentNews, macroIndicators } = collectedData;
  let score = 0;
  let maxScore = 0;

  for (const a of assets) {
    // Holding data
    maxScore += 1;
    if (a.holding && a.holding.quantity > 0) score += 1;

    // Current price
    maxScore += 1;
    if (a.latestPrice) score += 1;

    // Price history depth
    maxScore += 2;
    if (a.priceHistory.length >= 20) score += 2;
    else if (a.priceHistory.length >= 7) score += 1.5;
    else if (a.priceHistory.length >= 3) score += 1;
    else if (a.priceHistory.length >= 1) score += 0.5;

    // Transaction history
    maxScore += 1;
    if (a.transactions.length >= 10) score += 1;
    else if (a.transactions.length >= 3) score += 0.7;
    else if (a.transactions.length >= 1) score += 0.3;

    // Volatility indicators (computed from price history)
    maxScore += 1;
    if (a.indicators?.volatility != null) score += 1;
    else if (a.priceHistory.length >= 5) score += 0.5;
  }

  // News data
  maxScore += 2;
  if (recentNews.length >= 8) score += 2;
  else if (recentNews.length >= 3) score += 1.5;
  else if (recentNews.length >= 1) score += 1;

  // Macro indicators
  maxScore += 1;
  if (Object.keys(macroIndicators || {}).length > 0) score += 1;

  const raw = maxScore > 0 ? score / maxScore : 0.5;
  return Math.min(1, Math.round(raw * 100) / 100);
}

/**
 * Compute technical indicators from price history.
 * Returns { sma7, sma20, volatility, momentum5, priceChange30d }
 */
export function computeIndicators(priceHistory) {
  if (!priceHistory || priceHistory.length < 2) return {};
  const prices = priceHistory.map(p => Number(p.price)).filter(Number.isFinite);
  if (prices.length < 2) return {};

  const last = prices[prices.length - 1];
  const first = prices[0];

  // SMA
  const sma = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const sma7 = prices.length >= 7 ? sma(prices.slice(-7)) : sma(prices);
  const sma20 = prices.length >= 20 ? sma(prices.slice(-20)) : sma(prices);

  // Volatility: std dev of daily returns (annualized approx)
  let volatility = null;
  if (prices.length >= 5) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    volatility = Math.round(Math.sqrt(variance) * 100 * 100) / 100; // in %
  }

  // 5-day momentum
  const momentum5 = prices.length >= 5
    ? Math.round(((last - prices[prices.length - 5]) / prices[prices.length - 5]) * 10000) / 100
    : null;

  // 30-day price change
  const priceChange30d = first > 0
    ? Math.round(((last - first) / first) * 10000) / 100
    : null;

  return { sma7: Math.round(sma7 * 100) / 100, sma20: Math.round(sma20 * 100) / 100, volatility, momentum5, priceChange30d };
}

/**
 * Analyze transaction patterns (DCA frequency, avg size, buy/sell ratio).
 */
export function analyzeTransactionPatterns(transactions) {
  if (!transactions || transactions.length === 0) return {};
  const buys = transactions.filter(t => t.type === 'buy');
  const sells = transactions.filter(t => t.type === 'sell');

  const avgBuyPrice = buys.length > 0 ? buys.reduce((s, t) => s + Number(t.price), 0) / buys.length : null;
  const avgBuyAmount = buys.length > 0 ? buys.reduce((s, t) => s + Number(t.amount || t.price * t.quantity || 0), 0) / buys.length : null;

  // Avg interval between trades (days)
  let avgIntervalDays = null;
  if (transactions.length >= 2) {
    const sorted = [...transactions].sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at));
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      const ms = new Date(sorted[i].executed_at) - new Date(sorted[i - 1].executed_at);
      if (ms > 0) intervals.push(ms / (1000 * 86400));
    }
    if (intervals.length > 0) {
      avgIntervalDays = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length * 10) / 10;
    }
  }

  return {
    buyCount: buys.length,
    sellCount: sells.length,
    avgBuyPrice: avgBuyPrice != null ? Math.round(avgBuyPrice * 100) / 100 : null,
    avgBuyAmount: avgBuyAmount != null ? Math.round(avgBuyAmount) : null,
    avgIntervalDays,
    buyRatio: transactions.length > 0 ? Math.round(buys.length / transactions.length * 100) / 100 : null,
  };
}

// ============================================================
// 2. Plan Validation
// ============================================================

/**
 * Validate plans against budget and price constraints.
 * Returns { valid, issues, totalBuy, budgetUsage }
 */
export function validatePlans(plans, assets, budget) {
  const issues = [];
  const assetMap = {};
  for (const a of assets) assetMap[a.asset.id] = a;

  // Budget check
  const totalBuy = plans
    .filter(p => p.action === 'buy' && p.amount)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  if (totalBuy > budget * 1.05) {
    issues.push({
      type: 'budget_exceeded',
      severity: 'error',
      message: `买入总额 ¥${totalBuy.toFixed(0)} 超出预算 ¥${budget}（超出 ${((totalBuy / budget - 1) * 100).toFixed(1)}%）`,
    });
  }

  for (const plan of plans) {
    const a = assetMap[plan.asset_id];
    const currentPrice = a?.latestPrice;
    const avgCost = a?.holding?.avg_cost;
    const seq = plan.seq || '?';

    // Missing amount/quantity
    if (!plan.amount && !plan.quantity) {
      issues.push({ type: 'missing_amount', severity: 'error', message: `第${seq}步：缺少金额或数量` });
    }

    // Missing trigger
    if (!plan.trigger_type || plan.trigger_value == null) {
      issues.push({ type: 'missing_trigger', severity: 'error', message: `第${seq}步：缺少触发条件` });
      continue;
    }

    const tv = Number(plan.trigger_value);
    if (!Number.isFinite(tv) || tv <= 0) {
      issues.push({ type: 'invalid_trigger', severity: 'error', message: `第${seq}步：触发价格无效 (${plan.trigger_value})` });
      continue;
    }

    // Buy price warnings
    if (plan.action === 'buy' && currentPrice && plan.trigger_type === 'price_below') {
      if (tv > currentPrice * 1.02) {
        issues.push({ type: 'buy_above_market', severity: 'warning', message: `第${seq}步：买入触发价 ¥${tv} 高于当前价 ¥${currentPrice.toFixed(2)}，可能立即成交` });
      }
    }

    // Sell price warnings
    if (plan.action === 'sell' && avgCost && tv < avgCost * 0.95) {
      issues.push({ type: 'sell_below_cost', severity: 'warning', message: `第${seq}步：卖出触发价 ¥${tv} 明显低于成本价 ¥${avgCost.toFixed(2)}（可能亏损）` });
    }

    // Zero or negative trigger value
    if (tv <= 0) {
      issues.push({ type: 'zero_trigger', severity: 'error', message: `第${seq}步：触发价格必须大于0` });
    }
  }

  const budgetUsage = budget > 0 ? totalBuy / budget : 0;
  return {
    valid: !issues.some(i => i.severity === 'error'),
    issues,
    totalBuy,
    budgetUsage,
  };
}

// ============================================================
// 3. Auto-Fix
// ============================================================

/**
 * Deterministically fix common plan issues.
 * Returns { plans: fixedPlans, fixLog: string[] }
 */
export function autoFixPlans(plans, assets, budget) {
  if (!Array.isArray(plans) || plans.length === 0) return { plans, fixLog: [] };

  const assetMap = {};
  for (const a of assets) assetMap[a.asset.id] = a;
  const fixLog = [];

  let fixed = plans.map(p => ({ ...p }));

  // Numeric coercion
  for (const p of fixed) {
    if (p.trigger_value != null) p.trigger_value = Number(p.trigger_value) || p.trigger_value;
    if (p.quantity != null)      p.quantity = Number(p.quantity) || null;
    if (p.amount != null)        p.amount = Number(p.amount) || null;
    if (p.new_avg_cost != null)  p.new_avg_cost = Number(p.new_avg_cost) || null;
    if (p.seq != null)           p.seq = Math.max(1, Math.round(Number(p.seq) || 1));
  }

  // Budget cap: proportionally scale down if overspent
  const totalBuy = fixed.filter(p => p.action === 'buy' && p.amount).reduce((s, p) => s + p.amount, 0);
  if (totalBuy > budget * 1.01 && budget > 0) {
    const scale = budget / totalBuy;
    for (const p of fixed) {
      if (p.action === 'buy' && p.amount) {
        const old = p.amount;
        p.amount = Math.round(p.amount * scale);
        if (p.amount !== old) fixLog.push(`第${p.seq}步买入金额缩减: ¥${old} → ¥${p.amount}`);
      }
    }
  }

  // Drop plans with clearly invalid trigger values
  fixed = fixed.filter(p => {
    const tv = Number(p.trigger_value);
    if (!Number.isFinite(tv) || tv <= 0) {
      fixLog.push(`第${p.seq}步因触发价无效被移除`);
      return false;
    }
    return true;
  });

  // Re-sequence
  fixed.forEach((p, i) => { p.seq = i + 1; });

  return { plans: fixed, fixLog };
}

// ============================================================
// 4. Output Quality Evaluation
// ============================================================

/**
 * Evaluate overall output quality.
 * Returns { score: 0-1, checks, issues, budget_usage, summary }
 */
export function evaluateOutput(result, collectedData, budget) {
  const { plans = [], analysis, strategy, risk_management } = result;
  const { assets } = collectedData;

  const checks = [];

  // C1: Plan count is reasonable
  const planCountOk = plans.length >= 1 && plans.length <= 25;
  checks.push({ name: 'plan_count', passed: planCountOk, weight: 0.08, detail: `${plans.length}个计划` });

  // C2: Budget usage in healthy range
  const totalBuy = plans.filter(p => p.action === 'buy' && p.amount).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const budgetUsage = budget > 0 ? totalBuy / budget : 0;
  const budgetOk = budgetUsage <= 1.02 && budgetUsage >= 0.05;
  checks.push({ name: 'budget_usage', passed: budgetOk, weight: 0.20, detail: `预算使用 ${(budgetUsage * 100).toFixed(0)}%` });

  // C3: Analysis completeness
  const analysisOk = Boolean(analysis?.market_assessment && analysis?.asset_analyses?.length >= 1);
  checks.push({ name: 'analysis_complete', passed: analysisOk, weight: 0.15 });

  // C4: Analysis has confidence level
  const confidenceOk = analysis?.confidence_level != null && Number(analysis.confidence_level) >= 0.3;
  checks.push({ name: 'analysis_confidence', passed: confidenceOk, weight: 0.07, detail: analysis?.confidence_level != null ? `置信度 ${Math.round(analysis.confidence_level * 100)}%` : '无' });

  // C5: Plans have rationale/notes
  const withRationale = plans.filter(p => p.rationale || p.notes).length;
  const rationaleOk = plans.length === 0 || withRationale / plans.length >= 0.5;
  checks.push({ name: 'plan_rationale', passed: rationaleOk, weight: 0.12, detail: `${withRationale}/${plans.length}条有依据` });

  // C6: Risk management present
  const riskOk = Boolean(risk_management?.max_loss_tolerance || risk_management?.stop_loss_triggers?.length);
  checks.push({ name: 'risk_management', passed: riskOk, weight: 0.13 });

  // C7: Strategy reasoning present
  const reasoningOk = Boolean(result.reasoning && result.reasoning.length > 50);
  checks.push({ name: 'reasoning', passed: reasoningOk, weight: 0.05 });

  // C8: Plan price constraints
  const validation = validatePlans(plans, assets, budget);
  const constraintsOk = validation.valid;
  checks.push({ name: 'price_constraints', passed: constraintsOk, weight: 0.20, detail: `${validation.issues.length}个问题` });

  const score = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);

  // Grade
  let grade;
  if (score >= 0.85) grade = 'A';
  else if (score >= 0.70) grade = 'B';
  else if (score >= 0.50) grade = 'C';
  else grade = 'D';

  return {
    score: Math.round(score * 100) / 100,
    grade,
    passed: checks.filter(c => c.passed).length,
    total: checks.length,
    checks,
    issues: validation.issues,
    budget_usage: Math.round(budgetUsage * 100) / 100,
  };
}

// ============================================================
// 5. Self-Consistency Check
// ============================================================

/**
 * Verify that the generated strategy is internally consistent:
 * - Plans reference assets that exist in the portfolio
 * - Buy/sell directions align with stated goal
 * - Plans are ordered logically (price-ordered buy lines for grid/recovery)
 *
 * Returns { consistent, warnings }
 */
export function selfCheckConsistency(result, collectedData, goal) {
  const { plans = [], analysis, strategy } = result;
  const { assets } = collectedData;
  const assetIds = new Set(assets.map(a => a.asset.id));
  const warnings = [];

  // Check 1: All plan asset_ids exist
  for (const p of plans) {
    if (p.asset_id && !assetIds.has(Number(p.asset_id))) {
      warnings.push(`计划第${p.seq}步引用了不存在的资产 ID ${p.asset_id}`);
    }
  }

  // Check 2: For recovery/grid, buy lines should be descending
  if (goal === 'recovery' || goal === 'balanced') {
    const buyLines = plans
      .filter(p => p.action === 'buy' && p.trigger_type === 'price_below')
      .map(p => Number(p.trigger_value));
    for (let i = 1; i < buyLines.length; i++) {
      if (buyLines[i] > buyLines[i - 1] * 1.01) {
        warnings.push(`买入计划第${i + 1}条触发价 ¥${buyLines[i]} 高于上一条 ¥${buyLines[i - 1]}，建议价格递减`);
        break;
      }
    }
  }

  // Check 3: Analysis sentiment vs plan direction
  const sentiment = analysis?.news_sentiment || '';
  if (sentiment.includes('偏空') || sentiment.includes('bearish')) {
    const heavyBuys = plans.filter(p => p.action === 'buy' && p.amount && p.amount > 10000);
    if (heavyBuys.length > 3 && goal !== 'rebalance') {
      warnings.push('资讯情绪偏空，但计划中有较多大额买入，请确认风险');
    }
  }

  // Check 4: No duplicate trigger values for same asset+action
  const seen = new Set();
  for (const p of plans) {
    const key = `${p.asset_id}_${p.action}_${p.trigger_value}`;
    if (seen.has(key)) {
      warnings.push(`第${p.seq}步与其他计划重复（相同资产/操作/触发价）`);
    }
    seen.add(key);
  }

  return { consistent: warnings.length === 0, warnings };
}
