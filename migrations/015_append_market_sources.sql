-- 015: append additional free BTC fallback quote sources for existing installations

UPDATE settings
SET value = CASE
  WHEN instr(',' || value || ',', ',bitstamp,') = 0 AND instr(',' || value || ',', ',gemini,') = 0 THEN value || ',bitstamp,gemini'
  WHEN instr(',' || value || ',', ',bitstamp,') = 0 THEN value || ',bitstamp'
  WHEN instr(',' || value || ',', ',gemini,') = 0 THEN value || ',gemini'
  ELSE value
END,
updated_at = datetime('now')
WHERE key = 'market_btc_sources_enabled';

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('market_btc_sources_enabled', 'coingecko,binance,coinbase,kraken,okx,bitstamp,gemini');

