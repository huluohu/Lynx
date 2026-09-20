/**
 * SSRF 防护 —— 默认宽松，绝不阻断正常访问。
 *
 * 背景：本应用是单管理员、跑在可信网络里的个人工具，行情/资讯源 URL 都由管理员自己配置。
 * 默认模式只做格式校验（http/https），并对解析到私网地址的情况打印一次提示日志，
 * 不做任何拦截——DNS 答案在以下常见环境里都不是"真实公网 IP"，硬拦必然误伤：
 *   - Clash/sing-box 等 TUN 代理的 fake-ip 模式（所有域名解析到 198.18.0.0/15）
 *   - Tailscale / 内网 DNS（自建源就在内网，属于合法场景）
 *
 * STRICT_URL_GUARD=1 开启严格模式：保存与连接时拒绝私网/环回/链路本地地址。
 * 仅建议在把管理接口暴露给不可信网络的部署中使用。
 */
import { lookup as dnsLookup } from 'dns';
import { isIP } from 'net';
import { createLogger } from './logger.js';

const log = createLogger('url-guard');

const warnedHosts = new Set();

export function isStrictUrlGuard() {
  return process.env.STRICT_URL_GUARD === '1' || process.env.ALLOW_PRIVATE_URLS === '0';
}

export function isPrivateIp(ip) {
  const value = String(ip || '').trim();
  if (!value) return true;

  // IPv4-mapped IPv6（::ffff:a.b.c.d）
  const mapped = value.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const candidate = mapped ? mapped[1] : value;

  if (isIP(candidate) === 4) {
    const [a, b] = candidate.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;                       // 0/8, 10/8, 127/8
    if (a === 169 && b === 254) return true;                                  // 链路本地/云元数据
    if (a === 172 && b >= 16 && b <= 31) return true;                         // 172.16/12
    if (a === 192 && b === 168) return true;                                  // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;                        // CGNAT 100.64/10（含 Tailscale）
    if (a >= 224) return true;                                                // 组播/保留
    // 注意：198.18.0.0/15 不在名单中——fake-ip 代理把所有域名解析到该段，
    // 且该段不承载真实内网基础设施。
    return false;
  }

  if (isIP(candidate) === 6) {
    const lower = candidate.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    const first = lower.split(':')[0];
    if (!first) return true;
    const hex = parseInt(first, 16);
    if (Number.isNaN(hex)) return true;
    if (hex >= 0xfc00 && hex <= 0xfdff) return true;                          // ULA fc00::/7
    if (hex >= 0xfe80 && hex <= 0xfebf) return true;                          // 链路本地 fe80::/10
    if (hex >= 0xff00) return true;                                           // 组播 ff00::/8
    return false;
  }

  return true; // 无法识别的格式按私网处理（仅影响严格模式）
}

export function isPrivateHostname(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'local') return true;
  if (isIP(host)) return isPrivateIp(host);
  return false; // 公开域名交由连接时 lookup 判断
}

function warnPrivateOnce(kind, value) {
  const key = `${kind}:${value}`;
  if (warnedHosts.has(key)) return;
  if (warnedHosts.size > 500) warnedHosts.clear();
  warnedHosts.add(key);
  log.warn(`${kind} ${value} 解析/指向私网地址。默认不拦截；如需强制拦截请设置 STRICT_URL_GUARD=1`);
}

/**
 * 校验用户配置的 URL。默认模式只校验格式（解析失败/非 http/https）；
 * 严格模式（STRICT_URL_GUARD=1）额外拒绝私网地址。返回错误消息，合法返回 null。
 */
export function assertPublicHttpUrl(url, { label = 'URL' } = {}) {
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    return `${label} 格式无效`;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return `${label} 仅支持 http/https`;
  }
  if (isPrivateHostname(parsed.hostname)) {
    if (isStrictUrlGuard()) {
      return `${label} 不允许指向内网/本机地址（STRICT_URL_GUARD=1）`;
    }
    warnPrivateOnce('URL', parsed.hostname);
  }
  return null;
}

/**
 * 生成可挂到 http(s).request 的 lookup 选项。
 * 默认模式：正常解析，仅对私网结果打一次提示日志；严格模式：拒绝私网解析结果。
 */
export function createGuardedLookup() {
  return function guardedLookup(hostname, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const strict = isStrictUrlGuard();
    if (strict && isPrivateHostname(hostname)) {
      return process.nextTick(callback, new Error(`Blocked private hostname: ${hostname}`));
    }
    dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = Array.isArray(addresses) ? addresses : [addresses].filter(Boolean);
      const bad = list.find((item) => isPrivateIp(item?.address));
      if (bad) {
        if (strict) {
          return callback(new Error(`Blocked private address: ${bad.address}`));
        }
        warnPrivateOnce('DNS', `${hostname} -> ${bad.address}`);
      }
      if (options && options.all) return callback(null, list);
      const first = list[0];
      if (!first) return callback(new Error(`No address resolved for ${hostname}`));
      callback(null, first.address, first.family);
    });
  };
}
