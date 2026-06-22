import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';
import { getMarketSnapshot } from './market-cache.js';

const log = createLogger('market-refresh');
const DEFAULT_MARKET_REFRESH_INTERVAL_MINUTES = 5;

let marketTimer = null;
let marketInitialTimer = null;
let refreshInFlight = false;

export function getMarketRefreshIntervalMinutes(db = getDb()) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'market_refresh_interval'").get();
  const minutes = Number(row?.value ?? DEFAULT_MARKET_REFRESH_INTERVAL_MINUTES);
  return Number.isFinite(minutes) ? Math.max(0, minutes) : DEFAULT_MARKET_REFRESH_INTERVAL_MINUTES;
}

export async function refreshAllMarketPrices({ reason = 'scheduled' } = {}) {
  if (refreshInFlight) {
    log.info('Market refresh skipped because previous run is still in progress', { reason });
    return { success: true, skipped: true, reason: 'in_progress' };
  }

  refreshInFlight = true;
  try {
    const db = getDb();
    const assets = db.prepare('SELECT * FROM assets ORDER BY id ASC').all();
    const results = await Promise.allSettled(
      assets.map((asset) => getMarketSnapshot(db, asset, { forceRefresh: true })),
    );
    const snapshots = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const failed = results.filter((result) => result.status === 'rejected').length;
    const summary = {
      total: assets.length,
      fresh: snapshots.filter((item) => !item.cached && !item.empty_cache).length,
      fallback: snapshots.filter((item) => item.cached && !item.empty_cache).length,
      empty: snapshots.filter((item) => item.empty_cache).length,
      failed,
      reason,
    };

    log.info('Market prices refreshed', summary);
    return { success: true, data: summary };
  } catch (error) {
    log.warn('Market refresh failed', { reason, error: error.message });
    throw error;
  } finally {
    refreshInFlight = false;
  }
}

export function stopMarketRefreshScheduler() {
  if (marketInitialTimer) {
    clearTimeout(marketInitialTimer);
    marketInitialTimer = null;
  }
  if (marketTimer) {
    clearInterval(marketTimer);
    marketTimer = null;
    log.info('Market refresh scheduler stopped');
  }
}

export function startMarketRefreshScheduler({ runImmediately = false, initialDelayMs = 0 } = {}) {
  stopMarketRefreshScheduler();

  const intervalMin = getMarketRefreshIntervalMinutes();
  if (intervalMin <= 0) {
    log.info('Market refresh scheduler disabled', { intervalMin });
    return null;
  }

  const intervalMs = intervalMin * 60 * 1000;
  if (runImmediately) {
    marketInitialTimer = setTimeout(() => {
      marketInitialTimer = null;
      refreshAllMarketPrices({ reason: 'startup' }).catch((error) => {
        log.warn('Initial market refresh failed', { error: error.message });
      });
    }, initialDelayMs);
  }

  marketTimer = setInterval(() => {
    refreshAllMarketPrices({ reason: 'scheduled' }).catch((error) => {
      log.warn('Scheduled market refresh failed', { error: error.message });
    });
  }, intervalMs);

  log.info('Market refresh scheduler started', { intervalMin });
  return marketTimer;
}
