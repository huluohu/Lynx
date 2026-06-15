-- 004: configurable refresh intervals and data sources

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('news_refresh_interval', '30'),
  ('market_refresh_interval', '5'),
  ('rate_cache_duration', '60'),
  ('news_sources_enabled', 'coindesk,cointelegraph,coingecko');

-- Custom news sources table
CREATE TABLE IF NOT EXISTS custom_news_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type TEXT DEFAULT 'rss' CHECK(type IN ('rss')),
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
