-- 012: backfill runtime setting defaults used by UI and services

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('market_color_scheme', 'green-up-red-down'),
  ('strategy_monitor_interval', '5'),
  ('signal_valid_hours', '24'),
  ('news_auto_cache', 'true'),
  ('news_cache_batch_size', '5'),
  ('push_enabled', 'true'),
  ('push_webhook_type', 'wecom'),
  ('push_webhook_url', '');
