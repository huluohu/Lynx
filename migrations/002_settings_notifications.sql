-- 002: settings + notifications + user table

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('plan_triggered','plan_approaching','stop_loss','price_swing','trade_executed')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  asset_id INTEGER,
  plan_id INTEGER,
  channel TEXT DEFAULT 'web' CHECK(channel IN ('web','wechat','all')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','read')),
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
);

-- 默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('refresh_interval', '60'),
  ('price_alert_threshold', '2'),
  ('plan_approaching_pct', '5'),
  ('wechat_notify', 'true'),
  ('webpush_notify', 'true'),
  ('notify_plan_triggered', 'true'),
  ('notify_plan_approaching', 'false'),
  ('notify_stop_loss', 'true'),
  ('notify_price_swing', 'true'),
  ('notify_trade_executed', 'false');
