-- Agent 运行轨迹：每次 Agent 运行一条记录，用于可观测、可评估
CREATE TABLE IF NOT EXISTS agent_traces (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id              TEXT UNIQUE NOT NULL,           -- 本次运行的唯一 ID
  trigger             TEXT NOT NULL DEFAULT 'generate', -- generate | regenerate | compare
  asset_ids           TEXT NOT NULL,                  -- JSON array
  params              TEXT,                           -- JSON: budget, goal, riskLevel
  status              TEXT NOT NULL DEFAULT 'running', -- running | done | failed | partial
  error               TEXT,                           -- 失败时的错误信息
  data_quality_score  REAL,                           -- 数据质量评分 0-1
  eval_score          REAL,                           -- 输出质量评分 0-1
  eval_detail         TEXT,                           -- JSON: 评估细节
  model               TEXT,                           -- 使用的 LLM 模型
  elapsed_ms          INTEGER,                        -- 总耗时(ms)
  generation_log_id   INTEGER REFERENCES ai_generation_logs(id) ON DELETE SET NULL,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

-- Agent 运行步骤：每个 pipeline 步骤一条记录
CREATE TABLE IF NOT EXISTS agent_trace_steps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id      INTEGER NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
  step_name     TEXT NOT NULL,    -- precheck | collect | analyze | selfcheck | generate | postvalidate | evaluate
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | running | done | failed | skipped
  input_summary TEXT,             -- JSON: 步骤输入摘要
  output_summary TEXT,            -- JSON: 步骤输出摘要
  error         TEXT,             -- 失败时的错误信息
  elapsed_ms    INTEGER,
  started_at    TEXT,
  completed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_traces_status   ON agent_traces(status);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created  ON agent_traces(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_trace_steps_tid ON agent_trace_steps(trace_id);
