-- 投资规划系统 初始 Schema
-- Migration: 001_initial

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ===== 资产定义 =====
CREATE TABLE IF NOT EXISTS assets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  symbol        TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL,           -- gold/crypto/stock/forex/commodity
  currency      TEXT DEFAULT 'CNY',
  icon          TEXT,
  data_source   TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 持仓 =====
CREATE TABLE IF NOT EXISTS holdings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  quantity        REAL NOT NULL,
  avg_cost        REAL NOT NULL,
  total_invested  REAL NOT NULL,
  target_weight   REAL,
  target_price    REAL,
  stop_loss       REAL,
  notes           TEXT,
  opened_at       TEXT DEFAULT (datetime('now')),
  status          TEXT DEFAULT 'active',   -- active/closed
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- ===== 交易记录 =====
CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id      INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,            -- buy/sell/dividend
  quantity      REAL NOT NULL,
  price         REAL NOT NULL,
  total         REAL NOT NULL,
  fee           REAL DEFAULT 0,
  executed_at   TEXT NOT NULL,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 策略 =====
CREATE TABLE IF NOT EXISTS strategies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL,            -- dca/grid/value_avg/recovery
  asset_id      INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  parameters    TEXT NOT NULL,            -- JSON
  status        TEXT DEFAULT 'draft',     -- draft/active/paused/closed
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 操盘计划 =====
CREATE TABLE IF NOT EXISTS trading_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id   INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
  asset_id      INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  seq           INTEGER,
  trigger_type  TEXT NOT NULL,
  trigger_value REAL NOT NULL,
  action        TEXT NOT NULL,            -- buy/sell
  quantity      REAL,
  amount        REAL,
  new_avg_cost  REAL,
  status        TEXT DEFAULT 'pending',   -- pending/triggered/executed/cancelled
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 价格缓存 =====
CREATE TABLE IF NOT EXISTS price_cache (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id      INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price         REAL NOT NULL,
  currency      TEXT DEFAULT 'CNY',
  source        TEXT,
  fetched_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 资讯 =====
CREATE TABLE IF NOT EXISTS news (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  summary       TEXT,
  url           TEXT,
  source        TEXT,
  asset_id      INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  published_at  TEXT,
  read          INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 操盘历史 =====
CREATE TABLE IF NOT EXISTS trade_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id      INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  quantity      REAL,
  price         REAL,
  total         REAL,
  pnl           REAL,
  pnl_pct       REAL,
  executed_at   TEXT,
  reason        TEXT,
  tags          TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 系统配置 =====
CREATE TABLE IF NOT EXISTS config (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL
);

-- ===== 索引 =====
CREATE INDEX IF NOT EXISTS idx_holdings_asset ON holdings(asset_id);
CREATE INDEX IF NOT EXISTS idx_transactions_asset ON transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(executed_at);
CREATE INDEX IF NOT EXISTS idx_trading_plans_asset ON trading_plans(asset_id);
CREATE INDEX IF NOT EXISTS idx_trading_plans_strategy ON trading_plans(strategy_id);
CREATE INDEX IF NOT EXISTS idx_price_cache_asset ON price_cache(asset_id);
CREATE INDEX IF NOT EXISTS idx_news_asset ON news(asset_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_asset ON trade_history(asset_id);

-- ===== 种子数据 =====
INSERT OR IGNORE INTO config (key, value) VALUES ('app_version', '1.0.0');
INSERT OR IGNORE INTO config (key, value) VALUES ('default_currency', 'CNY');
INSERT OR IGNORE INTO config (key, value) VALUES ('usd_cny_rate', '6.77');

-- 种子资产
INSERT OR IGNORE INTO assets (id, name, symbol, type, currency, icon, data_source)
VALUES (1, '黄金Au99.99', 'AU9999', 'gold', 'CNY', '🥇', 'neodata');

INSERT OR IGNORE INTO assets (id, name, symbol, type, currency, icon, data_source)
VALUES (2, '伦敦金', 'XAUUSD', 'gold', 'USD', '🏅', 'neodata');

INSERT OR IGNORE INTO assets (id, name, symbol, type, currency, icon, data_source)
VALUES (3, '比特币', 'BTC', 'crypto', 'USD', '₿', 'coingecko');

-- 种子持仓
INSERT OR IGNORE INTO holdings (id, asset_id, quantity, avg_cost, total_invested, target_price, stop_loss, status, notes)
VALUES (1, 1, 30, 1127.65, 33830, 980, 850, 'active', '初始建仓');

INSERT OR IGNORE INTO holdings (id, asset_id, quantity, avg_cost, total_invested, target_price, stop_loss, status, notes)
VALUES (2, 3, 0.0216, 679543, 14678, 92000, 45000, 'active', '初始建仓');
