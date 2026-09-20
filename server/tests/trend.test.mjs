import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { buildAssetProfitTrend } from '../services/trend.js';

function createTrendDb() {
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
      id INTEGER PRIMARY KEY,
      asset_id INTEGER,
      quantity REAL,
      avg_cost REAL,
      total_invested REAL,
      status TEXT,
      updated_at TEXT
    );
    CREATE TABLE price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      price REAL,
      currency TEXT,
      source TEXT,
      fetched_at TEXT
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

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function minutesAgoIso(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// 本地墙上时间字符串，模拟手工录入（datetime-local 表单）的存储格式
function minutesAgoLocal(minutes) {
  const date = new Date(Date.now() - minutes * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function insertTrade(db, { type = 'buy', quantity, price, total, fee = 0, executedAt }) {
  db.prepare(`INSERT INTO trade_history (asset_id, type, quantity, price, total, fee, executed_at, reverted)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(1, type, quantity, price, total, fee, executedAt);
}

function pointsNear(points, timeMs, toleranceMs = 60 * 1000) {
  return points.filter(point => Math.abs(new Date(point.t).getTime() - timeMs) < toleranceMs);
}

function seedAsset(db, { holdingInvested = 1653.75, holdingUpdatedAt = daysAgo(1) } = {}) {
  db.prepare('INSERT INTO assets VALUES (1, ?, ?, ?, ?, ?)').run('Test Asset', 'TST', 'stock', '📈', 'CNY');
  db.prepare("INSERT INTO holdings VALUES (1, 1, 15, ?, ?, 'active', ?)")
    .run(holdingInvested / 15, holdingInvested, holdingUpdatedAt);

  db.prepare(`INSERT INTO trade_history (asset_id, type, quantity, price, total, fee, executed_at, reverted)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(1, 'buy', 10, 100, 1000, 5, daysAgo(20));
  db.prepare(`INSERT INTO trade_history (asset_id, type, quantity, price, total, fee, executed_at, reverted)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(1, 'buy', 10, 120, 1200, 0, daysAgo(10));
  db.prepare(`INSERT INTO trade_history (asset_id, type, quantity, price, total, fee, executed_at, reverted)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)`).run(1, 'sell', 5, 130, 650, 2, daysAgo(5));

  for (const days of [25, 15, 8, 1]) {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source, fetched_at) VALUES (?, ?, ?, ?, ?)')
      .run(1, 100 + days, 'CNY', 'test', daysAgo(days));
  }
}

test('asset profit trend reconstructs invested cost with buy-side fees and sell cost basis', () => {
  const db = createTrendDb();
  seedAsset(db);

  const trend = buildAssetProfitTrend(db, 1, '1m');
  const investedValues = [...new Set(trend.points.map(point => Number(point.invested.toFixed(2))))];
  const quantityValues = [...new Set(trend.points.map(point => Number(point.quantity.toFixed(8))))];

  assert.ok(investedValues.includes(1005), `expected first buy cost 1005, got ${investedValues.join(',')}`);
  assert.ok(investedValues.includes(2205), `expected second buy cumulative cost 2205, got ${investedValues.join(',')}`);
  assert.equal(Number(trend.points.at(-1).invested.toFixed(2)), 1653.75);
  assert.equal(Number(trend.points.at(-1).avg_cost.toFixed(3)), 110.25);
  assert.deepEqual(quantityValues.filter(value => value > 0), [10, 20, 15]);
});

test('asset profit trend reconciles incomplete trade history to current holding at the end', () => {
  const db = createTrendDb();
  seedAsset(db, { holdingInvested: 1700, holdingUpdatedAt: daysAgo(2) });

  const trend = buildAssetProfitTrend(db, 1, '1m');
  const last = trend.points.at(-1);

  assert.equal(Number(last.quantity.toFixed(8)), 15);
  assert.equal(Number(last.invested.toFixed(2)), 1700);
  assert.equal(Number(last.avg_cost.toFixed(6)), Number((1700 / 15).toFixed(6)));
  assert.equal(last.estimated, true);
});

test('asset profit trend includes same-day ISO-format (plan) trades', () => {
  const db = createTrendDb();
  db.prepare('INSERT INTO assets VALUES (1, ?, ?, ?, ?, ?)').run('Test Asset', 'TST', 'stock', '📈', 'CNY');
  db.prepare("INSERT INTO holdings VALUES (1, 1, 3, 100, 300, 'active', ?)").run(daysAgo(0));
  // 5 天前手工买入（空格本地时间格式），约 31 分钟前计划执行买入（ISO 格式，plans.js 写入格式）
  insertTrade(db, { quantity: 1, price: 100, total: 100, executedAt: daysAgo(5) });
  insertTrade(db, { quantity: 2, price: 100, total: 200, executedAt: minutesAgoIso(31) });
  db.prepare('INSERT INTO price_cache (asset_id, price, currency, source, fetched_at) VALUES (?, ?, ?, ?, ?)')
    .run(1, 150, 'CNY', 'test', minutesAgoIso(120));

  const trend = buildAssetProfitTrend(db, 1, '1d');
  // 1d 范围按 30 分钟分桶，倒数第二个点位于约 30 分钟前的桶边界
  const boundary = trend.points.at(-2);
  const last = trend.points.at(-1);

  assert.equal(Number(boundary.quantity.toFixed(8)), 3, 'ISO trade must be applied at the last bucket boundary');
  assert.equal(Number(boundary.invested.toFixed(2)), 300);
  assert.equal(boundary.estimated, false);
  assert.equal(Number(last.quantity.toFixed(8)), 3);
  assert.equal(Number(last.invested.toFixed(2)), 300);
  assert.equal(last.estimated, false);
});

test('asset profit trend orders same-day mixed-format trades by wall-clock time', () => {
  const db = createTrendDb();
  db.prepare('INSERT INTO assets VALUES (1, ?, ?, ?, ?, ?)').run('Test Asset', 'TST', 'stock', '📈', 'CNY');
  db.prepare("INSERT INTO holdings VALUES (1, 1, 3, 100, 300, 'active', ?)").run(daysAgo(0));
  // 同一天内：100 分钟前手工买入（空格本地时间），70 分钟前计划买入（ISO）
  insertTrade(db, { quantity: 1, price: 100, total: 100, executedAt: minutesAgoLocal(100) });
  insertTrade(db, { quantity: 2, price: 100, total: 200, executedAt: minutesAgoIso(70) });
  db.prepare('INSERT INTO price_cache (asset_id, price, currency, source, fetched_at) VALUES (?, ?, ?, ?, ?)')
    .run(1, 150, 'CNY', 'test', minutesAgoIso(120));

  const trend = buildAssetProfitTrend(db, 1, '1d');
  // 30 分钟桶边界恰落在两笔交易之间（约 90 分钟前），此时只应计入第一笔
  const between = pointsNear(trend.points, Date.now() - 90 * 60 * 1000);
  assert.equal(between.length, 1, 'expected exactly one bucket boundary between the two trades');
  assert.equal(Number(between[0].quantity.toFixed(8)), 1);
  assert.equal(Number(between[0].invested.toFixed(2)), 100);

  const after = pointsNear(trend.points, Date.now() - 60 * 60 * 1000);
  assert.equal(after.length, 1);
  assert.equal(Number(after[0].quantity.toFixed(8)), 3);
  assert.equal(Number(after[0].invested.toFixed(2)), 300);
  assert.equal(Number(after[0].avg_cost.toFixed(6)), 100);
});

