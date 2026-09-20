/**
 * 数据保留策略 —— 清理随时间无限增长的历史数据，防止 SQLite 库无限膨胀。
 *
 * 默认值可通过 settings 覆盖：
 *   price_retention_days    价格明细保留天数（过期数据降采样为"每日最后一笔"）默认 45
 *   signal_retention_days   市场信号保留天数                       默认 90
 *   trace_retention_days    Agent trace 保留天数（失败 14 天）        默认 90
 *   generation_log_retention_days  AI 草稿/丢弃记录保留天数        默认 90
 *   source_attempt_retention_days  行情源尝试记录保留天数          默认 14
 */
import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('retention');

const DEFAULTS = {
  price_retention_days: 45,
  signal_retention_days: 90,
  trace_retention_days: 90,
  generation_log_retention_days: 90,
  source_attempt_retention_days: 14,
};

function getDays(key) {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    const parsed = parseInt(row?.value, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {}
  return DEFAULTS[key];
}

function tableExists(name) {
  return Boolean(getDb().prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

/**
 * price_cache：N 天前的数据只保留每日最后一笔（降采样而非全删，保证 1y 趋势仍可用）。
 */
export function downsampleOldPriceCache(db = getDb(), days = getDays('price_retention_days')) {
  const info = db.prepare(`
    DELETE FROM price_cache
    WHERE fetched_at < datetime('now', '-' || ? || ' days')
      AND id NOT IN (
        SELECT MAX(id) FROM price_cache
        WHERE fetched_at < datetime('now', '-' || ? || ' days')
        GROUP BY asset_id, date(fetched_at)
      )`).run(days, days);
  return info.changes;
}

export function purgeOldMarketSignals(db = getDb(), days = getDays('signal_retention_days')) {
  return db.prepare("DELETE FROM market_signals WHERE created_at < datetime('now', '-' || ? || ' days')").run(days).changes;
}

export function purgeOldAgentTraces(db = getDb(), days = getDays('trace_retention_days')) {
  // steps / artifacts / resume_checkpoints 对 agent_traces 均为 ON DELETE CASCADE
  const stale = db.prepare(`
    DELETE FROM agent_traces
    WHERE status = 'failed' AND updated_at < datetime('now', '-14 days')`).run();
  const old = db.prepare(`
    DELETE FROM agent_traces
    WHERE status IN ('done', 'partial') AND updated_at < datetime('now', '-' || ? || ' days')`).run(days);
  return stale.changes + old.changes;
}

export function purgeOldGenerationLogs(db = getDb(), days = getDays('generation_log_retention_days')) {
  // 已采用的记录是策略溯源依据，长期保留；draft/discarded 过期清理
  return db.prepare(`
    DELETE FROM ai_generation_logs
    WHERE status IN ('draft', 'discarded')
      AND created_at < datetime('now', '-' || ? || ' days')`).run(days).changes;
}

export function purgeOldSourceAttempts(db = getDb(), days = getDays('source_attempt_retention_days')) {
  if (!tableExists('market_source_attempts')) return 0;
  return db.prepare("DELETE FROM market_source_attempts WHERE created_at < datetime('now', '-' || ? || ' days')").run(days).changes;
}

export function purgeOldBacktestResults(db = getDb(), keepPerStrategy = 20) {
  return db.prepare(`
    DELETE FROM backtest_results
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY strategy_id ORDER BY id DESC) AS rn
        FROM backtest_results
      ) WHERE rn > ?
    )`).run(keepPerStrategy).changes;
}

export function runRetention() {
  const db = getDb();
  const summary = {
    priceCacheDownsampled: 0,
    marketSignalsDeleted: 0,
    agentTracesDeleted: 0,
    generationLogsDeleted: 0,
    sourceAttemptsDeleted: 0,
    backtestResultsDeleted: 0,
  };
  const apply = db.transaction(() => {
    summary.priceCacheDownsampled = downsampleOldPriceCache(db);
    summary.marketSignalsDeleted = purgeOldMarketSignals(db);
    summary.agentTracesDeleted = purgeOldAgentTraces(db);
    summary.generationLogsDeleted = purgeOldGenerationLogs(db);
    summary.sourceAttemptsDeleted = purgeOldSourceAttempts(db);
    summary.backtestResultsDeleted = purgeOldBacktestResults(db);
  });
  apply();

  const total = Object.values(summary).reduce((sum, n) => sum + n, 0);
  if (total > 0) log.info('Retention pass complete', summary);
  else log.debug('Retention pass complete (nothing to purge)', summary);
  return summary;
}

let retentionTimer = null;

export function startRetentionScheduler({ intervalMs = 24 * 60 * 60 * 1000, runNow = false } = {}) {
  stopRetentionScheduler();
  if (runNow) {
    try { runRetention(); } catch (e) { log.warn('Initial retention pass failed', { error: e.message }); }
  }
  retentionTimer = setInterval(() => {
    try { runRetention(); } catch (e) { log.warn('Scheduled retention pass failed', { error: e.message }); }
  }, intervalMs);
  log.info('Retention scheduler started', { intervalMs });
  return retentionTimer;
}

export function stopRetentionScheduler() {
  if (retentionTimer) {
    clearInterval(retentionTimer);
    retentionTimer = null;
  }
}
