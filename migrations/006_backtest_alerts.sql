-- 回测结果
CREATE TABLE IF NOT EXISTS backtest_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  initial_investment REAL,
  final_value REAL,
  total_return_pct REAL,
  max_drawdown_pct REAL,
  win_rate REAL,
  total_trades INTEGER,
  sharpe_ratio REAL,
  details TEXT, -- JSON: array of executed steps
  created_at TEXT DEFAULT (datetime('now'))
);

-- 提醒历史 (扩展notifications表，加strategy_id和severity字段)
ALTER TABLE notifications ADD COLUMN strategy_id INTEGER REFERENCES strategies(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN severity TEXT DEFAULT 'info' CHECK(severity IN ('info','warning','danger'));

CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy_id);
CREATE INDEX IF NOT EXISTS idx_notifications_strategy ON notifications(strategy_id);
