/**
 * 日志工具
 * 支持级别控制、结构化输出、请求追踪
 * 
 * 环境变量:
 *   LOG_LEVEL=debug|info|warn|error (默认 info)
 *   LOG_FORMAT=pretty|json (默认 pretty，Docker中建议 json)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 1;
const LOG_FORMAT = process.env.LOG_FORMAT || 'pretty';

function timestamp() {
  return new Date().toISOString();
}

function formatMessage(level, category, message, meta) {
  if (LOG_FORMAT === 'json') {
    return JSON.stringify({ time: timestamp(), level, cat: category, msg: message, ...meta });
  }
  const icon = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level] || '';
  const metaStr = meta && Object.keys(meta).length
    ? ' | ' + Object.entries(meta).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')
    : '';
  return `${timestamp()} ${icon} [${category}] ${message}${metaStr}`;
}

function shouldLog(level) {
  return LEVELS[level] >= LOG_LEVEL;
}

export function createLogger(category) {
  return {
    debug(msg, meta) {
      if (shouldLog('debug')) console.log(formatMessage('debug', category, msg, meta));
    },
    info(msg, meta) {
      if (shouldLog('info')) console.log(formatMessage('info', category, msg, meta));
    },
    warn(msg, meta) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', category, msg, meta));
    },
    error(msg, meta) {
      if (shouldLog('error')) console.error(formatMessage('error', category, msg, meta));
    },
  };
}

/**
 * Express 请求日志中间件
 */
export function requestLogger() {
  const log = createLogger('http');

  return (req, res, next) => {
    const start = Date.now();
    const { method, url } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

      log[level](`${method} ${url} ${status}`, {
        duration: `${duration}ms`,
        ...(status >= 400 ? { ip: req.ip || req.connection?.remoteAddress } : {}),
      });
    });

    next();
  };
}
