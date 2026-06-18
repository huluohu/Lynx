-- 023: market source health and custom HTTP quote sources

CREATE TABLE IF NOT EXISTS market_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL DEFAULT 'all', -- crypto/precious_metal/all
  source_type TEXT NOT NULL DEFAULT 'builtin', -- builtin/custom_http
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 100,
  config_json TEXT,
  timeout_ms INTEGER DEFAULT 5000,
  cooldown_until TEXT,
  last_success_at TEXT,
  last_error_at TEXT,
  last_error TEXT,
  fail_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO market_sources (key, name, asset_class, source_type, enabled, priority) VALUES
  ('coingecko', 'CoinGecko', 'crypto', 'builtin', 1, 10),
  ('binance', 'Binance', 'crypto', 'builtin', 1, 20),
  ('coinbase', 'Coinbase', 'crypto', 'builtin', 1, 30),
  ('kraken', 'Kraken', 'crypto', 'builtin', 1, 40),
  ('okx', 'OKX', 'crypto', 'builtin', 1, 50),
  ('bitstamp', 'Bitstamp', 'crypto', 'builtin', 1, 60),
  ('gemini', 'Gemini', 'crypto', 'builtin', 1, 70),
  ('neodata', 'Tencent Finance neodata', 'precious_metal', 'builtin', 1, 10),
  ('swissquote', 'Swissquote', 'precious_metal', 'builtin', 1, 20);

