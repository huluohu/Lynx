import https from 'https';
import http from 'http';
import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('push');

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
        msgtype: 'markdown',
        markdown: { content: `## ${title}\n${content}` },
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

function postWebhook(url, payload) {
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
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, status: res.statusCode, body });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
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
    const result = await postWebhook(config.url, payload);
    log.info('Push sent', { type: config.type, title });
    return { success: true };
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

  const title = '🔔 投资罗盘测试通知';
  const content = `这是一条测试推送消息。\n渠道类型: ${config.type}\n时间: ${new Date().toLocaleString('zh-CN')}`;

  try {
    const payload = buildPayload(config.type, title, content);
    await postWebhook(config.url, payload);
    return { success: true };
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
