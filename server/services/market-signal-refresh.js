import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';
import { analyzeAllAssets } from './market-signal.js';

const log = createLogger('market-signal-refresh');
export const DEFAULT_MARKET_SIGNAL_REFRESH_INTERVAL_MINUTES = 30;

let signalTimer = null;
let signalInitialTimer = null;
let signalRefreshInFlight = false;

export function getMarketSignalRefreshIntervalMinutes(db = getDb()) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'market_signal_refresh_interval'").get();
  const minutes = Number(row?.value ?? DEFAULT_MARKET_SIGNAL_REFRESH_INTERVAL_MINUTES);
  return Number.isFinite(minutes) ? Math.max(0, minutes) : DEFAULT_MARKET_SIGNAL_REFRESH_INTERVAL_MINUTES;
}

export async function refreshAllMarketSignals({ reason = 'scheduled' } = {}) {
  if (signalRefreshInFlight) {
    log.info('Market signal refresh skipped because previous run is still in progress', { reason });
    return { success: true, skipped: true, reason: 'in_progress' };
  }

  signalRefreshInFlight = true;
  try {
    const signals = await analyzeAllAssets();
    const summary = {
      total: signals.length,
      reason,
    };
    log.info('Market signals refreshed', summary);
    return { success: true, data: summary };
  } catch (error) {
    log.warn('Market signal refresh failed', { reason, error: error.message });
    throw error;
  } finally {
    signalRefreshInFlight = false;
  }
}

export function stopMarketSignalRefreshScheduler() {
  if (signalInitialTimer) {
    clearTimeout(signalInitialTimer);
    signalInitialTimer = null;
  }
  if (signalTimer) {
    clearInterval(signalTimer);
    signalTimer = null;
    log.info('Market signal refresh scheduler stopped');
  }
}

export function startMarketSignalRefreshScheduler({ runImmediately = false, initialDelayMs = 0 } = {}) {
  stopMarketSignalRefreshScheduler();

  const intervalMin = getMarketSignalRefreshIntervalMinutes();
  if (intervalMin <= 0) {
    log.info('Market signal refresh scheduler disabled', { intervalMin });
    return null;
  }

  const intervalMs = intervalMin * 60 * 1000;
  if (runImmediately) {
    signalInitialTimer = setTimeout(() => {
      signalInitialTimer = null;
      refreshAllMarketSignals({ reason: 'startup' }).catch((error) => {
        log.warn('Initial market signal refresh failed', { error: error.message });
      });
    }, initialDelayMs);
  }

  signalTimer = setInterval(() => {
    refreshAllMarketSignals({ reason: 'scheduled' }).catch((error) => {
      log.warn('Scheduled market signal refresh failed', { error: error.message });
    });
  }, intervalMs);

  log.info('Market signal refresh scheduler started', { intervalMin });
  return signalTimer;
}
