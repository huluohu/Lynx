-- 021: compatible asset class/source extensions

ALTER TABLE assets ADD COLUMN subtype TEXT;
ALTER TABLE assets ADD COLUMN quote_currency TEXT;
ALTER TABLE assets ADD COLUMN unit TEXT;
ALTER TABLE assets ADD COLUMN provider_symbols TEXT;

UPDATE assets
SET subtype = CASE
	WHEN type = 'gold' THEN 'gold'
	WHEN type = 'crypto' AND upper(symbol) = 'BTC' THEN 'bitcoin'
	WHEN type = 'crypto' AND upper(symbol) = 'ETH' THEN 'ethereum'
	ELSE subtype
  END,
  quote_currency = COALESCE(quote_currency, currency),
  unit = CASE
	WHEN unit IS NOT NULL THEN unit
	WHEN type = 'gold' AND (upper(symbol) LIKE '%XAU%' OR currency = 'USD') THEN 'oz'
	WHEN type = 'gold' THEN 'g'
	WHEN type = 'crypto' THEN 'coin'
	WHEN type = 'stock' THEN 'share'
	ELSE 'unit'
  END;

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('market_crypto_sources_enabled', COALESCE((SELECT value FROM settings WHERE key = 'market_btc_sources_enabled'), 'coingecko,binance,coinbase,kraken,okx,bitstamp,gemini')),
  ('market_precious_metal_sources_enabled', COALESCE((SELECT value FROM settings WHERE key = 'market_gold_sources_enabled'), 'neodata,swissquote'));

