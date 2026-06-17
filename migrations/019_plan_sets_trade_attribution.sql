-- 策略计划批次/版本与交易归因：避免旧计划交易混入当前策略复盘
CREATE TABLE IF NOT EXISTS plan_sets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id       INTEGER NOT NULL REFERENCES strategies(id) ON DELETE CASCADE,
  generation_log_id INTEGER REFERENCES ai_generation_logs(id) ON DELETE SET NULL,
  source            TEXT NOT NULL DEFAULT 'manual', -- ai | manual | legacy | regenerate
  status            TEXT NOT NULL DEFAULT 'active', -- active | superseded | archived
  version_no        INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT DEFAULT (datetime('now')),
  activated_at      TEXT DEFAULT (datetime('now')),
  superseded_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_plan_sets_strategy ON plan_sets(strategy_id, status);
CREATE INDEX IF NOT EXISTS idx_plan_sets_created ON plan_sets(created_at);

ALTER TABLE trading_plans ADD COLUMN plan_set_id INTEGER REFERENCES plan_sets(id) ON DELETE SET NULL;
ALTER TABLE trade_history ADD COLUMN strategy_id INTEGER REFERENCES strategies(id) ON DELETE SET NULL;
ALTER TABLE trade_history ADD COLUMN plan_set_id INTEGER REFERENCES plan_sets(id) ON DELETE SET NULL;
ALTER TABLE trade_history ADD COLUMN attribution_source TEXT DEFAULT 'manual_unlinked';

-- 为现有策略创建 legacy active plan set
INSERT INTO plan_sets (strategy_id, source, status, version_no, created_at, activated_at)
SELECT s.id, 'legacy', 'active', 1, COALESCE(s.created_at, datetime('now')), COALESCE(s.created_at, datetime('now'))
FROM strategies s
WHERE NOT EXISTS (SELECT 1 FROM plan_sets ps WHERE ps.strategy_id = s.id);

-- 将现有计划归入对应策略的 active plan set
UPDATE trading_plans
SET plan_set_id = (
  SELECT ps.id
  FROM plan_sets ps
  WHERE ps.strategy_id = trading_plans.strategy_id AND ps.status = 'active'
  ORDER BY ps.version_no DESC, ps.id DESC
  LIMIT 1
)
WHERE plan_set_id IS NULL;

-- 回填已有计划执行交易的策略/计划批次归因
UPDATE trade_history
SET strategy_id = (SELECT tp.strategy_id FROM trading_plans tp WHERE tp.id = trade_history.plan_id),
    plan_set_id = (SELECT tp.plan_set_id FROM trading_plans tp WHERE tp.id = trade_history.plan_id),
    attribution_source = CASE WHEN plan_id IS NOT NULL THEN 'plan_execute' ELSE COALESCE(attribution_source, 'manual_unlinked') END
WHERE plan_id IS NOT NULL;

