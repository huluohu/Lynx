-- 022: remove legacy auto quote cache for non-BTC crypto assets
-- Before crypto quote fetching became asset-aware, every crypto asset could receive BTC quotes.
-- Keep manual/custom caches; only remove built-in automatic source rows for non-BTC crypto assets.

DELETE FROM price_cache
WHERE asset_id IN (
  SELECT id FROM assets
  WHERE type = 'crypto'
    AND upper(symbol) NOT IN ('BTC', 'XBT')
)
AND lower(COALESCE(source, '')) IN ('coingecko', 'binance', 'coinbase', 'kraken', 'okx', 'bitstamp', 'gemini', 'crypto');

