import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateOutput,
  selfCheckConsistency,
  simulatePlanExecution,
  validatePlans,
} from '../services/agent-evaluator.js';

function asset(id, name, symbol, type, latestPrice, holding = null) {
  return {
    asset: { id, name, symbol, type },
    latestPrice,
    holding,
    priceHistory: [],
    transactions: [],
  };
}

const btc = asset(1, '比特币', 'BTC', 'crypto', 63000, { quantity: 0.2, avg_cost: 58000 });
const gold = asset(3, '黄金Au99.99', 'XAU', 'gold', 930, { quantity: 10, avg_cost: 880 });

test('selfCheckConsistency does not compare buy ladders across different assets', () => {
  const result = {
    plans: [
      { seq: 1, asset_id: 3, action: 'buy', trigger_type: 'price_below', trigger_value: 930, amount: 3000 },
      { seq: 2, asset_id: 3, action: 'buy', trigger_type: 'price_below', trigger_value: 925, amount: 3000 },
      { seq: 3, asset_id: 1, action: 'buy', trigger_type: 'price_below', trigger_value: 62000, amount: 2000 },
      { seq: 4, asset_id: 1, action: 'buy', trigger_type: 'price_below', trigger_value: 60000, amount: 2000 },
    ],
    analysis: {},
  };

  const check = selfCheckConsistency(result, { assets: [btc, gold] }, 'recovery');
  assert.equal(check.warnings.some(w => w.includes('62000') && w.includes('925')), false);
  assert.equal(check.consistent, true);
});

test('selfCheckConsistency still warns for increasing same-asset buy ladders', () => {
  const result = {
    plans: [
      { seq: 1, asset_id: 1, action: 'buy', trigger_type: 'price_below', trigger_value: 60000, amount: 2000 },
      { seq: 2, asset_id: 1, action: 'buy', trigger_type: 'price_below', trigger_value: 62000, amount: 2000 },
    ],
    analysis: {},
  };

  const check = selfCheckConsistency(result, { assets: [btc, gold] }, 'recovery');
  assert.equal(check.consistent, false);
  assert.equal(check.warnings.some(w => w.includes('比特币') && w.includes('62000') && w.includes('60000')), true);
});

test('validatePlans counts buy budget only and validates sell against holdings', () => {
  const plans = [
    { seq: 1, asset_id: 3, action: 'buy', trigger_type: 'price_below', trigger_value: 925, amount: 3000 },
    { seq: 2, asset_id: 3, action: 'sell', trigger_type: 'price_above', trigger_value: 950, amount: 5000 },
  ];

  const validation = validatePlans(plans, [btc, gold], 4000);
  assert.equal(validation.totalBuy, 3000);
  assert.equal(validation.budgetUsage, 0.75);
  assert.equal(validation.issues.some(i => i.type === 'budget_exceeded'), false);
  assert.equal(validation.issues.some(i => i.type === 'sell_exceeds_holding'), false);
});

test('validatePlans reports sell plans that exceed available holding', () => {
  const validation = validatePlans([
    { seq: 1, asset_id: 1, action: 'sell', trigger_type: 'price_above', trigger_value: 65000, quantity: 1 },
  ], [btc, gold], 10000);

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(i => i.type === 'sell_exceeds_holding'), true);
});

test('validatePlans reports unknown assets and allows non-price time triggers', () => {
  const validation = validatePlans([
    { seq: 1, asset_id: 999, action: 'buy', trigger_type: 'time', trigger_value: '2026-07-01', amount: 1000 },
  ], [btc, gold], 10000);

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(i => i.type === 'unknown_plan_asset'), true);
  assert.equal(validation.issues.some(i => i.type === 'invalid_trigger'), false);
});

test('simulatePlanExecution keeps sell plans out of committed buy budget', () => {
  const simulation = simulatePlanExecution([
    { seq: 1, asset_id: 3, action: 'buy', trigger_type: 'price_below', trigger_value: 925, amount: 3000 },
    { seq: 2, asset_id: 3, action: 'sell', trigger_type: 'price_above', trigger_value: 950, amount: 5000 },
  ], [btc, gold], 4000);

  assert.equal(simulation.committed_buy, 3000);
  assert.equal(simulation.budget_usage, 0.75);
  assert.equal(simulation.valid, true);
});

test('evaluateOutput budget usage excludes sell plans', () => {
  const evaluation = evaluateOutput({
    analysis: { market_assessment: 'neutral', asset_analyses: [{}], confidence_level: 0.7 },
    risk_management: { max_loss_tolerance: 0.1 },
    reasoning: 'This strategy keeps buys within cash budget while using sells only for position management.',
    plans: [
      { seq: 1, asset_id: 3, action: 'buy', trigger_type: 'price_below', trigger_value: 925, amount: 3000, rationale: 'entry' },
      { seq: 2, asset_id: 3, action: 'sell', trigger_type: 'price_above', trigger_value: 950, amount: 5000, rationale: 'take profit' },
    ],
  }, { assets: [btc, gold] }, 4000);

  assert.equal(evaluation.budget_usage, 0.75);
});
