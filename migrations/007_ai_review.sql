CREATE TABLE IF NOT EXISTS strategy_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  review_type TEXT NOT NULL DEFAULT 'periodic',
  summary TEXT NOT NULL,
  performance_score INTEGER,
  deviation_analysis TEXT,
  recommendations TEXT,
  market_context TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS market_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  strength INTEGER NOT NULL DEFAULT 5,
  summary TEXT NOT NULL,
  indicators TEXT,
  ai_analysis TEXT,
  valid_until TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_strategy ON strategy_reviews(strategy_id);
CREATE INDEX IF NOT EXISTS idx_signals_asset ON market_signals(asset_id);
CREATE INDEX IF NOT EXISTS idx_signals_created ON market_signals(created_at);
