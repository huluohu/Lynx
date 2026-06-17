-- AI 生成日志补充 Agent/Prompt 版本元数据，便于后续评测与回溯
ALTER TABLE ai_generation_logs ADD COLUMN agent_version TEXT;
ALTER TABLE ai_generation_logs ADD COLUMN prompt_versions TEXT;

