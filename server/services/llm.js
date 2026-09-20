/**
 * 共享 LLM 客户端 —— 全系统唯一的 LLM 传输实现。
 *
 * 修复记录（原 strategy-agent.js / ai.js / market-signal.js 等各自持有拷贝，语义漂移）：
 * - 消除 `new Promise(async ...)` 反模式；
 * - API 层错误（鉴权/参数类，返回体带 error）不重试，直接返回结果；
 * - 熔断器只把网络/超时/5xx/解析失败计为失败，带 error 的响应同样计失败，
 *   但不会再出现"对错误响应记成功"的语义 bug。
 */
import http from 'http';
import https from 'https';
import { createLogger } from '../utils/logger.js';

const log = createLogger('llm');

// ============================================================
// Circuit Breaker（进程级共享）
// ============================================================

export const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  threshold: 3,
  resetMs: 5 * 60 * 1000, // 5 minutes
  isOpen() {
    if (this.failures < this.threshold) return false;
    if (Date.now() - this.lastFailure > this.resetMs) {
      this.failures = 0; // reset
      return false;
    }
    return true;
  },
  recordSuccess() { this.failures = 0; },
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    log.warn('Circuit breaker: failure recorded', { failures: this.failures, threshold: this.threshold });
  },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function doLLMRequest(apiUrl, apiKey, model, messages, { temperature, maxTokens, timeout }) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(apiUrl.endsWith('/chat/completions') ? apiUrl : `${apiUrl}/chat/completions`);
    } catch {
      log.error('Invalid LLM api_url', { apiUrl: String(apiUrl).slice(0, 100) });
      return resolve(null);
    }
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const body = JSON.stringify({ model, messages, temperature, max_tokens: maxTokens });
    const opts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = lib.request(opts, (res) => {
      let data = '';
      let totalBytes = 0;
      res.on('data', c => {
        totalBytes += c.length;
        if (totalBytes > 10 * 1024 * 1024) {
          req.destroy();
          return;
        }
        data += c;
      });
      res.on('end', () => {
        if (res.statusCode === 429 || res.statusCode >= 500) {
          log.warn('LLM HTTP error', { status: res.statusCode });
          resolve(null); // 触发重试
          return;
        }
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', (e) => { log.error('LLM request error', { error: e.message }); resolve(null); });
    req.setTimeout(timeout, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

/**
 * 调用 OpenAI Chat Completions 兼容接口。
 * 返回解析后的 JSON 响应；API 层错误时返回 { error }；网络/5xx/解析失败返回 null。
 */
export async function callLLM(apiUrl, apiKey, model, messages, { temperature = 0.7, maxTokens = 4000, timeout = 60000, retries = 2 } = {}) {
  if (circuitBreaker.isOpen()) {
    log.warn('Circuit breaker open, skipping LLM call');
    return null;
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await doLLMRequest(apiUrl, apiKey, model, messages, { temperature, maxTokens, timeout });
    if (result) {
      if (result.error) {
        // API 层错误（鉴权失败、参数非法等）：重试无意义，记一次失败并立即返回
        circuitBreaker.recordFailure();
        log.warn('LLM API error', { error: result.error?.message, attempt: attempt + 1 });
        return result;
      }
      circuitBreaker.recordSuccess();
      return result;
    }
    circuitBreaker.recordFailure();
    if (attempt < retries) {
      log.warn('LLM request failed, retrying', { attempt: attempt + 1 });
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

/**
 * 从 LLM 文本输出中提取 JSON：直接解析 → ```json 代码块 → 首尾大括号截取。
 */
export function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text?.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  const start = text?.indexOf('{');
  const end = text?.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}
