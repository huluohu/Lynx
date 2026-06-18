-- 回测/复盘结果绑定计划批次，避免策略重新生成后旧结果被当作当前批次结果展示
ALTER TABLE backtest_results ADD COLUMN plan_set_id INTEGER REFERENCES plan_sets(id) ON DELETE SET NULL;
ALTER TABLE strategy_reviews ADD COLUMN plan_set_id INTEGER REFERENCES plan_sets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_backtest_plan_set ON backtest_results(strategy_id, plan_set_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_plan_set ON strategy_reviews(strategy_id, plan_set_id, created_at);

