import { getDb } from '../db/database.js';
import { httpGet } from './price.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('news');

// RSS 源配置
const RSS_SOURCES = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    type: 'crypto',
    assetType: 'crypto',
  },
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    type: 'crypto',
    assetType: 'crypto',
  },
];

// 简易 XML 解析 — 提取 RSS <item> 节点
function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');
    if (title) {
      items.push({
        title: cleanHtml(title).slice(0, 200),
        url: link || '',
        summary: cleanHtml(description).slice(0, 300),
        published_at: pubDate ? normalizeDate(pubDate) : new Date().toISOString(),
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(dateStr) {
  try {
    return new Date(dateStr).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}

// 获取 RSS XML 文本
import https from 'https';
import http from 'http';

function fetchRss(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'InvestCompass/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchRss(res.headers.location).then(resolve);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(10000, () => { req.destroy(); resolve(''); });
  });
}

// 从单个 RSS 源抓取并存入数据库
async function fetchFromSource(source) {
  try {
    const xml = await fetchRss(source.url);
    if (!xml || xml.length < 100) {
      log.debug('Empty RSS response', { source: source.name });
      return 0;
    }

    const items = parseRssItems(xml);
    if (!items.length) {
      log.debug('No items parsed from RSS', { source: source.name });
      return 0;
    }

    const db = getDb();
    const insert = db.prepare(
      'INSERT OR IGNORE INTO news (title, summary, url, source, published_at) VALUES (?, ?, ?, ?, ?)'
    );

    let inserted = 0;
    for (const item of items.slice(0, 15)) {
      // 检查是否已存在（按 URL 去重）
      if (item.url) {
        const exists = db.prepare('SELECT id FROM news WHERE url = ?').get(item.url);
        if (exists) continue;
      }
      insert.run(item.title, item.summary, item.url, source.name, item.published_at);
      inserted++;
    }

    return inserted;
  } catch (e) {
    log.warn('RSS fetch failed', { source: source.name, error: e.message });
    return 0;
  }
}

// 同时尝试 CoinGecko 新闻（JSON API，无需 key）
async function fetchCoinGeckoNews() {
  try {
    const data = await httpGet('https://api.coingecko.com/api/v3/news', { timeout: 8000 });
    if (!data?.data?.length) return 0;

    const db = getDb();
    let inserted = 0;

    for (const item of data.data.slice(0, 10)) {
      if (!item.title) continue;
      const url = item.url || '';
      if (url) {
        const exists = db.prepare('SELECT id FROM news WHERE url = ?').get(url);
        if (exists) continue;
      }
      const publishedAt = item.updated_at
        ? new Date(item.updated_at * 1000).toISOString().replace('T', ' ').slice(0, 19)
        : new Date().toISOString().replace('T', ' ').slice(0, 19);

      db.prepare('INSERT OR IGNORE INTO news (title, summary, url, source, published_at) VALUES (?, ?, ?, ?, ?)')
        .run(item.title.slice(0, 200), (item.description || '').slice(0, 300), url, item.author || 'CoinGecko', publishedAt);
      inserted++;
    }
    return inserted;
  } catch (e) {
    log.debug('CoinGecko news fetch failed', { error: e.message });
    return 0;
  }
}

// ===== 主入口：抓取所有源 =====
export async function fetchAllNews() {
  log.info('Fetching news from all sources...');
  const results = await Promise.allSettled([
    ...RSS_SOURCES.map(s => fetchFromSource(s)),
    fetchCoinGeckoNews(),
  ]);

  const total = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
  log.info('News fetch complete', { newArticles: total });

  // 清理30天前的旧新闻
  const db = getDb();
  const deleted = db.prepare("DELETE FROM news WHERE published_at < datetime('now', '-30 days')").run();
  if (deleted.changes > 0) {
    log.info('Cleaned old news', { removed: deleted.changes });
  }

  return total;
}

// ===== 手动触发接口用 =====
export async function refreshNews() {
  return await fetchAllNews();
}
