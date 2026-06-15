-- Add partial status and execution tracking to trading_plans
ALTER TABLE trading_plans ADD COLUMN executed_quantity REAL DEFAULT 0;
ALTER TABLE trading_plans ADD COLUMN executed_amount REAL DEFAULT 0;
ALTER TABLE trading_plans ADD COLUMN executed_price REAL;
ALTER TABLE trading_plans ADD COLUMN executed_at TEXT;
ALTER TABLE trading_plans ADD COLUMN trade_history_id INTEGER REFERENCES trade_history(id) ON DELETE SET NULL;

-- Add reverted flag to trade_history
ALTER TABLE trade_history ADD COLUMN reverted INTEGER DEFAULT 0;
ALTER TABLE trade_history ADD COLUMN reverted_at TEXT;
ALTER TABLE trade_history ADD COLUMN plan_id INTEGER REFERENCES trading_plans(id) ON DELETE SET NULL;
