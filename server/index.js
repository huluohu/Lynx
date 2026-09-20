import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { runMigrations, closeDb } from './db/database.js';
import { createLogger, requestLogger } from './utils/logger.js';
import { authMiddleware, createAuthRouter } from './routes/auth.js';
import assetsRouter from './routes/assets.js';
import holdingsRouter from './routes/holdings.js';
import transactionsRouter from './routes/transactions.js';
import strategiesRouter from './routes/strategies.js';
import plansRouter from './routes/plans.js';
import marketRouter from './routes/market.js';
import newsRouter from './routes/news.js';
import historyRouter from './routes/history.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';
import notificationsRouter from './routes/notifications.js';
import signalsRouter from './routes/signals.js';
import systemRouter from './routes/system.js';
import { startMonitor } from './services/strategy-monitor.js';
import { startMarketRefreshScheduler, stopMarketRefreshScheduler } from './services/market-refresh.js';
import { startMarketSignalRefreshScheduler, stopMarketSignalRefreshScheduler } from './services/market-signal-refresh.js';
import { startRetentionScheduler, stopRetentionScheduler } from './services/retention.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3456;
const log = createLogger('server');
function parseDelayMs(value, fallback) {
  const delay = Number(value);
  return Number.isFinite(delay) && delay >= 0 ? delay : fallback;
}
const STARTUP_BACKGROUND_REFRESH = process.env.STARTUP_BACKGROUND_REFRESH !== '0';
const STARTUP_MARKET_REFRESH_DELAY_MS = parseDelayMs(process.env.STARTUP_MARKET_REFRESH_DELAY_MS, 60000);
const STARTUP_SIGNAL_REFRESH_DELAY_MS = parseDelayMs(process.env.STARTUP_SIGNAL_REFRESH_DELAY_MS, 120000);
const STARTUP_NEWS_FETCH_DELAY_MS = parseDelayMs(process.env.STARTUP_NEWS_FETCH_DELAY_MS, 120000);

// ===== 数据库迁移 =====
log.info('Running database migrations...');
runMigrations();
log.info('Database ready');

const app = express();
app.use(express.json());

// ===== 请求日志 =====
app.use(requestLogger());

// ===== CORS =====
// 默认同源部署（前端由本服务托管，Vite dev 走代理），不发 CORS 头。
// 如需跨域访问，设置 CORS_ORIGIN（逗号分隔白名单，如 https://lynx.example.com）。
const CORS_ORIGINS = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ===== Health（无需认证） =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ===== 认证路由（无需认证） =====
app.use('/api/auth', createAuthRouter());

// ===== 认证中间件（以下路由均需登录） =====
app.use('/api', authMiddleware);

// ===== API Routes =====
app.use('/api/assets', assetsRouter);
app.use('/api/holdings', holdingsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/plans', plansRouter);
app.use('/api/market', marketRouter);
app.use('/api/news', newsRouter);
app.use('/api/history', historyRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/system', systemRouter);

// API 404 必须在静态前端兜底之前返回 JSON，避免客户端把 index.html 当 JSON 解析
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// ===== 全局错误处理（必须在所有路由之后） =====
app.use((err, req, res, _next) => {
  log.error('Unhandled error', { path: req.url, error: err.message, stack: err.stack?.split('\n')[1]?.trim() });
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// ===== 静态文件（生产环境） =====
const distDir = join(__dirname, '..', 'client', 'dist');
if (!existsSync(distDir)) {
  log.info('Development mode - API only, use Vite for frontend');
} else {
  app.use(express.static(distDir, {
    setHeaders(res, filePath) {
      const normalizedPath = filePath.replaceAll('\\', '/');
      const fileName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
      if (fileName === 'index.html' || fileName === 'sw.js' || fileName.startsWith('workbox-') || fileName === 'manifest.webmanifest') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (normalizedPath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  app.get('*', (req, res) => {
    let html = readFileSync(join(distDir, 'index.html'), 'utf8');
    res
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .set('Pragma', 'no-cache')
      .set('Expires', '0')
      .type('html')
      .send(html);
  });
  log.info('Production mode - serving static files from dist/');
}

// 定时拉取新闻（从设置读取间隔）
let newsTimer = null;
export async function scheduleNewsFetch() {
  try {
    const { fetchAllNews, getNewsRefreshInterval } = await import('./services/news.js');
    const intervalMin = getNewsRefreshInterval();
    const intervalMs = intervalMin * 60 * 1000;
    
    if (newsTimer) clearInterval(newsTimer);
    newsTimer = setInterval(async () => {
      try { await fetchAllNews(); } catch (e) {
        log.warn('Scheduled news fetch failed', { error: e.message });
      }
    }, intervalMs);
    log.info('News scheduler set', { intervalMin });
  } catch (e) {
    log.warn('News scheduler setup failed', { error: e.message });
  }
}

// ===== 启动 =====
const server = app.listen(PORT, () => {
  log.info(`InvestCompass started`, { port: PORT, db: process.env.DB_PATH || 'data/lynx.db' });
  startMonitor();
  startMarketRefreshScheduler({ runImmediately: STARTUP_BACKGROUND_REFRESH, initialDelayMs: STARTUP_MARKET_REFRESH_DELAY_MS });
  startMarketSignalRefreshScheduler({ runImmediately: STARTUP_BACKGROUND_REFRESH, initialDelayMs: STARTUP_SIGNAL_REFRESH_DELAY_MS });
  startRetentionScheduler({ runNow: STARTUP_BACKGROUND_REFRESH });
  scheduleNewsFetch();

  if (STARTUP_BACKGROUND_REFRESH) {
    // 启动后延迟拉取新闻，避免和首屏页面加载抢外部网络资源。
    setTimeout(async () => {
      try {
        const { fetchAllNews } = await import('./services/news.js');
        await fetchAllNews();
      } catch (e) {
        log.warn('Initial news fetch failed', { error: e.message });
      }
    }, STARTUP_NEWS_FETCH_DELAY_MS);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log.error('Port already in use', {
      port: PORT,
      hint: `Another Lynx server may already be running. Try: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
    });
  } else {
    log.error('Server failed to start', { error: err.message, stack: err.stack });
  }
  closeDb();
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => { log.info('Shutting down (SIGINT)'); stopMarketRefreshScheduler(); stopMarketSignalRefreshScheduler(); stopRetentionScheduler(); closeDb(); process.exit(0); });
process.on('SIGTERM', () => { log.info('Shutting down (SIGTERM)'); stopMarketRefreshScheduler(); stopMarketSignalRefreshScheduler(); stopRetentionScheduler(); closeDb(); process.exit(0); });
process.on('uncaughtException', (err) => { log.error('Uncaught exception', { error: err.message, stack: err.stack }); process.exit(1); });
process.on('unhandledRejection', (reason) => { log.error('Unhandled rejection', { error: String(reason) }); });
