import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  downsampleOldPriceCache,
  purgeOldMarketSignals,
  purgeOldBacktestResults,
} from '../services/retention.js';

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      price REAL,
      currency TEXT,
      source TEXT,
      fetched_at TEXT
    );
    CREATE TABLE market_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      created_at TEXT
    );
    CREATE TABLE backtest_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER,
      created_at TEXT
    );
  `);
  return db;
}

test('price cache downsample keeps the last row per day for old data and all recent data', () => {
  const db = createDb();
  const insertAt = db.prepare(`INSERT INTO price_cache (asset_id, price, fetched_at)
    VALUES (1, ?, ?)`);
  // 60 天前：每个自然日 3 条（同日内 08/12/20 点），降采样后应每天留最后一笔（20 点那条）
  for (const offsetDays of [60, 59, 58]) {
    for (const [hour, price] of [['+8 hours', 101], ['+12 hours', 102], ['+20 hours', 103]]) {
      insertAt.run(price, db.prepare(`SELECT datetime('now', ? , 'start of day', ?) AS t`).get(`-${offsetDays} days`, hour).t);
    }
  }
  // 5 天前：全部保留
  for (const hour of ['+8 hours', '+12 hours', '+20 hours']) {
    insertAt.run(999, db.prepare(`SELECT datetime('now', '-5 days', 'start of day', ?) AS t`).get(hour).t);
  }

  downsampleOldPriceCache(db, 45);

  const oldKept = db.prepare('SELECT COUNT(*) AS c FROM price_cache WHERE price != 999').get().c;
  assert.equal(oldKept, 3, '60 天前的 9 条应降采样为每日最后一笔，共 3 条');
  const keptPrices = db.prepare('SELECT price FROM price_cache WHERE price != 999 ORDER BY fetched_at').all()
    .map(row => row.price);
  assert.deepEqual(keptPrices, [103, 103, 103], '每日应保留最后一笔（20 点）');

  const recent = db.prepare('SELECT COUNT(*) AS c FROM price_cache WHERE price = 999').get().c;
  assert.equal(recent, 3, '45 天内的数据不受影响');
});

test('market signals purge removes only rows older than the retention window', () => {
  const db = createDb();
  const insert = db.prepare("INSERT INTO market_signals (asset_id, created_at) VALUES (1, datetime('now', ?))");
  insert.run('-200 days');
  insert.run('-200 days');
  insert.run('-1 day');
  insert.run('+0 minutes');

  const deleted = purgeOldMarketSignals(db, 90);
  assert.equal(deleted, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM market_signals').get().c, 2);
});

test('backtest results keep the newest N per strategy', () => {
  const db = createDb();
  const insert = db.prepare('INSERT INTO backtest_results (strategy_id) VALUES (?)');
  for (let i = 0; i < 30; i++) insert.run(1);
  for (let i = 0; i < 5; i++) insert.run(2);

  purgeOldBacktestResults(db, 20);

  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM backtest_results WHERE strategy_id = 1').get().c, 20);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM backtest_results WHERE strategy_id = 2').get().c, 5);
});
