import { normalizeApiTimestamp } from '../utils/datetime.js';
import { fetchPrice } from './price.js';

export const FRESH_MARKET_CACHE_WINDOW_MS = 5 * 60 * 1000;

function getLatestCacheRow(db, assetId) {
  return db.prepare(
    'SELECT * FROM price_cache WHERE asset_id = ? ORDER BY datetime(fetched_at) DESC, id DESC LIMIT 1'
  ).get(assetId);
}

function getCacheStatus(row) {
  if (!row) return 'missing';
  const normalizedFetchedAt = normalizeCacheFetchedAt(row);
  if (!normalizedFetchedAt) return 'stale';
  const fetchedAt = new Date(normalizedFetchedAt).getTime();
  if (Number.isNaN(fetchedAt)) return 'stale';
  return Date.now() - fetchedAt > FRESH_MARKET_CACHE_WINDOW_MS ? 'stale' : 'fresh';
}

function normalizeCacheFetchedAt(row) {
  return normalizeApiTimestamp(row?.fetched_at || null, {
    assumeUtcWhenNoTimezone: true,
    fallbackToLocalWhenFuture: true,
  });
}

function buildSnapshot(asset, row, { cached, details = null } = {}) {
  const cacheStatus = getCacheStatus(row);
  const emptyCache = !row;
  const stale = cacheStatus !== 'fresh';

  return {
    asset_id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    type: asset.type,
    subtype: asset.subtype || null,
    unit: asset.unit || null,
    quote_currency: asset.quote_currency || asset.currency || null,
    price: row?.price ?? null,
    currency: row?.currency ?? null,
    source: row?.source || asset.data_source || null,
    details,
    fetched_at: normalizeCacheFetchedAt(row),
    cached,
    stale,
    empty_cache: emptyCache,
    cache_status: emptyCache ? 'missing' : cacheStatus,
    data_quality: emptyCache ? 'missing' : cacheStatus,
  };
}

export function getCachedMarketSnapshot(db, asset) {
  const row = getLatestCacheRow(db, asset.id);
  return buildSnapshot(asset, row, { cached: true });
}

export async function getMarketSnapshot(db, asset, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    return getCachedMarketSnapshot(db, asset);
  }

  const realtime = await fetchPrice(asset);
  if (realtime) {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)')
      .run(asset.id, realtime.price, realtime.currency, realtime.source);
    const cachedRow = getLatestCacheRow(db, asset.id);
    return buildSnapshot(asset, cachedRow, {
      cached: false,
      details: realtime.details || null,
    });
  }

  return getCachedMarketSnapshot(db, asset);
}
