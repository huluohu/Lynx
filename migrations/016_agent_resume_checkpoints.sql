-- Agent 恢复检查点：保存可继续执行的关键中间产物
CREATE TABLE IF NOT EXISTS agent_resume_checkpoints (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id      INTEGER NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
  step_name     TEXT NOT NULL,
  payload       TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(trace_id, step_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_resume_checkpoints_trace ON agent_resume_checkpoints(trace_id);

