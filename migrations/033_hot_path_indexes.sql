-- Hot-path indexes for dashboard, market, signals, and notification pages.
CREATE INDEX IF NOT EXISTS idx_market_signals_asset_latest
  ON market_signals(asset_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_market_signals_created_latest
  ON market_signals(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_status_created
  ON notifications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_holdings_status_asset
  ON holdings(status, asset_id);

CREATE INDEX IF NOT EXISTS idx_trading_plans_status_plan_set_seq
  ON trading_plans(status, plan_set_id, seq);

CREATE INDEX IF NOT EXISTS idx_trade_history_reverted_executed
  ON trade_history(reverted, executed_at DESC, id DESC);

