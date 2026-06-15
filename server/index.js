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
import { startMonitor } from './services/strategy-monitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3456;
const log = createLogger('server');

// ===== 数据库迁移 =====
log.info('Running database migrations...');
runMigrations();
log.info('Database ready');

const app = express();
app.use(express.json());

// ===== 请求日志 =====
app.use(requestLogger());

// ===== CORS =====
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

// ===== 全局错误处理（必须在所有路由之后） =====
app.use((err, req, res, next) => {
  log.error('Unhandled error', { path: req.url, error: err.message, stack: err.stack?.split('\n')[1]?.trim() });
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// ===== 静态文件（生产环境） =====
const distDir = join(__dirname, '..', 'client', 'dist');
if (!existsSync(distDir)) {
  log.info('Development mode - API only, use Vite for frontend');
} else {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    let html = readFileSync(join(distDir, 'index.html'), 'utf8');
    res.type('html').send(html);
  });
  log.info('Production mode - serving static files from dist/');
}

// ===== 启动 =====
app.listen(PORT, () => {
  log.info(`InvestCompass started`, { port: PORT, db: process.env.DB_PATH || 'data/invest.db' });
  startMonitor();

  // 启动后延迟30秒拉取新闻（避免阻塞启动）
  setTimeout(async () => {
    try {
      const { fetchAllNews } = await import('./services/news.js');
      await fetchAllNews();
    } catch (e) {
      log.warn('Initial news fetch failed', { error: e.message });
    }
  }, 30000);
});

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
scheduleNewsFetch();

// 优雅关闭
process.on('SIGINT', () => { log.info('Shutting down (SIGINT)'); closeDb(); process.exit(0); });
process.on('SIGTERM', () => { log.info('Shutting down (SIGTERM)'); closeDb(); process.exit(0); });
process.on('uncaughtException', (err) => { log.error('Uncaught exception', { error: err.message, stack: err.stack }); process.exit(1); });
process.on('unhandledRejection', (reason) => { log.error('Unhandled rejection', { error: String(reason) }); });
