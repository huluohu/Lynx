import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempDir;
let dbPath;
let dbApi;
let pushApi;

async function startWebhook({ failFirst = 0 } = {}) {
  const received = [];
  let attempts = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      attempts += 1;
      received.push({ method: req.method, url: req.url, body: JSON.parse(body || '{}') });
      if (attempts <= failFirst) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/webhook`,
    received,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

test.before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'lynx-push-test-'));
  dbPath = join(tempDir, 'test.db');
  process.env.DB_PATH = dbPath;
  process.env.PUSH_MAX_ATTEMPTS = '3';
  dbApi = await import('../db/database.js');
  dbApi.runMigrations();
  pushApi = await import('../services/push.js');
});

test.after(() => {
  dbApi.closeDb();
  rmSync(tempDir, { recursive: true, force: true });
});

test('sendTestPush posts configured webhook payload', async () => {
  const webhook = await startWebhook();
  const db = dbApi.getDb();
  setSetting(db, 'push_enabled', 'true');
  setSetting(db, 'push_webhook_type', 'custom');
  setSetting(db, 'push_webhook_url', webhook.url);

  try {
    const result = await pushApi.sendTestPush();
    assert.equal(result.success, true);
    assert.equal(webhook.received.length, 1);
    assert.equal(webhook.received[0].method, 'POST');
    assert.equal(webhook.received[0].body.title.includes('测试通知'), true);
  } finally {
    await webhook.close();
  }
});

test('pushPendingNotifications retries failures and marks sent only after success', async () => {
  const webhook = await startWebhook({ failFirst: 1 });
  const db = dbApi.getDb();
  setSetting(db, 'push_enabled', 'true');
  setSetting(db, 'push_webhook_type', 'custom');
  setSetting(db, 'push_webhook_url', webhook.url);
  db.prepare('DELETE FROM notifications').run();
  db.prepare(`INSERT INTO notifications (type, title, message, severity, channel, status)
    VALUES ('price_swing', '价格波动测试', 'BTC 大涨 3%', 'info', 'all', 'pending')`).run();

  try {
    const pushed = await pushApi.pushPendingNotifications();
    assert.equal(pushed, 1);
    assert.equal(webhook.received.length, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE status = 'pending'").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE status = 'sent'").get().count, 1);
  } finally {
    await webhook.close();
  }
});

