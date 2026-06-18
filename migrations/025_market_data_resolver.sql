-- 025: configuration-driven market data resolver

CREATE TABLE IF NOT EXISTS market_asset_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER UNIQUE,
  asset_class TEXT NOT NULL,
  instrument_type TEXT,
  base_symbol TEXT,
  quote_currency TEXT,
  unit TEXT,
  market TEXT,
  exchange TEXT,
  region TEXT,
  canonical_symbol TEXT,
  identifiers_json TEXT,
  rules_json TEXT,
  profile_source TEXT DEFAULT 'configured',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_symbol_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_class TEXT NOT NULL,
  input_symbol TEXT NOT NULL,
  canonical_symbol TEXT,
  instrument_type TEXT,
  base_symbol TEXT,
  quote_currency TEXT,
  unit TEXT,
  market TEXT,
  exchange TEXT,
  region TEXT,
  identifiers_json TEXT,
  rules_json TEXT,
  priority INTEGER DEFAULT 100,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_symbol_mappings_unique
  ON asset_symbol_mappings(asset_class, input_symbol, priority);

CREATE TABLE IF NOT EXISTS market_source_capabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  instrument_type TEXT,
  markets_json TEXT,
  exchanges_json TEXT,
  regions_json TEXT,
  base_symbols_json TEXT,
  quote_currencies_json TEXT,
  units_json TEXT,
  identifiers_required_json TEXT,
  priority INTEGER DEFAULT 100,
  enabled INTEGER DEFAULT 1,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_source_capabilities_lookup
  ON market_source_capabilities(source_key, asset_class, enabled, priority);

CREATE TABLE IF NOT EXISTS market_source_symbol_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  market TEXT,
  exchange TEXT,
  symbol_template TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_source_symbol_rules_lookup
  ON market_source_symbol_rules(source_key, asset_class, enabled, priority);

CREATE TABLE IF NOT EXISTS market_source_adapters (
  source_key TEXT PRIMARY KEY,
  adapter_type TEXT NOT NULL,
  endpoint_template TEXT,
  method TEXT DEFAULT 'GET',
  headers_json TEXT,
  parser_type TEXT NOT NULL,
  parser_config_json TEXT,
  timeout_ms INTEGER DEFAULT 5000,
  requires_proxy INTEGER DEFAULT 0,
  dependency_json TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS market_source_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT,
  asset_id INTEGER,
  symbol TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  latency_ms INTEGER,
  quote_price REAL,
  quote_currency TEXT,
  quote_unit TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS market_rule_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_kind TEXT NOT NULL,
  rule_id TEXT,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  operator TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO market_sources (key, name, asset_class, source_type, enabled, priority) VALUES
  ('stablecoin_peg', 'Stablecoin Peg Resolver', 'crypto', 'builtin', 1, 1),
  ('sge_sina', 'Sina SGE', 'precious_metal', 'builtin', 1, 5),
  ('neodata', 'Tencent Finance neodata', 'precious_metal', 'builtin', 1, 10),
  ('swissquote', 'Swissquote', 'precious_metal', 'builtin', 1, 20),
  ('coingecko', 'CoinGecko', 'crypto', 'builtin', 1, 10),
  ('binance', 'Binance', 'crypto', 'builtin', 1, 20),
  ('coinbase', 'Coinbase', 'crypto', 'builtin', 1, 30),
  ('kraken', 'Kraken', 'crypto', 'builtin', 1, 40),
  ('okx', 'OKX', 'crypto', 'builtin', 1, 50),
  ('bitstamp', 'Bitstamp', 'crypto', 'builtin', 1, 60),
  ('gemini', 'Gemini', 'crypto', 'builtin', 1, 70);

UPDATE settings
SET value = CASE
  WHEN instr(',' || value || ',', ',stablecoin_peg,') > 0 THEN value
  ELSE 'stablecoin_peg,' || value
END
WHERE key = 'market_crypto_sources_enabled';

UPDATE settings
SET value = CASE
  WHEN instr(',' || value || ',', ',sge_sina,') > 0 THEN value
  ELSE 'sge_sina,' || value
END
WHERE key = 'market_precious_metal_sources_enabled';

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('market_crypto_sources_enabled', 'stablecoin_peg,coingecko,binance,coinbase,kraken,okx,bitstamp,gemini'),
  ('market_precious_metal_sources_enabled', 'sge_sina,neodata,swissquote');

INSERT OR IGNORE INTO asset_symbol_mappings
  (asset_class, input_symbol, canonical_symbol, instrument_type, base_symbol, quote_currency, unit, market, exchange, region, identifiers_json, rules_json, priority)
VALUES
  ('precious_metal', 'AU9999', 'AU9999', 'exchange_spot', 'XAU', 'CNY', 'g', 'SGE', 'SGE', 'CN', '{"sge_sina":"SGE_AU9999","neodata":"AU9999"}', '{}', 10),
  ('precious_metal', 'XAUUSD', 'XAUUSD', 'spot', 'XAU', 'USD', 'oz', 'global_spot', NULL, 'global', '{"swissquote":"XAU/USD","neodata":"AUUSDO"}', '{}', 10),
  ('crypto', 'USDT', 'USDT', 'stablecoin', 'USDT', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"stablecoin_peg":"USDT"}', '{"peg_currency":"USD","peg_price":1,"depeg_threshold":0.01}', 10),
  ('crypto', 'USDC', 'USDC', 'stablecoin', 'USDC', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"stablecoin_peg":"USDC"}', '{"peg_currency":"USD","peg_price":1,"depeg_threshold":0.01}', 10),
  ('crypto', 'DAI', 'DAI', 'stablecoin', 'DAI', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"stablecoin_peg":"DAI"}', '{"peg_currency":"USD","peg_price":1,"depeg_threshold":0.01}', 10),
  ('crypto', 'BUSD', 'BUSD', 'stablecoin', 'BUSD', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"stablecoin_peg":"BUSD"}', '{"peg_currency":"USD","peg_price":1,"depeg_threshold":0.01}', 10),
  ('crypto', 'FDUSD', 'FDUSD', 'stablecoin', 'FDUSD', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"stablecoin_peg":"FDUSD"}', '{"peg_currency":"USD","peg_price":1,"depeg_threshold":0.01}', 10),
  ('crypto', 'TUSD', 'TUSD', 'stablecoin', 'TUSD', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"stablecoin_peg":"TUSD"}', '{"peg_currency":"USD","peg_price":1,"depeg_threshold":0.01}', 10),
  ('crypto', 'USDP', 'USDP', 'stablecoin', 'USDP', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"stablecoin_peg":"USDP"}', '{"peg_currency":"USD","peg_price":1,"depeg_threshold":0.01}', 10),
  ('crypto', 'BTC', 'BTC', 'spot', 'BTC', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"coingecko":"bitcoin","binance":"BTCUSDT","coinbase":"BTC-USD","kraken":"XBTUSD","okx":"BTC-USDT","bitstamp":"btcusd","gemini":"BTCUSD"}', '{}', 10),
  ('crypto', 'ETH', 'ETH', 'spot', 'ETH', 'USD', 'coin', 'crypto_spot', NULL, 'global', '{"coingecko":"ethereum","binance":"ETHUSDT","coinbase":"ETH-USD","kraken":"ETHUSD","okx":"ETH-USDT","bitstamp":"ethusd","gemini":"ETHUSD"}', '{}', 10);

INSERT OR IGNORE INTO market_source_capabilities
  (source_key, asset_class, instrument_type, markets_json, exchanges_json, regions_json, base_symbols_json, quote_currencies_json, units_json, identifiers_required_json, priority, metadata_json)
VALUES
  ('stablecoin_peg', 'crypto', 'stablecoin', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD"]', '["coin"]', '["stablecoin_peg"]', 1, '{"deterministic":true}'),
  ('sge_sina', 'precious_metal', 'exchange_spot', '["SGE"]', '["SGE"]', '["CN"]', '["XAU"]', '["CNY"]', '["g","gram"]', '["sge_sina"]', 5, '{"role":"public_fallback"}'),
  ('neodata', 'precious_metal', NULL, '["SGE","global_spot"]', NULL, '["CN","global"]', '["XAU"]', '["CNY","USD"]', '["g","oz"]', '["neodata"]', 10, '{"requires_proxy":true,"execution":"legacy_fetcher"}'),
  ('swissquote', 'precious_metal', 'spot', '["global_spot"]', NULL, '["global"]', '["XAU","XAG","XPT","XPD"]', '["USD"]', '["oz"]', '["swissquote"]', 20, '{"role":"primary_global_spot","execution":"legacy_fetcher"}'),
  ('coingecko', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD"]', '["coin"]', '["coingecko"]', 10, '{"execution":"legacy_fetcher"}'),
  ('binance', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD","USDT"]', '["coin"]', '["binance"]', 20, '{"execution":"legacy_fetcher"}'),
  ('coinbase', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD"]', '["coin"]', '["coinbase"]', 30, '{"execution":"legacy_fetcher"}'),
  ('kraken', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD"]', '["coin"]', '["kraken"]', 40, '{"execution":"legacy_fetcher"}'),
  ('okx', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD","USDT"]', '["coin"]', '["okx"]', 50, '{"execution":"legacy_fetcher"}'),
  ('bitstamp', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD"]', '["coin"]', '["bitstamp"]', 60, '{"execution":"legacy_fetcher"}'),
  ('gemini', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD"]', '["coin"]', '["gemini"]', 70, '{"execution":"legacy_fetcher"}');

INSERT OR IGNORE INTO market_source_symbol_rules
  (source_key, asset_class, market, exchange, symbol_template, priority)
VALUES
  ('sge_sina', 'precious_metal', 'SGE', 'SGE', 'SGE_{canonical_symbol}', 100),
  ('swissquote', 'precious_metal', 'global_spot', NULL, '{base_symbol}/USD', 100),
  ('coingecko', 'crypto', 'crypto_spot', NULL, '{base_symbol}', 100),
  ('binance', 'crypto', 'crypto_spot', NULL, '{base_symbol}USDT', 100),
  ('coinbase', 'crypto', 'crypto_spot', NULL, '{base_symbol}-USD', 100),
  ('kraken', 'crypto', 'crypto_spot', NULL, '{base_symbol}USD', 100),
  ('okx', 'crypto', 'crypto_spot', NULL, '{base_symbol}-USDT', 100),
  ('bitstamp', 'crypto', 'crypto_spot', NULL, '{base_symbol}usd', 100),
  ('gemini', 'crypto', 'crypto_spot', NULL, '{base_symbol}USD', 100);

INSERT OR IGNORE INTO market_source_adapters
  (source_key, adapter_type, endpoint_template, method, headers_json, parser_type, parser_config_json, timeout_ms)
VALUES
  ('stablecoin_peg', 'stable_peg', NULL, 'GET', '{}', 'stable_peg', '{}', 1000),
  ('sge_sina', 'text_http', 'https://hq.sinajs.cn/list={provider_symbol}', 'GET', '{"Referer":"https://finance.sina.com.cn/"}', 'sina_hq_csv', '{"encoding":"gb18030","price_index":3,"name_index":1,"timestamp_index":16,"currency":"CNY","unit":"g"}', 4500);


