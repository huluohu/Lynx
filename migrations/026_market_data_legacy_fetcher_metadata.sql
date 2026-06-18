-- 026: mark built-in sources that are still executed by legacy fetchers

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

UPDATE market_source_capabilities
SET metadata_json = json_set(COALESCE(NULLIF(metadata_json, ''), '{}'), '$.execution', 'legacy_fetcher')
WHERE source_key IN ('neodata', 'swissquote', 'coingecko', 'binance', 'coinbase', 'kraken', 'okx', 'bitstamp', 'gemini');

