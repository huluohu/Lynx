import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger.js';

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

export function authMiddleware(req, res, next) {
  if (req.path === '/api/health' || req.path === '/api/auth/login') return next();
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

  router.post('/login', (req, res) => {
    const { username, password, rememberMe } = req.body;
    if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
      log.warn('Login failed', { username, ip: req.ip });
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    const expiry = rememberMe ? TOKEN_EXPIRY_REMEMBER : TOKEN_EXPIRY;
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: expiry });
    log.info('Login successful', { username, ip: req.ip, rememberMe: !!rememberMe });
    res.json({ success: true, data: { token, username, expiresIn: expiry } });
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
