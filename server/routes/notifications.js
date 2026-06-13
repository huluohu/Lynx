import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 未读通知列表
router.get('/', (req, res) => {
  const { status, limit = 20 } = req.query;
  let sql = 'SELECT * FROM notifications';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));
  const rows = getDb().prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

// GET 未读数量
router.get('/unread-count', (req, res) => {
  const row = getDb().prepare("SELECT COUNT(*) as count FROM notifications WHERE status = 'pending' OR status = 'sent'").get();
  res.json({ success: true, data: { count: row.count } });
});

// PUT 标记已读
router.put('/:id/read', (req, res) => {
  getDb().prepare("UPDATE notifications SET status = 'read' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// PUT 全部标记已读
router.put('/read-all', (req, res) => {
  getDb().prepare("UPDATE notifications SET status = 'read' WHERE status IN ('pending','sent')").run();
  res.json({ success: true });
});

// GET 待推送微信通知（标记为 sent 后返回）
router.get('/send-wechat', (req, res) => {
  const db = getDb();
  // 获取所有 wechat/all 通道的 pending 通知
  const rows = db.prepare(`SELECT * FROM notifications
    WHERE status = 'pending' AND channel IN ('wechat', 'all')
    ORDER BY created_at ASC`).all();

  if (rows.length === 0) {
    return res.json({ success: true, data: [], message: '' });
  }

  // 标记为 sent
  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE notifications SET status = 'sent', sent_at = datetime('now') WHERE id IN (${placeholders})`).run(...ids);

  // 格式化消息
  const lines = ['📊 **投资提醒**'];
  for (const n of rows) {
    const icons = {
      plan_triggered: '📌',
      plan_approaching: '⏳',
      stop_loss: '🛑',
      price_swing: '📊',
      trade_executed: '💱',
    };
    lines.push(`${icons[n.type] || '🔔'} ${n.title}: ${n.message}`);
  }

  res.json({ success: true, data: rows, message: lines.join('\n') });
});

// 插入通知（被其他模块调用）
export function createNotification(db, { type, title, message, asset_id, plan_id, channel }) {
  return db.prepare(
    'INSERT INTO notifications (type, title, message, asset_id, plan_id, channel) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(type, title, message, asset_id || null, plan_id || null, channel || 'web');
}

export default router;
