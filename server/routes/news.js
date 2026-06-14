import { Router } from 'express';
import { getDb } from '../db/database.js';
import { refreshNews } from '../services/news.js';

const router = Router();

// GET 新闻列表
router.get('/', (req, res) => {
  const db = getDb();
  const { limit = 20, offset = 0 } = req.query;
  const rows = db.prepare('SELECT * FROM news ORDER BY published_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset));
  const total = db.prepare('SELECT COUNT(*) as count FROM news').get().count;
  res.json({ success: true, data: rows, total });
});

// POST 手动刷新新闻
router.post('/refresh', async (req, res) => {
  try {
    const count = await refreshNews();
    res.json({ success: true, message: `已获取 ${count} 条新资讯` });
  } catch (e) {
    res.status(500).json({ success: false, error: '刷新失败' });
  }
});

// PUT 标记已读
router.put('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE news SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
