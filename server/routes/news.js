import { Router } from 'express';
import { getDb } from '../db/database.js';
import { refreshNews, cacheNewsContent, cachePendingNews, getNewsAutoCacheSettings } from '../services/news.js';

const router = Router();

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text?.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  const start = text?.indexOf('{');
  const end = text?.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

function truncateForTranslation(text, max = 12000) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max)}\n\n[内容过长，已截断翻译]` : value;
}

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

// POST 翻译单条新闻标题/摘要/正文（不覆盖原文）
router.post('/:id/translate', async (req, res) => {
  const db = getDb();
  let row = db.prepare('SELECT id, title, summary, url, content, cache_status FROM news WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });

  if (!row.content && row.url) {
    await cacheNewsContent(row.id);
    row = db.prepare('SELECT id, title, summary, url, content, cache_status FROM news WHERE id = ?').get(req.params.id);
  }

  try {
    const { getAgentConfig, callLLM } = await import('../services/strategy-agent.js');
    const config = getAgentConfig(db);
    if (!config.apiUrl || !config.apiKey) {
      return res.status(400).json({ success: false, error: 'AI 翻译未配置，请先在设置中配置 AI API。' });
    }

    const targetLanguage = req.body?.target_language || '简体中文';
    const prompt = `请把以下资讯翻译成${targetLanguage}，保留事实和数字，不添加评论。返回严格 JSON：{"title":"...","summary":"...","content":"..."}。\n\n标题：\n${row.title || ''}\n\n摘要：\n${row.summary || ''}\n\n正文：\n${truncateForTranslation(row.content || row.summary || '')}`;
    const response = await callLLM(config.apiUrl, config.apiKey, config.analysisModel || config.model, [
      { role: 'system', content: '你是专业财经资讯翻译助手。只输出严格 JSON，不要 markdown。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.1, maxTokens: 3000, timeout: 60000, retries: 1 });

    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = extractJSON(content);
    if (!parsed) return res.status(502).json({ success: false, error: '翻译结果解析失败' });

    res.json({
      success: true,
      data: {
        title: String(parsed.title || row.title || ''),
        summary: String(parsed.summary || row.summary || ''),
        content: String(parsed.content || row.content || row.summary || ''),
        target_language: targetLanguage,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '翻译失败' });
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

export default router;
