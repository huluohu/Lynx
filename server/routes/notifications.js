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

// GET 提醒历史
router.get('/history', (req, res) => {
  const db = getDb();
  const { page = 1, page_size = 20, type, severity, asset_id, strategy_id, status } = req.query;
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(page_size) || 20));
  const offset = (currentPage - 1) * pageSize;

  const conditions = [];
  const params = [];
  if (type) { conditions.push('n.type = ?'); params.push(type); }
  if (severity) { conditions.push('n.severity = ?'); params.push(severity); }
  if (asset_id) { conditions.push('n.asset_id = ?'); params.push(Number(asset_id)); }
  if (strategy_id) { conditions.push('COALESCE(n.strategy_id, p.strategy_id) = ?'); params.push(Number(strategy_id)); }
  if (status) { conditions.push('n.status = ?'); params.push(status); }

  const fromSql = ` FROM notifications n
    LEFT JOIN trading_plans p ON n.plan_id = p.id
    LEFT JOIN assets a ON n.asset_id = a.id
    LEFT JOIN strategies s ON COALESCE(n.strategy_id, p.strategy_id) = s.id`;
  const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS count${fromSql}${whereSql}`).get(...params).count;
  const rows = db.prepare(`SELECT n.*, a.name AS asset_name, a.symbol, s.name AS strategy_name${fromSql}${whereSql}
    ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

  res.json({ success: true, data: {
    items: rows,
    pagination: {
      page: currentPage,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  } });
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

// DELETE 清空全部已读
router.delete('/clear-all', (req, res) => {
  const info = getDb().prepare("DELETE FROM notifications WHERE status = 'read'").run();
  res.json({ success: true, data: { deleted: info.changes } });
});

// DELETE 删除单条通知
router.delete('/:id', (req, res) => {
  const info = getDb().prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ success: false, error: '通知不存在' });
  res.json({ success: true });
});

// POST 推送微信通知（原子操作：获取 → 标记 → 返回）
router.post('/send-wechat', (req, res) => {
  const db = getDb();

  // Atomically select and mark notifications as sent
  const sendBatch = db.transaction(() => {
    const rows = db.prepare(`SELECT * FROM notifications
      WHERE status = 'pending' AND channel IN ('wechat', 'all')
      ORDER BY created_at ASC`).all();

    if (rows.length === 0) return { rows: [], message: '' };

    // Mark as sent
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE notifications SET status = 'sent', sent_at = datetime('now') WHERE id IN (${placeholders})`).run(...ids);

    // Format message
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

    return { rows, message: lines.join('\n') };
  });

  const result = sendBatch();
  res.json({ success: true, data: result.rows, message: result.message });
});

// 插入通知（被其他模块调用）
export function createNotification(db, { type, title, message, asset_id, plan_id, strategy_id, severity, channel, status }) {
  return db.prepare(
    `INSERT INTO notifications (type, title, message, asset_id, plan_id, strategy_id, severity, channel, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    type,
    title,
    message,
    asset_id || null,
    plan_id || null,
    strategy_id || null,
    severity || 'info',
    channel || 'web',
    status || 'pending',
  );
}

export default router;
