import { Router } from 'express';
import { getDb } from '../db/database.js';
import { cachePendingNews, getNewsAutoCacheSettings } from '../services/news.js';
import { startMonitor } from '../services/strategy-monitor.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const log = createLogger('settings');

// Keys that should be masked when reading
const SECRET_KEYS = ['ai_api_key', 'agent_search_api_key'];
const NEWS_EFFECT_KEYS = new Set(['news_refresh_interval', 'news_sources_available', 'news_sources_enabled', 'news_auto_cache', 'news_cache_batch_size']);

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
  getDb().prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')').run(req.params.key, String(value));
  await applySettingsSideEffects([req.params.key]);
  res.json({ success: true, data: { [req.params.key]: maskValue(req.params.key, String(value)) } });
});

// PUT 批量更新
router.put('/', async (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ success: false, error: '无效数据' });
  const db = getDb();
  const stmt = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')');
  for (const [key, value] of Object.entries(settings)) {
    // Don't save masked secrets back
    if (SECRET_KEYS.includes(key) && String(value).startsWith('****')) continue;
    stmt.run(key, String(value));
  }
  await applySettingsSideEffects(Object.keys(settings));
  res.json({ success: true });
});

export default router;
