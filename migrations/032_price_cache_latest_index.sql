-- Optimize dashboard overview and trend queries that read latest/ranged prices.
CREATE INDEX IF NOT EXISTS idx_price_cache_asset_fetched_id
  ON price_cache(asset_id, fetched_at DESC, id DESC);

