-- Migration: 003_multi_asset_strategy
-- 策略支持多资产组合

ALTER TABLE strategies ADD COLUMN asset_ids TEXT;
-- asset_ids stores JSON array like [1,2,3], asset_id kept for backward compatibility
