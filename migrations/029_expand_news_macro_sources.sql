-- 029: expand built-in news coverage beyond crypto into metals, macro, geopolitics, and China/domestic finance.

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('news_sources_available', 'coindesk,cointelegraph,decrypt,crypto_news,yahoo_finance,blockchain_news,panews,coingecko,bitcoin_magazine,kitco,fxstreet,bbc_business,bbc_world,cnbc_economy,cnbc_world,china_daily_business,china_daily_china,china_daily_world'),
  ('news_sources_enabled', 'coindesk,cointelegraph,decrypt,panews,coingecko,kitco,fxstreet,bbc_business,bbc_world,cnbc_economy,cnbc_world,china_daily_business,china_daily_china,china_daily_world');

UPDATE settings SET value = value || ',bbc_business'
WHERE key = 'news_sources_available' AND instr(',' || value || ',', ',bbc_business,') = 0;
UPDATE settings SET value = value || ',bbc_world'
WHERE key = 'news_sources_available' AND instr(',' || value || ',', ',bbc_world,') = 0;
UPDATE settings SET value = value || ',cnbc_economy'
WHERE key = 'news_sources_available' AND instr(',' || value || ',', ',cnbc_economy,') = 0;
UPDATE settings SET value = value || ',cnbc_world'
WHERE key = 'news_sources_available' AND instr(',' || value || ',', ',cnbc_world,') = 0;
UPDATE settings SET value = value || ',china_daily_business'
WHERE key = 'news_sources_available' AND instr(',' || value || ',', ',china_daily_business,') = 0;
UPDATE settings SET value = value || ',china_daily_china'
WHERE key = 'news_sources_available' AND instr(',' || value || ',', ',china_daily_china,') = 0;
UPDATE settings SET value = value || ',china_daily_world'
WHERE key = 'news_sources_available' AND instr(',' || value || ',', ',china_daily_world,') = 0;
UPDATE settings SET value = value || ',kitco'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',kitco,') = 0;
UPDATE settings SET value = value || ',decrypt'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',decrypt,') = 0;
UPDATE settings SET value = value || ',panews'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',panews,') = 0;
UPDATE settings SET value = value || ',fxstreet'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',fxstreet,') = 0;
UPDATE settings SET value = value || ',bbc_business'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',bbc_business,') = 0;
UPDATE settings SET value = value || ',bbc_world'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',bbc_world,') = 0;
UPDATE settings SET value = value || ',cnbc_economy'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',cnbc_economy,') = 0;
UPDATE settings SET value = value || ',cnbc_world'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',cnbc_world,') = 0;
UPDATE settings SET value = value || ',china_daily_business'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',china_daily_business,') = 0;
UPDATE settings SET value = value || ',china_daily_china'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',china_daily_china,') = 0;
UPDATE settings SET value = value || ',china_daily_world'
WHERE key = 'news_sources_enabled' AND instr(',' || value || ',', ',china_daily_world,') = 0;

