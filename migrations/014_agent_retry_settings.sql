-- 014: default retry count for resilient AI Agent LLM calls

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('agent_llm_retries', '3');

