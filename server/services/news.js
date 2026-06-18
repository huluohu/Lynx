import { getDb } from '../db/database.js';
import { httpGet } from './price.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('news');

export const NEWS_CATEGORIES = Object.freeze([
  'markets',
  'macro',
  'equity',
  'crypto',
  'precious_metals',
  'forex',
  'commodities',
  'strategy',
  'risk',
  'other',
]);

const CATEGORY_PRIORITY = ['risk', 'crypto', 'precious_metals', 'forex', 'commodities', 'equity', 'macro', 'strategy', 'markets', 'other'];
const SOURCE_CATEGORY_HINTS = new Map([
  ['coindesk', 'crypto'],
  ['cointelegraph', 'crypto'],
  ['decrypt', 'crypto'],
  ['crypto.news', 'crypto'],
  ['blockchain.news', 'crypto'],
  ['panews', 'crypto'],
  ['bitcoin magazine', 'crypto'],
  ['coingecko trending', 'crypto'],
  ['kitco news', 'precious_metals'],
  ['fxstreet', 'forex'],
  ['yahoo finance', 'markets'],
  ['bbc business', 'macro'],
  ['bbc world', 'risk'],
  ['cnbc economy', 'macro'],
  ['cnbc world', 'risk'],
  ['china daily business', 'macro'],
  ['china daily china', 'macro'],
  ['china daily world', 'risk'],
]);

const CATEGORY_KEYWORDS = {
  risk: ['hack', 'exploit', 'fraud', 'lawsuit', 'sued', 'sanction', 'ban', 'liquidation', 'bankruptcy', 'default', 'warning', 'risk', 'war', 'conflict', 'geopolitical', 'geopolitics', 'tariff', 'trade war', 'election', 'military', 'diplomatic', '警告', '风险', '暴雷', '破产', '黑客', '诉讼', '制裁', '清算', '违约', '监管', '战争', '冲突', '地缘', '关税', '贸易战', '选举', '军事', '外交'],
  crypto: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'token', 'defi', 'nft', 'stablecoin', 'binance', 'coinbase', 'solana', 'xrp', 'doge', '加密', '比特币', '以太坊', '区块链', '代币', '稳定币'],
  precious_metals: ['gold', 'silver', 'xau', 'xag', 'kitco', 'bullion', 'precious metal', '黄金', '白银', '金价', '银价', '贵金属'],
  forex: ['forex', 'fx', 'currency', 'dollar', 'euro', 'yen', 'yuan', 'usd', 'eur/usd', 'usd/cny', 'dxy', '汇率', '外汇', '美元', '欧元', '日元', '人民币'],
  commodities: ['oil', 'crude', 'brent', 'wti', 'gas', 'copper', 'commodity', 'opec', 'soybean', 'wheat', '原油', '石油', '天然气', '铜', '大宗商品', '欧佩克'],
  equity: ['stock', 'stocks', 'shares', 'equities', 'earnings', 'revenue', 'nasdaq', 's&p', 'dow', 'ipo', 'dividend', 'tesla', 'nvidia', 'apple', '股票', '股市', '美股', '港股', 'a股', '财报', '纳斯达克', '标普'],
  macro: ['fed', 'federal reserve', 'inflation', 'cpi', 'ppi', 'gdp', 'rates', 'treasury', 'bond', 'yield', 'unemployment', 'jobs', 'central bank', 'economy', 'recession', 'fomc', 'policy', 'politics', 'government', 'china', 'domestic demand', 'trade', 'import', 'export', '通胀', '利率', '央行', '美联储', '经济', '衰退', '国债', '就业', '政策', '政治', '政府', '国内', '内需', '贸易', '进口', '出口'],
  strategy: ['strategy', 'analysis', 'forecast', 'outlook', 'technical', 'support', 'resistance', 'portfolio', 'allocation', 'trading plan', '策略', '分析', '展望', '预测', '技术', '支撑', '阻力', '配置'],
  markets: ['market', 'markets', 'rally', 'selloff', 'futures', 'index', 'indices', 'volatility', '行情', '市场', '指数', '期货', '波动', '反弹', '下跌'],
};

export function normalizeNewsCategory(value) {
  const category = String(value || '').trim();
  return NEWS_CATEGORIES.includes(category) ? category : '';
}

function addCategoryScore(scores, category, amount = 1) {
  if (!NEWS_CATEGORIES.includes(category)) return;
  scores[category] = (scores[category] || 0) + amount;
}

function scoreKeywords(scores, text) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) addCategoryScore(scores, category, 1);
    }
  }
}

export function categorizeNewsItem(item = {}, source = {}) {
  const explicit = normalizeNewsCategory(item.category || source.category);
  if (explicit) return explicit;

  const scores = {};
  const sourceKey = String(source.key || '').toLowerCase();
  const sourceName = String(item.source || source.name || '').toLowerCase();
  const sourceType = String(source.type || '').toLowerCase();
  const assetType = String(source.assetType || '').toLowerCase();
  const text = `${item.title || ''} ${item.summary || ''} ${item.source || ''} ${source.name || ''}`.toLowerCase();

  for (const [hint, category] of SOURCE_CATEGORY_HINTS.entries()) {
    if (sourceKey === hint || sourceName.includes(hint)) addCategoryScore(scores, category, 3);
  }
  if (sourceType === 'crypto' || assetType === 'crypto') addCategoryScore(scores, 'crypto', 3);
  if (sourceType === 'gold' || assetType === 'gold') addCategoryScore(scores, 'precious_metals', 3);
  if (sourceType === 'markets') addCategoryScore(scores, 'markets', 1);

  scoreKeywords(scores, text);

  let best = '';
  let bestScore = 0;
  for (const category of CATEGORY_PRIORITY) {
    const score = scores[category] || 0;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best || (sourceType === 'markets' ? 'markets' : 'other');
}

// RSS 源配置 (内置)
const BUILTIN_SOURCES = {
  coindesk: {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml',
    type: 'crypto',
    assetType: 'crypto',
  },
  cointelegraph: {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    type: 'crypto',
    assetType: 'crypto',
  },
  decrypt: {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    type: 'crypto',
    assetType: 'crypto',
  },
  crypto_news: {
    name: 'crypto.news',
    url: 'https://crypto.news/feed',
    type: 'crypto',
    assetType: 'crypto',
  },
  yahoo_finance: {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    type: 'markets',
    assetType: 'general',
  },
  blockchain_news: {
    name: 'Blockchain.News',
    url: 'https://blockchain.news/rss',
    type: 'crypto',
    assetType: 'crypto',
  },
  panews: {
    name: 'PANews',
    url: 'https://www.panewslab.com/rss.xml',
    type: 'crypto',
    assetType: 'crypto',
  },
  coingecko: {
    name: 'CoinGecko Trending',
    type: 'trending',
  },
  bitcoin_magazine: {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/.rss/full/',
    type: 'crypto',
    assetType: 'crypto',
  },
  kitco: {
    name: 'Kitco News',
    url: 'https://www.kitco.com/rss/news',
    type: 'gold',
    assetType: 'gold',
  },
  fxstreet: {
    name: 'FXStreet',
    url: 'https://www.fxstreet.com/rss/news',
    type: 'markets',
    assetType: 'general',
  },
  bbc_business: {
    name: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    type: 'macro',
    assetType: 'general',
    category: 'macro',
  },
  bbc_world: {
    name: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    type: 'geopolitics',
    assetType: 'general',
    category: 'risk',
  },
  cnbc_economy: {
    name: 'CNBC Economy',
    url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html',
    type: 'macro',
    assetType: 'general',
    category: 'macro',
  },
  cnbc_world: {
    name: 'CNBC World',
    url: 'https://www.cnbc.com/id/100727362/device/rss/rss.html',
    type: 'geopolitics',
    assetType: 'general',
    category: 'risk',
  },
  china_daily_business: {
    name: 'China Daily Business',
    url: 'https://www.chinadaily.com.cn/rss/bizchina_rss.xml',
    type: 'macro',
    assetType: 'general',
    category: 'macro',
  },
  china_daily_china: {
    name: 'China Daily China',
    url: 'https://www.chinadaily.com.cn/rss/china_rss.xml',
    type: 'domestic',
    assetType: 'general',
    category: 'macro',
  },
  china_daily_world: {
    name: 'China Daily World',
    url: 'https://www.chinadaily.com.cn/rss/world_rss.xml',
    type: 'geopolitics',
    assetType: 'general',
    category: 'risk',
  },
};

const DEFAULT_ENABLED_NEWS_SOURCES = 'coindesk,cointelegraph,decrypt,panews,coingecko,kitco,fxstreet,bbc_business,bbc_world,cnbc_economy,cnbc_world,china_daily_business,china_daily_china,china_daily_world';

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

function decodeXmlBuffer(buffer, headers = {}) {
  const contentType = String(headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
  const head = buffer.subarray(0, Math.min(buffer.length, 512)).toString('latin1').toLowerCase();
  const charset = contentType.match(/charset=([^;\s]+)/)?.[1]
    || head.match(/encoding=["']([^"']+)/)?.[1]
    || 'utf-8';
  const normalized = charset.replace(/^gb2312$/i, 'gb18030').replace(/^gbk$/i, 'gb18030');
  try {
    return new TextDecoder(normalized).decode(buffer);
  } catch {
    return buffer.toString('utf8');
  }
}

// 获取 RSS XML 文本
import https from 'https';
import http from 'http';

function fetchRss(url, _depth = 0) {
  if (_depth > 3) return Promise.resolve('');
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(url, { headers: { 'User-Agent': 'InvestCompass/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          try { redirectUrl = new URL(res.headers.location, url).href; } catch {}
          res.resume();
          return fetchRss(redirectUrl, _depth + 1).then(resolve);
        }
        const chunks = [];
        res.on('data', c => chunks.push(Buffer.from(c)));
        res.on('end', () => resolve(decodeXmlBuffer(Buffer.concat(chunks), res.headers)));
      });
      req.on('error', () => resolve(''));
      req.setTimeout(10000, () => { req.destroy(); resolve(''); });
    } catch (e) {
      log.debug('fetchRss invalid URL', { url, error: e.message });
      resolve('');
    }
  });
}

// Generic HTML page fetcher with browser-like headers
function fetchHtml(url, _depth = 0) {
  if (_depth > 3) return Promise.resolve('');
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        },
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          try { redirectUrl = new URL(res.headers.location, url).href; } catch {}
          res.resume();
          return fetchHtml(redirectUrl, _depth + 1).then(resolve);
        }
        if (res.statusCode !== 200) { res.resume(); return resolve(''); }
        let body = '';
        res.on('data', c => { body += c; if (body.length > 500000) { req.destroy(); resolve(body); } });
        res.on('end', () => resolve(body));
      });
      req.on('error', () => resolve(''));
      req.setTimeout(15000, () => { req.destroy(); resolve(''); });
    } catch (e) {
      log.debug('fetchHtml invalid URL', { url, error: e.message });
      resolve('');
    }
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
      'INSERT OR IGNORE INTO news (title, summary, url, source, published_at, category) VALUES (?, ?, ?, ?, ?, ?)'
    );

    let inserted = 0;
    for (const item of items.slice(0, 15)) {
      // 检查是否已存在（按 URL 去重）
      if (item.url) {
        const exists = db.prepare('SELECT id FROM news WHERE url = ?').get(item.url);
        if (exists) continue;
      }
      const category = categorizeNewsItem(item, source);
      insert.run(item.title, item.summary, item.url, source.name, item.published_at, category);
      inserted++;
    }

    return inserted;
  } catch (e) {
    log.warn('RSS fetch failed', { source: source.name, error: e.message });
    return 0;
  }
}

// 同时尝试 CoinGecko 新闻（/api/v3/news 需要 Pro key，降级为搜索 trending）
async function fetchCoinGeckoNews() {
  try {
    // Use trending search which is available on free tier
    const data = await httpGet('https://api.coingecko.com/api/v3/search/trending', { timeout: 8000 });
    if (!data?.coins?.length) return 0;

    const db = getDb();
    let inserted = 0;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    for (const coin of data.coins.slice(0, 5)) {
      const item = coin.item;
      if (!item?.name) continue;
      const title = `🔥 Trending: ${item.name} (${item.symbol}) — Market Cap Rank #${item.market_cap_rank || '?'}`;
      const url = `https://www.coingecko.com/en/coins/${item.id}`;

      const exists = db.prepare('SELECT id FROM news WHERE url = ?').get(url);
      if (exists) continue;

      db.prepare('INSERT OR IGNORE INTO news (title, summary, url, source, published_at, category) VALUES (?, ?, ?, ?, ?, ?)')
        .run(title, `Score: ${item.score}, Price BTC: ${item.price_btc?.toFixed(8) || 'N/A'}`, url, 'CoinGecko Trending', now, 'crypto');
      inserted++;
    }
    return inserted;
  } catch (e) {
    log.debug('CoinGecko trending fetch failed', { error: e.message });
    return 0;
  }
}

// ===== 获取启用的数据源 =====
function getEnabledSources() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'news_sources_enabled'").get();
  const availableRow = db.prepare("SELECT value FROM settings WHERE key = 'news_sources_available'").get();
  const availableKeys = new Set((availableRow?.value || Object.keys(BUILTIN_SOURCES).join(',')).split(',').map(s => s.trim()).filter(Boolean));
  const configuredValue = row ? String(row.value || '') : DEFAULT_ENABLED_NEWS_SOURCES;
  const enabledKeys = configuredValue.split(',').map(s => s.trim()).filter(Boolean).filter(key => availableKeys.has(key));

  const sources = [];
  for (const key of enabledKeys) {
    if (BUILTIN_SOURCES[key]) {
      sources.push({ ...BUILTIN_SOURCES[key], key });
    }
  }
  
  // Add custom RSS sources
  try {
    const customSources = db.prepare('SELECT name, url FROM custom_news_sources WHERE enabled = 1').all();
    for (const cs of customSources) {
      sources.push({ name: cs.name, url: cs.url, type: 'custom', assetType: 'general', key: `custom_${cs.name}` });
    }
  } catch { /* table may not exist yet */ }
  
  return sources;
}

// ===== 获取刷新间隔 (分钟) =====
export function getNewsRefreshInterval() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'news_refresh_interval'").get();
  return Math.max(5, parseInt(row?.value || '30', 10));
}

export function getNewsAutoCacheSettings() {
  const db = getDb();
  const enabledRow = db.prepare("SELECT value FROM settings WHERE key = 'news_auto_cache'").get();
  const batchRow = db.prepare("SELECT value FROM settings WHERE key = 'news_cache_batch_size'").get();
  const enabled = String(enabledRow?.value ?? 'true') === 'true';
  const batchSize = Math.max(1, Math.min(20, parseInt(batchRow?.value || '5', 10)));
  return { enabled, batchSize };
}

// ===== 主入口：抓取所有源 =====
export async function fetchAllNews() {
  log.info('Fetching news from all sources...');
  const sources = getEnabledSources();
  
  const tasks = sources.map(s => {
    if (s.type === 'trending') return fetchCoinGeckoNews();
    return fetchFromSource(s);
  });
  
  const results = await Promise.allSettled(tasks);

  const total = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
  log.info('News fetch complete', { newArticles: total });

  // 清理30天前的旧新闻
  const db = getDb();
  const deleted = db.prepare("DELETE FROM news WHERE published_at < datetime('now', '-30 days')").run();
  if (deleted.changes > 0) {
    log.info('Cleaned old news', { removed: deleted.changes });
  }

  const autoCache = getNewsAutoCacheSettings();
  if (autoCache.enabled) {
    cachePendingNews(autoCache.batchSize)
      .then((cached) => {
        if (cached > 0) {
          log.info('News details auto-cached', { cached });
        }
      })
      .catch((error) => {
        log.warn('News auto-cache failed', { error: error.message });
      });
  }

  return total;
}

// ===== 手动触发接口用 =====
export async function refreshNews() {
  return await fetchAllNews();
}

// ===== 异步缓存新闻详情 =====
export async function cacheNewsContent(newsId) {
  const db = getDb();
  const row = db.prepare('SELECT id, url, cache_status FROM news WHERE id = ?').get(newsId);
  if (!row || !row.url) return null;
  if (row.cache_status === 'cached') return row;

  db.prepare("UPDATE news SET cache_status = 'fetching' WHERE id = ?").run(newsId);

  try {
    const html = await fetchHtml(row.url);
    if (!html || html.length < 100) throw new Error('Empty or too short response');

    const content = extractArticleText(html);
    if (!content || content.length < 50) throw new Error('Could not extract article content');

    db.prepare("UPDATE news SET content = ?, cache_status = 'cached' WHERE id = ?").run(content, newsId);
    log.debug('News cached', { newsId, contentLength: content.length });
    return { id: newsId, content, cache_status: 'cached' };
  } catch (e) {
    db.prepare("UPDATE news SET cache_status = 'failed' WHERE id = ?").run(newsId);
    log.debug('News content cache failed', { newsId, error: e.message });
    return { id: newsId, content: null, cache_status: 'failed' };
  }
}

// Batch cache pending news in background
export async function cachePendingNews(limit = 5) {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM news WHERE url IS NOT NULL AND url != '' AND cache_status = 'pending' ORDER BY created_at DESC LIMIT ?").all(limit);
  let cached = 0;
  for (const row of rows) {
    const result = await cacheNewsContent(row.id);
    if (result?.cache_status === 'cached') cached++;
  }
  return cached;
}

function extractArticleText(html) {
  if (!html) return '';
  // Remove scripts, styles, nav, header, footer
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');
  // Extract paragraphs
  const paragraphs = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRe.exec(text)) !== null) {
    const clean = cleanHtml(m[1]);
    if (clean.length > 20) paragraphs.push(clean);
  }
  if (paragraphs.length >= 2) return paragraphs.join('\n\n');
  // Fallback: strip all tags
  return cleanHtml(text).slice(0, 5000);
}
