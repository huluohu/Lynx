INSERT OR IGNORE INTO market_sources (key, name, asset_class, source_type, enabled, priority) VALUES
  ('kucoin', 'KuCoin', 'crypto', 'builtin', 1, 80),
  ('gateio', 'Gate.io', 'crypto', 'builtin', 1, 85),
  ('bitget', 'Bitget', 'crypto', 'builtin', 1, 90),
  ('mexc', 'MEXC', 'crypto', 'builtin', 1, 95),
  ('defillama', 'DefiLlama', 'crypto', 'builtin', 1, 100),
  ('yahoo_metals', 'Yahoo Finance Metals', 'precious_metal', 'builtin', 1, 80);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('market_crypto_sources_enabled', 'stablecoin_peg,coingecko,binance,coinbase,kraken,okx,bitstamp,gemini,kucoin,gateio,bitget,mexc,defillama'),
  ('market_btc_sources_enabled', 'stablecoin_peg,coingecko,binance,coinbase,kraken,okx,bitstamp,gemini,kucoin,gateio,bitget,mexc,defillama'),
  ('market_precious_metal_sources_enabled', 'sge_sina,neodata,swissquote,yahoo_metals'),
  ('market_gold_sources_enabled', 'sge_sina,neodata,swissquote,yahoo_metals');

UPDATE settings SET value = CASE WHEN instr(',' || value || ',', ',kucoin,') > 0 THEN value ELSE value || ',kucoin' END WHERE key IN ('market_crypto_sources_enabled', 'market_btc_sources_enabled');
UPDATE settings SET value = CASE WHEN instr(',' || value || ',', ',gateio,') > 0 THEN value ELSE value || ',gateio' END WHERE key IN ('market_crypto_sources_enabled', 'market_btc_sources_enabled');
UPDATE settings SET value = CASE WHEN instr(',' || value || ',', ',bitget,') > 0 THEN value ELSE value || ',bitget' END WHERE key IN ('market_crypto_sources_enabled', 'market_btc_sources_enabled');
UPDATE settings SET value = CASE WHEN instr(',' || value || ',', ',mexc,') > 0 THEN value ELSE value || ',mexc' END WHERE key IN ('market_crypto_sources_enabled', 'market_btc_sources_enabled');
UPDATE settings SET value = CASE WHEN instr(',' || value || ',', ',defillama,') > 0 THEN value ELSE value || ',defillama' END WHERE key IN ('market_crypto_sources_enabled', 'market_btc_sources_enabled');
UPDATE settings SET value = CASE WHEN instr(',' || value || ',', ',yahoo_metals,') > 0 THEN value ELSE value || ',yahoo_metals' END WHERE key IN ('market_precious_metal_sources_enabled', 'market_gold_sources_enabled');

UPDATE asset_symbol_mappings
SET identifiers_json = json_set(COALESCE(identifiers_json, '{}'), '$.defillama', 'bitcoin')
WHERE asset_class = 'crypto' AND input_symbol = 'BTC';

UPDATE asset_symbol_mappings
SET identifiers_json = json_set(COALESCE(identifiers_json, '{}'), '$.defillama', 'ethereum')
WHERE asset_class = 'crypto' AND input_symbol = 'ETH';

UPDATE asset_symbol_mappings
SET identifiers_json = json_set(COALESCE(identifiers_json, '{}'), '$.yahoo_metals', 'GC=F')
WHERE asset_class = 'precious_metal' AND input_symbol = 'XAUUSD';

INSERT OR IGNORE INTO asset_symbol_mappings
  (asset_class, input_symbol, canonical_symbol, instrument_type, base_symbol, quote_currency, unit, market, exchange, region, identifiers_json, rules_json, priority)
VALUES
  ('precious_metal', 'XAGUSD', 'XAGUSD', 'spot', 'XAG', 'USD', 'oz', 'global_spot', NULL, 'global', '{"swissquote":"XAG/USD","yahoo_metals":"SI=F"}', '{}', 10),
  ('precious_metal', 'XPTUSD', 'XPTUSD', 'spot', 'XPT', 'USD', 'oz', 'global_spot', NULL, 'global', '{"swissquote":"XPT/USD","yahoo_metals":"PL=F"}', '{}', 10),
  ('precious_metal', 'XPDUSD', 'XPDUSD', 'spot', 'XPD', 'USD', 'oz', 'global_spot', NULL, 'global', '{"swissquote":"XPD/USD","yahoo_metals":"PA=F"}', '{}', 10);

INSERT OR IGNORE INTO market_source_capabilities
  (source_key, asset_class, instrument_type, markets_json, exchanges_json, regions_json, base_symbols_json, quote_currencies_json, units_json, identifiers_required_json, priority, metadata_json)
VALUES
  ('kucoin', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD","USDT"]', '["coin"]', '[]', 80, '{"execution":"configured_adapter"}'),
  ('gateio', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD","USDT"]', '["coin"]', '[]', 85, '{"execution":"configured_adapter"}'),
  ('bitget', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD","USDT"]', '["coin"]', '[]', 90, '{"execution":"configured_adapter"}'),
  ('mexc', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD","USDT"]', '["coin"]', '[]', 95, '{"execution":"configured_adapter"}'),
  ('defillama', 'crypto', 'spot', '["crypto_spot"]', NULL, '["global"]', NULL, '["USD"]', '["coin"]', '["coingecko"]', 100, '{"execution":"configured_adapter","aggregator":true}'),
  ('yahoo_metals', 'precious_metal', 'spot', '["global_spot"]', NULL, '["global"]', '["XAU","XAG","XPT","XPD"]', '["USD"]', '["oz"]', '["yahoo_metals"]', 80, '{"execution":"configured_adapter","fallback":"futures"}');

INSERT OR IGNORE INTO market_source_symbol_rules
  (source_key, asset_class, market, exchange, symbol_template, priority)
VALUES
  ('kucoin', 'crypto', 'crypto_spot', NULL, '{base_symbol}-USDT', 100),
  ('gateio', 'crypto', 'crypto_spot', NULL, '{base_symbol}_USDT', 100),
  ('bitget', 'crypto', 'crypto_spot', NULL, '{base_symbol}USDT', 100),
  ('mexc', 'crypto', 'crypto_spot', NULL, '{base_symbol}USDT', 100);

INSERT OR IGNORE INTO market_source_adapters
  (source_key, adapter_type, endpoint_template, method, headers_json, parser_type, parser_config_json, timeout_ms)
VALUES
  ('kucoin', 'json_http', 'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol={provider_symbol}', 'GET', '{}', 'json_path', '{"price_path":"data.price","currency":"USD","unit":"coin"}', 4500),
  ('gateio', 'json_http', 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair={provider_symbol}', 'GET', '{}', 'json_path', '{"price_path":"0.last","currency":"USD","unit":"coin"}', 4500),
  ('bitget', 'json_http', 'https://api.bitget.com/api/v2/spot/market/tickers?symbol={provider_symbol}', 'GET', '{}', 'json_path', '{"price_path":"data[0].lastPr","currency":"USD","unit":"coin"}', 4500),
  ('mexc', 'json_http', 'https://api.mexc.com/api/v3/ticker/24hr?symbol={provider_symbol}', 'GET', '{}', 'json_path', '{"price_path":"lastPrice","currency":"USD","unit":"coin"}', 4500),
  ('defillama', 'json_http', 'https://coins.llama.fi/prices/current/coingecko:{identifier.coingecko}', 'GET', '{}', 'json_path', '{"price_path":"coins.coingecko:{identifier.coingecko}.price","currency":"USD","unit":"coin"}', 4500),
  ('yahoo_metals', 'json_http', 'https://query2.finance.yahoo.com/v8/finance/chart/{provider_symbol}?range=1d&interval=1d', 'GET', '{"User-Agent":"Mozilla/5.0","Accept":"application/json"}', 'json_path', '{"price_path":"chart.result[0].meta.regularMarketPrice","currency_path":"chart.result[0].meta.currency","unit":"oz"}', 4500);
