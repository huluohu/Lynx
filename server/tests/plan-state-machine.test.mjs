import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

// 必须在导入任何依赖数据库的模块之前设置 DB_PATH
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'lynx-plan-test-')), 'test.db');

const { runMigrations, getDb, closeDb } = await import('../db/database.js');
const { default: plansRouter } = await import('../routes/plans.js');
runMigrations();

const app = express();
app.use(express.json());
app.use('/api/plans', plansRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/plans`;

let seedCounter = 0;
function seedPlan({ status = 'pending', quantity = 10, action = 'buy', executed_quantity = 0 }) {
  const db = getDb();
  seedCounter += 1;
  const assetId = db.prepare(`INSERT INTO assets (name, symbol, type, currency) VALUES (?, ?, 'crypto', 'CNY')`)
    .run(`测试资产${seedCounter}`, `TEST${seedCounter}`).lastInsertRowid;
  const strategyId = db.prepare(`INSERT INTO strategies (name, type, asset_id, parameters) VALUES (?, 'grid', ?, '{}')`)
    .run(`测试策略${seedCounter}`, assetId).lastInsertRowid;
  const planSetId = db.prepare(`INSERT INTO plan_sets (strategy_id, source, status, version_no) VALUES (?, 'manual', 'active', 1)`)
    .run(strategyId).lastInsertRowid;
  const planId = db.prepare(`INSERT INTO trading_plans
    (strategy_id, plan_set_id, asset_id, seq, trigger_type, trigger_value, action, quantity, amount, status, executed_quantity, executed_amount)
    VALUES (?, ?, ?, 1, 'price_below', 100, ?, ?, 1000, ?, ?, 0)`)
    .run(strategyId, planSetId, assetId, action, quantity, status, executed_quantity).lastInsertRowid;
  const assetCurrency = db.prepare('SELECT currency FROM assets WHERE id = ?').get(assetId).currency;
  return { planId: Number(planId), assetId: Number(assetId), assetCurrency };
}

test('pending plan can be triggered', async () => {
  const { planId } = seedPlan({ status: 'pending' });
  const res = await fetch(`${base}/${planId}/trigger`, { method: 'POST' });
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.data.status, 'triggered');
});

test('executed plan cannot be re-triggered', async () => {
  const { planId } = seedPlan({ status: 'executed' });
  const res = await fetch(`${base}/${planId}/trigger`, { method: 'POST' });
  assert.equal(res.status, 400);
});

test('executed plan cannot be cancelled', async () => {
  const { planId } = seedPlan({ status: 'executed' });
  const res = await fetch(`${base}/${planId}/cancel`, { method: 'POST' });
  assert.equal(res.status, 400);
});

test('pending plan can still be cancelled', async () => {
  const { planId } = seedPlan({ status: 'pending' });
  const res = await fetch(`${base}/${planId}/cancel`, { method: 'POST' });
  assert.equal(res.status, 200);
});

test('executing the full remaining quantity with partial flag still completes the plan', async () => {
  const { planId } = seedPlan({ status: 'triggered', quantity: 10, action: 'buy' });
  const res = await fetch(`${base}/${planId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price: 90, quantity: 10, partial: true }),
  });
  const json = await res.json();
  assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(json)}`);
  assert.equal(json.data.plan.status, 'executed', '剩余量为 0 时不得卡在 partial 状态');
  assert.ok(Math.abs(json.data.plan.executed_quantity - 10) < 1e-9);
});

test('executing with a mismatched currency is rejected', async () => {
  const { planId } = seedPlan({ status: 'pending', quantity: 1, action: 'buy' });
  const res = await fetch(`${base}/${planId}/trigger`, { method: 'POST' });
  assert.equal(res.status, 200);
  const exec = await fetch(`${base}/${planId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price: 100, quantity: 1, currency: 'USD' }),
  });
  assert.equal(exec.status, 400);
});

test.after(() => {
  server.close();
  closeDb();
});
