-- 资讯详情缓存
ALTER TABLE news ADD COLUMN content TEXT;
ALTER TABLE news ADD COLUMN cache_status TEXT DEFAULT 'pending';
-- cache_status: pending | fetching | cached | failed
