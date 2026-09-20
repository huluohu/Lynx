-- 数据保留策略配套变更
-- Migration: 035_retention_support

-- news.url 去重：保留每个 URL 最早一条（与 fetchFromSource 的"先查后插"语义一致），
-- 然后建唯一索引，使 INSERT OR IGNORE 真正具备防重能力。
-- 注意外层同样限定 url 非空，避免误删无 URL 的记录。
DELETE FROM news
WHERE url IS NOT NULL AND url != ''
  AND id NOT IN (
    SELECT MIN(id) FROM news WHERE url IS NOT NULL AND url != '' GROUP BY url
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_url_unique
  ON news(url)
  WHERE url IS NOT NULL AND url != '';

-- 保留策略常用过滤索引
CREATE INDEX IF NOT EXISTS idx_price_cache_fetched_at ON price_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_market_source_attempts_created ON market_source_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy_id ON backtest_results(strategy_id, id DESC);
