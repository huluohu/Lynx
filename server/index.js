import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { runMigrations, closeDb } from './db/database.js';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3456;

// ===== 数据库迁移 =====
runMigrations();

const app = express();
app.use(express.json());

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

// ===== 静态文件（生产环境） =====
const distDir = join(__dirname, '..', 'client', 'dist');
if (!existsSync(distDir)) {
  console.log('📦 开发模式：API 就绪，前端请用 Vite');
} else {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    let html = readFileSync(join(distDir, 'index.html'), 'utf8');
    res.type('html').send(html);
  });
}

// ===== 启动 =====
app.listen(PORT, () => {
  console.log(`🚀 投资罗盘 · InvestCompass at http://localhost:${PORT}`);
  console.log(`   Database: ${process.env.DB_PATH || 'data/invest.db'}`);
});

// 优雅关闭
process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
