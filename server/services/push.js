import https from 'https';
import http from 'http';
import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('push');
const PUSH_MAX_ATTEMPTS = Math.max(1, Number(process.env.PUSH_MAX_ATTEMPTS || 3));
const PUSH_RETRY_DELAYS_MS = [800, 2000];

class PushDeliveryError extends Error {
  constructor(message, { retryable = true } = {}) {
    super(message);
    this.name = 'PushDeliveryError';
    this.retryable = retryable;
  }
}

/**
 * Supported push channels:
 * - wecom: 企业微信机器人 Webhook
 * - serverchan: Server酱 (https://sct.ftqq.com)
 * - pushplus: PushPlus (https://www.pushplus.plus)
 * - bark: Bark (iOS push)
 * - custom: 自定义 Webhook (POST JSON)
 */

function getWebhookConfig() {
  const db = getDb();
  const url = db.prepare("SELECT value FROM settings WHERE key = 'push_webhook_url'").get()?.value;
  const type = db.prepare("SELECT value FROM settings WHERE key = 'push_webhook_type'").get()?.value || 'wecom';
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'push_enabled'").get()?.value;
  return { url, type, enabled: enabled !== 'false' };
}

function buildPayload(type, title, content) {
  switch (type) {
    case 'wecom':
      return JSON.stringify({
        msgtype: 'text',
        text: { content: `${title}\n${content}`.slice(0, 2048) },
      });
    case 'serverchan':
      return JSON.stringify({ title, desp: content });
    case 'pushplus':
      return JSON.stringify({ title, content, template: 'markdown' });
    case 'bark':
      return JSON.stringify({ title, body: content });
    case 'custom':
    default:
      return JSON.stringify({ title, content, timestamp: new Date().toISOString() });
  }
}

function validateWebhookResponse(type, statusCode, body) {
  if (statusCode < 200 || statusCode >= 300) {
    throw new PushDeliveryError(`HTTP ${statusCode}: ${body.slice(0, 200)}`, { retryable: statusCode === 429 || statusCode >= 500 });
  }
  if (type !== 'wecom') return;
  try {
    const json = JSON.parse(body || '{}');
    if (json.errcode != null && Number(json.errcode) !== 0) {
      const code = Number(json.errcode);
      throw new PushDeliveryError(`WeCom ${json.errcode}: ${json.errmsg || body.slice(0, 200)}`, { retryable: code === -1 || code === 45009 });
    }
  } catch (error) {
    if (error instanceof PushDeliveryError) throw error;
  }
}

function postWebhook(url, payload, type = 'custom') {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };
      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            validateWebhookResponse(type, res.statusCode, body);
            resolve({ success: true, status: res.statusCode, body });
          } catch (error) {
            reject(error);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(payload);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postWebhookWithRetry(url, payload, type = 'custom') {
  let lastError;
  for (let attempt = 1; attempt <= PUSH_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await postWebhook(url, payload, type);
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (error.retryable === false) break;
      if (attempt >= PUSH_MAX_ATTEMPTS) break;
      const delayMs = PUSH_RETRY_DELAYS_MS[Math.min(attempt - 1, PUSH_RETRY_DELAYS_MS.length - 1)] || 2000;
      log.warn('Push attempt failed, retrying', { attempt, nextAttempt: attempt + 1, delayMs, error: error.message });
      await sleep(delayMs);
    }
  }
  throw lastError;
}

/**
 * Send a push notification via configured webhook
 * @param {string} title - Notification title
 * @param {string} content - Notification body (markdown supported for wecom/pushplus)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPush(title, content) {
  const config = getWebhookConfig();
  if (!config.enabled || !config.url) {
    return { success: false, error: 'Push not configured or disabled' };
  }

  try {
    const payload = buildPayload(config.type, title, content);
    const result = await postWebhookWithRetry(config.url, payload, config.type);
    log.info('Push sent', { type: config.type, title, attempts: result.attempts });
    return { success: true, attempts: result.attempts };
  } catch (e) {
    log.warn('Push failed', { type: config.type, title, error: e.message });
    return { success: false, error: e.message };
  }
}

/**
 * Send a test notification
 */
export async function sendTestPush() {
  const config = getWebhookConfig();
  if (!config.url) {
    return { success: false, error: '未配置 Webhook URL' };
  }

  const title = '🔔 L¥NX 测试通知';
  const content = `这是一条测试推送消息。\n渠道类型: ${config.type}\n时间: ${new Date().toLocaleString('zh-CN')}`;

  try {
    const payload = buildPayload(config.type, title, content);
    const result = await postWebhookWithRetry(config.url, payload, config.type);
    return { success: true, attempts: result.attempts };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Send batch notifications (called by strategy monitor)
 */
export async function pushPendingNotifications() {
  const config = getWebhookConfig();
  if (!config.enabled || !config.url) return 0;

  const db = getDb();
  const rows = db.prepare(`SELECT * FROM notifications
    WHERE status = 'pending'
    ORDER BY created_at ASC LIMIT 10`).all();

  if (!rows.length) return 0;

  const lines = rows.map(n => {
    const icons = { plan_triggered: '📌', plan_approaching: '⏳', stop_loss: '🛑', price_swing: '📊', trade_executed: '💱' };
    return `${icons[n.type] || '🔔'} ${n.title}: ${n.message}`;
  });

  const title = `📊 投资提醒 (${rows.length}条)`;
  const content = lines.join('\n');

  const result = await sendPush(title, content);

  if (result.success) {
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE notifications SET status = 'sent', sent_at = datetime('now') WHERE id IN (${placeholders})`).run(...ids);
  }

  return result.success ? rows.length : 0;
}
