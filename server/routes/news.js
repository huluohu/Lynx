import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 新闻列表
router.get('/', (req, res) => {
  const db = getDb();
  const { limit = 20, offset = 0 } = req.query;
  const rows = db.prepare('SELECT * FROM news ORDER BY published_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset));
  const total = db.prepare('SELECT COUNT(*) as count FROM news').get().count;
  res.json({ success: true, data: rows, total });
});

// PUT 标记已读
router.put('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE news SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
