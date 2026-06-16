import { Router } from 'express';
import { getDb } from '../db/database.js';
import { refreshNews, cacheNewsContent, cachePendingNews, getNewsAutoCacheSettings } from '../services/news.js';

const router = Router();

// GET 新闻列表
router.get('/', (req, res) => {
  const db = getDb();
  const { limit = 20, offset = 0 } = req.query;
  const rows = db.prepare('SELECT id, title, summary, url, source, published_at, read, cache_status, created_at FROM news ORDER BY published_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset));
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

// GET 单条新闻详情（含缓存内容）
router.get('/:id/content', async (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT id, title, url, content, cache_status FROM news WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });

  if (row.cache_status === 'cached' && row.content) {
    return res.json({ success: true, data: row });
  }

  // Try to cache now
  const result = await cacheNewsContent(row.id);
  const updated = db.prepare('SELECT id, title, url, content, cache_status FROM news WHERE id = ?').get(row.id);
  res.json({ success: true, data: updated });
});

// POST 批量缓存待处理新闻
router.post('/cache-batch', async (req, res) => {
  const requestedLimit = req.body?.limit;
  const autoCache = getNewsAutoCacheSettings();
  const limit = requestedLimit == null ? autoCache.batchSize : Math.min(Number(requestedLimit) || autoCache.batchSize, 20);
  const cached = await cachePendingNews(limit);
  res.json({ success: true, cached });
});

// PUT 标记已读
router.put('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE news SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== 自定义数据源管理 =====

// GET 自定义数据源列表
router.get('/sources', (req, res) => {
  const db = getDb();
  try {
    const sources = db.prepare('SELECT * FROM custom_news_sources ORDER BY created_at DESC').all();
    res.json({ success: true, data: sources });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// POST 添加自定义数据源
router.post('/sources', (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ success: false, error: '名称和URL不能为空' });
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'URL格式无效' });
  }
  const db = getDb();
  try {
    db.prepare('INSERT INTO custom_news_sources (name, url) VALUES (?, ?)').run(name, url);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message.includes('UNIQUE') ? 'URL已存在' : e.message });
  }
});

// DELETE 删除自定义数据源
router.delete('/sources/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM custom_news_sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PUT 启用/禁用自定义数据源
router.put('/sources/:id', (req, res) => {
  const { enabled } = req.body;
  const db = getDb();
  db.prepare('UPDATE custom_news_sources SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  res.json({ success: true });
});

export default router;
