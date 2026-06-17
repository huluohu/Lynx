-- Agent 过程产物：保存 prompt、LLM 原始响应、解析结果、校验报告等可审计内容
CREATE TABLE IF NOT EXISTS agent_artifacts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id       INTEGER NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
  step_name      TEXT NOT NULL,
  artifact_type  TEXT NOT NULL,
  content        TEXT NOT NULL,
  metadata       TEXT,
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_artifacts_trace ON agent_artifacts(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_artifacts_step ON agent_artifacts(trace_id, step_name);

