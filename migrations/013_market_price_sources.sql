-- 013: split market price sources from news sources

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('market_btc_sources_enabled', 'coingecko,binance,coinbase,kraken,okx,bitstamp,gemini'),
  ('market_gold_sources_enabled', 'neodata,swissquote');

