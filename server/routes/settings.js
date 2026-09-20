import { Router } from 'express';
import { getDb } from '../db/database.js';
import { cachePendingNews, getNewsAutoCacheSettings } from '../services/news.js';
import { startMonitor } from '../services/strategy-monitor.js';
import { startMarketRefreshScheduler } from '../services/market-refresh.js';
import { startMarketSignalRefreshScheduler } from '../services/market-signal-refresh.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const log = createLogger('settings');

// Keys that should be masked when reading
const SECRET_KEYS = ['ai_api_key', 'agent_search_api_key'];
// URL 类设置保存时校验协议（允许内网地址：本地 Ollama、内网 ntfy 等是一等用法，
// 因此只校验 http/https，不做私网 IP 拦截；行情/资讯源在 market/news 路由走严格 SSRF 守卫）
const URL_SETTING_KEYS = new Set(['ai_api_url', 'agent_search_api_url', 'push_webhook_url']);
const NEWS_EFFECT_KEYS = new Set(['news_refresh_interval', 'news_sources_available', 'news_sources_enabled', 'news_auto_cache', 'news_cache_batch_size']);

function validateUrlSetting(key, value) {
  if (!URL_SETTING_KEYS.has(key)) return null;
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (!['http:', 'https:'].includes(parsed.protocol)) return `${key} 仅支持 http/https 地址`;
  } catch {
    return `${key} 不是有效的 URL`;
  }
  return null;
}

// 已知设置项（与 README「关键运行配置」保持同步）；未知 key 不阻断，仅告警，便于发现拼写错误
const KNOWN_SETTING_KEYS = new Set([
  'theme', 'language', 'market_color_scheme',
  'refresh_interval', 'market_refresh_interval', 'rate_cache_duration',
  'market_crypto_sources_enabled', 'market_btc_sources_enabled',
  'market_precious_metal_sources_enabled', 'market_gold_sources_enabled',
  'strategy_monitor_interval', 'signal_valid_hours', 'market_signal_refresh_interval',
  'price_alert_threshold', 'plan_approaching_pct', 'price_retention_days',
  'signal_retention_days', 'trace_retention_days', 'generation_log_retention_days',
  'source_attempt_retention_days',
  'news_refresh_interval', 'news_sources_available', 'news_sources_enabled',
  'news_auto_cache', 'news_cache_batch_size',
  'push_enabled', 'push_webhook_type', 'push_webhook_url',
  'ai_api_url', 'ai_api_key', 'ai_model', 'agent_analysis_model', 'agent_llm_retries',
  'agent_search_api_url', 'agent_search_api_key',
  'notify_plan_triggered', 'notify_plan_approaching', 'notify_stop_loss',
  'notify_price_swing', 'notify_trade_executed',
]);
const warnedUnknownKeys = new Set();

function warnUnknownSettingKey(key) {
  if (KNOWN_SETTING_KEYS.has(key) || warnedUnknownKeys.has(key)) return;
  warnedUnknownKeys.add(key);
  log.warn('Unknown setting key written (check for typos)', { key: String(key).slice(0, 64) });
}

function maskValue(key, value) {
  if (SECRET_KEYS.includes(key) && value) {
    // Show only last 4 chars
    return value.length > 4 ? '****' + value.slice(-4) : '****';
  }
  return value;
}

async function applySettingsSideEffects(changedKeys) {
  const keySet = new Set(changedKeys);

  if (keySet.has('strategy_monitor_interval')) {
    startMonitor();
    log.info('Strategy monitor restarted after settings change');
  }

  if (keySet.has('market_refresh_interval')) {
    startMarketRefreshScheduler({ runImmediately: true });
    log.info('Market refresh scheduler restarted after settings change');
  }

  if (keySet.has('market_signal_refresh_interval')) {
    startMarketSignalRefreshScheduler({ runImmediately: true });
    log.info('Market signal refresh scheduler restarted after settings change');
  }

  if ([...NEWS_EFFECT_KEYS].some((key) => keySet.has(key))) {
    try {
      const { scheduleNewsFetch } = await import('../index.js');
      await scheduleNewsFetch();
      log.info('News scheduler updated after settings change');
    } catch (error) {
      log.warn('Failed to reschedule news fetch', { error: error.message });
    }

    const autoCache = getNewsAutoCacheSettings();
    if (autoCache.enabled) {
      cachePendingNews(autoCache.batchSize).catch((error) => {
        log.warn('Failed to trigger news auto-cache after settings change', { error: error.message });
      });
    }
  }
}

// GET 所有设置
router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM settings ORDER BY key').all();
  const settings = {};
  for (const r of rows) settings[r.key] = maskValue(r.key, r.value);
  res.json({ success: true, data: settings });
});

// GET 单个设置
router.get('/:key', (req, res) => {
  const row = getDb().prepare('SELECT key, value FROM settings WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ success: false, error: '设置不存在' });
  res.json({ success: true, data: { [row.key]: maskValue(row.key, row.value) } });
});

// PUT 更新设置
router.put('/:key', async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ success: false, error: 'value 不能为空' });
  // Don't save masked values back
  if (SECRET_KEYS.includes(req.params.key) && String(value).startsWith('****')) {
    return res.json({ success: true, data: { [req.params.key]: String(value) } });
  }
  const urlError = validateUrlSetting(req.params.key, value);
  if (urlError) return res.status(400).json({ success: false, error: urlError });
  warnUnknownSettingKey(req.params.key);
  getDb().prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')').run(req.params.key, String(value));
  await applySettingsSideEffects([req.params.key]);
  res.json({ success: true, data: { [req.params.key]: maskValue(req.params.key, String(value)) } });
});

// PUT 批量更新
router.put('/', async (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ success: false, error: '无效数据' });
  const db = getDb();
  const entries = Object.entries(settings).filter(([key, value]) => (
    !(SECRET_KEYS.includes(key) && String(value).startsWith('****'))
  ));
  for (const [key, value] of entries) {
    const urlError = validateUrlSetting(key, value);
    if (urlError) return res.status(400).json({ success: false, error: urlError });
    warnUnknownSettingKey(key);
  }
  const stmt = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')');
  const writeAll = db.transaction(() => {
    for (const [key, value] of entries) stmt.run(key, String(value));
  });
  writeAll();
  await applySettingsSideEffects(Object.keys(settings));
  res.json({ success: true });
});

export default router;
