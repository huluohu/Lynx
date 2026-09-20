/**
 * 简单的内存滑动窗口限速器（单进程场景）。
 * 不引入外部依赖；重启后计数清零，对本地/单实例部署足够。
 */

export function createHitCounter({ windowMs = 15 * 60 * 1000, max = 10, lockoutMs = 0 } = {}) {
  const hits = new Map(); // key -> Array<timestamp>
  const lockedUntil = new Map(); // key -> timestamp（达到上限后的锁定）

  return {
    /** 检查并记录一次命中。返回 { ok, retryAfterSec } */
    hit(key) {
      const now = Date.now();
      if (hits.size > 10000) hits.clear();
      if (lockedUntil.size > 10000) lockedUntil.clear();

      const lock = lockedUntil.get(key);
      if (lock && now < lock) {
        return { ok: false, retryAfterSec: Math.ceil((lock - now) / 1000) };
      }
      if (lock && now >= lock) {
        lockedUntil.delete(key);
        hits.delete(key);
      }

      const windowStart = now - windowMs;
      const timestamps = (hits.get(key) || []).filter((ts) => ts > windowStart);
      if (timestamps.length >= max) {
        if (lockoutMs > 0) lockedUntil.set(key, now + lockoutMs);
        return { ok: false, retryAfterSec: Math.ceil((timestamps[0] + windowMs - now) / 1000) || 1 };
      }

      timestamps.push(now);
      hits.set(key, timestamps);
      return { ok: true, retryAfterSec: 0 };
    },
    reset(key) {
      hits.delete(key);
      lockedUntil.delete(key);
    },
  };
}

export default function createRateLimiter(options = {}) {
  const counter = createHitCounter(options);
  return function rateLimit(req, res, next) {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = counter.hit(key);
    if (!result.ok) {
      res.setHeader('Retry-After', String(result.retryAfterSec));
      return res.status(429).json({ success: false, error: `请求过于频繁，请 ${result.retryAfterSec} 秒后重试` });
    }
    next();
  };
}
