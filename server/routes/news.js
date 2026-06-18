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

function splitArticleParagraphs(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|(?<=。|！|？|\.|!|\?)\s+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function detectLanguage(text) {
  const value = String(text || '');
  if (!value.trim()) return 'unknown';
  const cjk = (value.match(/[\u4e00-\u9fff]/g) || []).length;
  const kana = (value.match(/[\u3040-\u30ff]/g) || []).length;
  const hangul = (value.match(/[\uac00-\ud7af]/g) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  if (cjk > Math.max(latin * 0.3, 8)) return 'zh';
  if (kana > 8) return 'ja';
  if (hangul > 8) return 'ko';
  if (latin > 20) return 'en';
  return 'unknown';
}

function resolveTargetLanguage(requestedTarget, sourceLanguage) {
  if (requestedTarget && requestedTarget !== 'auto') return requestedTarget;
  return sourceLanguage === 'zh' ? 'English' : '简体中文';
}

function buildTranslationChunks(text, { maxChars = 1000, maxChunks = 8 } = {}) {
  const paragraphs = splitArticleParagraphs(text);
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    const nextLength = currentLength + paragraph.length + 2;
    if (current.length && nextLength > maxChars) {
      chunks.push(current.join('\n\n'));
      current = [];
      currentLength = 0;
      if (chunks.length >= maxChunks) break;
    }
    current.push(paragraph.slice(0, maxChars));
    currentLength += paragraph.length + 2;
  }
  if (current.length && chunks.length < maxChunks) chunks.push(current.join('\n\n'));
  return chunks;
}

async function translateMetadata({ callLLM, config, targetLanguage, title, summary }) {
  const response = await callLLM(config.apiUrl, config.apiKey, config.analysisModel || config.model, [
    { role: 'system', content: '你是专业财经资讯翻译助手。只输出严格 JSON，不要 markdown。' },
    { role: 'user', content: `请把标题和摘要翻译成${targetLanguage}，保留事实和数字。返回严格 JSON：{"title":"...","summary":"..."}\n\n标题：\n${title || ''}\n\n摘要：\n${summary || ''}` },
  ], { temperature: 0.1, maxTokens: 900, timeout: 25000, retries: 0 });
  const parsed = extractJSON(response?.choices?.[0]?.message?.content || '');
  if (!parsed) throw new Error('标题/摘要翻译结果解析失败');
  return {
    title: String(parsed.title || title || ''),
    summary: String(parsed.summary || summary || ''),
  };
}

async function translateContentChunk({ callLLM, config, targetLanguage, chunk, index, total }) {
  const response = await callLLM(config.apiUrl, config.apiKey, config.analysisModel || config.model, [
    { role: 'system', content: '你是专业财经资讯翻译助手。只输出翻译后的正文，不要解释，不要 markdown。' },
    { role: 'user', content: `请把下面第 ${index + 1}/${total} 段资讯正文翻译成${targetLanguage}。尽量保留原有段落，用空行分隔。\n\n${chunk}` },
  ], { temperature: 0.1, maxTokens: 1800, timeout: 30000, retries: 0 });
  const translated = String(response?.choices?.[0]?.message?.content || '').trim();
  if (!translated) throw new Error(`第 ${index + 1} 段翻译为空`);
  return translated.replace(/^```(?:\w+)?\s*|```$/g, '').trim();
}

async function translateContentChunksSafely({ callLLM, config, targetLanguage, chunks }) {
  const translatedChunks = [];
  const warnings = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      translatedChunks.push(await translateContentChunk({ callLLM, config, targetLanguage, chunk: chunks[i], index: i, total: chunks.length }));
    } catch (error) {
      warnings.push(error.message || `第 ${i + 1} 段翻译失败`);
      translatedChunks.push(chunks[i]);
    }
  }
  return { content: translatedChunks.join('\n\n'), warnings };
}

function writeNdjson(res, event, data = {}) {
  res.write(`${JSON.stringify({ event, ...data })}\n`);
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
  const sourceLanguage = detectLanguage(`${row.title || ''}\n${row.summary || ''}\n${row.content || ''}`);
  const targetLanguage = resolveTargetLanguage(req.body?.target_language || 'auto', sourceLanguage);
  const force = req.body?.force === true;

  if (!force) {
    const cached = db.prepare(`SELECT title, summary, content, target_language, updated_at
      FROM news_translations
      WHERE news_id = ? AND target_language = ? AND status = 'cached'
      LIMIT 1`).get(row.id, targetLanguage);
    if (cached) return res.json({ success: true, data: { ...cached, cached: true } });
  }

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

    db.prepare(`INSERT INTO news_translations (news_id, target_language, status, updated_at)
      VALUES (?, ?, 'fetching', datetime('now'))
      ON CONFLICT(news_id, target_language) DO UPDATE SET status = 'fetching', error = NULL, updated_at = datetime('now')`).run(row.id, targetLanguage);

    const metadata = await translateMetadata({ callLLM, config, targetLanguage, title: row.title, summary: row.summary });
    const sourceContent = row.content || row.summary || '';
    const chunks = buildTranslationChunks(sourceContent);
    const translated = await translateContentChunksSafely({ callLLM, config, targetLanguage, chunks });
    const translatedContent = translated.content;

    db.prepare(`INSERT INTO news_translations (news_id, target_language, title, summary, content, status, error, updated_at)
      VALUES (?, ?, ?, ?, ?, 'cached', NULL, datetime('now'))
      ON CONFLICT(news_id, target_language) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        content = excluded.content,
        status = 'cached',
        error = NULL,
        updated_at = datetime('now')`).run(row.id, targetLanguage, metadata.title, metadata.summary, translatedContent || metadata.summary);

    res.json({
      success: true,
      data: {
        title: metadata.title,
        summary: metadata.summary,
        content: translatedContent || metadata.summary,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        cached: false,
        chunks: chunks.length,
        warnings: translated.warnings,
      },
    });
  } catch (error) {
    try {
      db.prepare(`INSERT INTO news_translations (news_id, target_language, status, error, updated_at)
        VALUES (?, ?, 'failed', ?, datetime('now'))
        ON CONFLICT(news_id, target_language) DO UPDATE SET status = 'failed', error = excluded.error, updated_at = datetime('now')`)
        .run(row.id, targetLanguage, error.message || '翻译失败');
    } catch {}
    res.status(500).json({ success: false, error: error.message || '翻译失败' });
  }
});

// POST 流式翻译新闻：逐段返回 NDJSON，前端可边翻译边显示
router.post('/:id/translate/stream', async (req, res) => {
  const db = getDb();
  let row = db.prepare('SELECT id, title, summary, url, content, cache_status FROM news WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });

  if (!row.content && row.url) {
    await cacheNewsContent(row.id);
    row = db.prepare('SELECT id, title, summary, url, content, cache_status FROM news WHERE id = ?').get(req.params.id);
  }

  const sourceLanguage = detectLanguage(`${row.title || ''}\n${row.summary || ''}\n${row.content || ''}`);
  const targetLanguage = resolveTargetLanguage(req.body?.target_language || 'auto', sourceLanguage);
  const force = req.body?.force === true;

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  writeNdjson(res, 'start', { source_language: sourceLanguage, target_language: targetLanguage });

  try {
    if (!force) {
      const cached = db.prepare(`SELECT title, summary, content, target_language, updated_at
        FROM news_translations
        WHERE news_id = ? AND target_language = ? AND status = 'cached'
        LIMIT 1`).get(row.id, targetLanguage);
      if (cached) {
        writeNdjson(res, 'done', { data: { ...cached, source_language: sourceLanguage, cached: true } });
        return res.end();
      }
    }

    const { getAgentConfig, callLLM } = await import('../services/strategy-agent.js');
    const config = getAgentConfig(db);
    if (!config.apiUrl || !config.apiKey) {
      writeNdjson(res, 'error', { error: 'AI 翻译未配置，请先在设置中配置 AI API。' });
      return res.end();
    }

    db.prepare(`INSERT INTO news_translations (news_id, target_language, status, updated_at)
      VALUES (?, ?, 'fetching', datetime('now'))
      ON CONFLICT(news_id, target_language) DO UPDATE SET status = 'fetching', error = NULL, updated_at = datetime('now')`).run(row.id, targetLanguage);

    const metadata = await translateMetadata({ callLLM, config, targetLanguage, title: row.title, summary: row.summary });
    writeNdjson(res, 'meta', { data: { ...metadata, source_language: sourceLanguage, target_language: targetLanguage } });

    const chunks = buildTranslationChunks(row.content || row.summary || '');
    const translatedChunks = [];
    const warnings = [];
    for (let i = 0; i < chunks.length; i++) {
      let text = chunks[i];
      writeNdjson(res, 'chunk_start', { index: i, total: chunks.length });
      try {
        text = await translateContentChunk({ callLLM, config, targetLanguage, chunk: chunks[i], index: i, total: chunks.length });
      } catch (error) {
        warnings.push(error.message || `第 ${i + 1} 段翻译失败`);
      }
      translatedChunks.push(text);
      writeNdjson(res, 'chunk', { index: i, total: chunks.length, text, warnings: warnings.slice() });
    }

    const content = translatedChunks.join('\n\n');
    db.prepare(`INSERT INTO news_translations (news_id, target_language, title, summary, content, status, error, updated_at)
      VALUES (?, ?, ?, ?, ?, 'cached', NULL, datetime('now'))
      ON CONFLICT(news_id, target_language) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        content = excluded.content,
        status = 'cached',
        error = NULL,
        updated_at = datetime('now')`).run(row.id, targetLanguage, metadata.title, metadata.summary, content || metadata.summary);

    writeNdjson(res, 'done', { data: { ...metadata, content: content || metadata.summary, source_language: sourceLanguage, target_language: targetLanguage, cached: false, chunks: chunks.length, warnings } });
    res.end();
  } catch (error) {
    try {
      db.prepare(`INSERT INTO news_translations (news_id, target_language, status, error, updated_at)
        VALUES (?, ?, 'failed', ?, datetime('now'))
        ON CONFLICT(news_id, target_language) DO UPDATE SET status = 'failed', error = excluded.error, updated_at = datetime('now')`)
        .run(row.id, targetLanguage, error.message || '翻译失败');
    } catch {}
    writeNdjson(res, 'error', { error: error.message || '翻译失败' });
    res.end();
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
