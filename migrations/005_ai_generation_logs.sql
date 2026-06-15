-- AI 生成日志：记录每次 AI 策略生成的完整过程
CREATE TABLE IF NOT EXISTS ai_generation_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_ids       TEXT NOT NULL,                          -- JSON array of asset IDs
  budget          REAL,
  goal            TEXT,
  risk_level      TEXT,
  analysis        TEXT,                                   -- Step 2 分析报告 JSON
  strategy        TEXT,                                   -- Step 3 策略结果 JSON
  plans           TEXT,                                   -- 计划 JSON array
  reasoning       TEXT,                                   -- 决策推理
  risk_management TEXT,                                   -- 风险管理 JSON
  execution_notes TEXT,                                   -- 执行建议
  model           TEXT,                                   -- 使用的模型
  elapsed_ms      INTEGER,                               -- 生成耗时(ms)
  status          TEXT DEFAULT 'draft',                   -- draft/adopted/discarded
  user_feedback   TEXT,                                   -- 重新生成时的用户调整建议
  parent_id       INTEGER REFERENCES ai_generation_logs(id) ON DELETE SET NULL,
  strategy_id     INTEGER REFERENCES strategies(id) ON DELETE SET NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_status ON ai_generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_created ON ai_generation_logs(created_at);
