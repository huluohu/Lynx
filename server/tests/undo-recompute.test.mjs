import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { applyTradeToHoldings, recomputeHoldingFromTrades } from '../services/holdings-service.js';

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE assets (
      id INTEGER PRIMARY KEY,
      name TEXT,
      symbol TEXT,
      type TEXT,
      icon TEXT,
      currency TEXT
    );
    CREATE TABLE holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      quantity REAL,
      avg_cost REAL,
      total_invested REAL,
      status TEXT,
      updated_at TEXT
    );
    CREATE TABLE trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      type TEXT,
      quantity REAL,
      price REAL,
      total REAL,
      fee REAL DEFAULT 0,
      executed_at TEXT,
      reverted INTEGER DEFAULT 0
    );
  `);
  return db;
}

function insertTrade(db, { type, quantity, price, total, fee = 0, executed_at }) {
  db.prepare(`INSERT INTO trade_history (asset_id, type, quantity, price, total, fee, executed_at)
    VALUES (1, ?, ?, ?, ?, ?, ?)`).run(type, quantity, price, total, fee, executed_at);
}

test('out-of-order undo of the first buy leaves remaining lot at its true cost', () => {
  const db = createDb();
  // 买 1@100，再买 1@200 → 持仓 2@均价150
  insertTrade(db, { type: 'buy', quantity: 1, price: 100, total: 100, executed_at: '2026-01-01 10:00:00' });
  insertTrade(db, { type: 'buy', quantity: 1, price: 200, total: 200, executed_at: '2026-01-02 10:00:00' });

  applyTradeToHoldings(db, { assetId: 1, type: 'buy', quantity: 1, amount: 100, price: 100 });
  applyTradeToHoldings(db, { assetId: 1, type: 'buy', quantity: 1, amount: 200, price: 200 });

  // 撤销第一笔买入：剩余 1 股的真实成本是 200，而不是旧算法算出的均价 150
  db.prepare("UPDATE trade_history SET reverted = 1 WHERE id = 1").run();
  const holding = recomputeHoldingFromTrades(db, 1);

  assert.equal(holding.quantity, 1);
  assert.equal(holding.total_invested, 200);
  assert.ok(Math.abs(holding.avg_cost - 200) < 1e-9, `avg_cost should be 200, got ${holding.avg_cost}`);
  assert.equal(holding.status, 'active');
});

test('undoing a sell restores the sold quantity at the average cost', () => {
  const db = createDb();
  db.prepare("INSERT INTO holdings (asset_id, quantity, avg_cost, total_invested, status) VALUES (1, 2, 100, 200, 'active')").run();
  insertTrade(db, { type: 'buy', quantity: 2, price: 100, total: 200, executed_at: '2026-01-01 10:00:00' });
  insertTrade(db, { type: 'sell', quantity: 1, price: 150, total: 150, executed_at: '2026-01-02 10:00:00' });
  // 模拟卖出后的持仓（1 股，成本 100）
  db.prepare("UPDATE holdings SET quantity = 1 WHERE asset_id = 1").run();

  // 撤销卖出 → 持仓回到 2 股、总投入 200
  db.prepare("UPDATE trade_history SET reverted = 1 WHERE id = 2").run();
  const holding = recomputeHoldingFromTrades(db, 1);

  assert.equal(holding.quantity, 2);
  assert.equal(holding.total_invested, 200);
  assert.ok(Math.abs(holding.avg_cost - 100) < 1e-9);
});

test('full undo of all buys closes the holding', () => {
  const db = createDb();
  db.prepare("INSERT INTO holdings (asset_id, quantity, avg_cost, total_invested, status) VALUES (1, 1, 100, 100, 'active')").run();
  insertTrade(db, { type: 'buy', quantity: 1, price: 100, total: 100, executed_at: '2026-01-01 10:00:00' });

  db.prepare("UPDATE trade_history SET reverted = 1 WHERE id = 1").run();
  const holding = recomputeHoldingFromTrades(db, 1);

  assert.equal(holding.quantity, 0);
  assert.equal(holding.total_invested, 0);
  assert.equal(holding.status, 'closed');
});
