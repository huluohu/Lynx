import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual, createHash } from 'crypto';
import { createLogger } from '../utils/logger.js';
import createRateLimiter, { createHitCounter } from '../utils/rate-limit.js';

const log = createLogger('auth');

// Security: warn if using default credentials
const JWT_SECRET = process.env.JWT_SECRET || 'lynx-invest-jwt-secret';
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'admin123';
const TOKEN_EXPIRY = '7d';
const TOKEN_EXPIRY_REMEMBER = '30d';

if (!process.env.JWT_SECRET || !process.env.AUTH_PASSWORD) {
  log.warn('⚠️  Using default credentials. Set JWT_SECRET, AUTH_USERNAME, AUTH_PASSWORD env vars for production!');
}

// 登录限速：全局尝试限制 + 失败专用锁定（连续失败 5 次锁 10 分钟）
const loginAttemptLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const loginFailureCounter = createHitCounter({ windowMs: 10 * 60 * 1000, max: 5, lockoutMs: 10 * 60 * 1000 });

function safeEqual(a, b) {
  // 先做定长摘要再比较，避免时序侧信道与长度泄露
  const da = createHash('sha256').update(String(a ?? '')).digest();
  const db = createHash('sha256').update(String(b ?? '')).digest();
  return timingSafeEqual(da, db);
}

function cleanLogValue(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 80);
}

export function authMiddleware(req, res, next) {
  if (req.method === 'OPTIONS') return next();

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    log.warn('Unauthorized request (no token)', { path: req.path, ip: req.ip });
    return res.status(401).json({ success: false, error: '未登录' });
  }

  try {
    const token = auth.slice(7);
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    log.warn('Token verification failed', { path: req.path, reason: e.message });
    return res.status(401).json({ success: false, error: '登录已过期' });
  }
}

export function createAuthRouter() {
  const router = Router();

  router.post('/login', loginAttemptLimiter, (req, res) => {
    const { username, password, rememberMe } = req.body || {};
    const ipKey = req.ip || req.connection?.remoteAddress || 'unknown';

    const failureCheck = loginFailureCounter.hit(`${ipKey}:fail`);
    if (!failureCheck.ok) {
      log.warn('Login blocked: too many failures', { ip: ipKey });
      res.setHeader('Retry-After', String(failureCheck.retryAfterSec));
      return res.status(429).json({ success: false, error: `失败次数过多，请 ${failureCheck.retryAfterSec} 秒后重试` });
    }

    if (!safeEqual(username, AUTH_USERNAME) || !safeEqual(password, AUTH_PASSWORD)) {
      log.warn('Login failed', { username: cleanLogValue(username), ip: ipKey });
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    loginFailureCounter.reset(`${ipKey}:fail`);
    const expiry = rememberMe ? TOKEN_EXPIRY_REMEMBER : TOKEN_EXPIRY;
    const token = jwt.sign({ username: AUTH_USERNAME, role: 'admin' }, JWT_SECRET, { expiresIn: expiry });
    log.info('Login successful', { ip: ipKey, rememberMe: !!rememberMe });
    res.json({ success: true, data: { token, username: AUTH_USERNAME, expiresIn: expiry } });
  });

  router.get('/me', (req, res) => {
    // /me needs auth but is under /api/auth (pre-auth), so verify inline
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    try {
      const user = jwt.verify(auth.slice(7), JWT_SECRET);
      res.json({ success: true, data: { username: user.username, role: user.role } });
    } catch (e) {
      return res.status(401).json({ success: false, error: '登录已过期' });
    }
  });

  return router;
}
