import http from 'http';
import https from 'https';
import { createLogger } from '../utils/logger.js';

const log = createLogger('price');
let cachedRate = { usd_cny: 7.25, updated: 0 };

// 获取实时汇率（缓存1小时）
async function getUsdCny() {
  const now = Date.now();
  if (now - cachedRate.updated < 3600000) return cachedRate.usd_cny;

  // 尝试免费汇率 API
  try {
    const data = await httpGet('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
    if (data?.rates?.CNY) {
      cachedRate = { usd_cny: data.rates.CNY, updated: now };
      log.info('USD/CNY rate updated', { rate: data.rates.CNY });
      return cachedRate.usd_cny;
    }
  } catch (e) {
    log.warn('Failed to fetch USD/CNY rate', { error: e.message });
  }

  return cachedRate.usd_cny;
}

export function httpGet(url, opts = {}) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const reqOpts = {
      headers: { 'Accept': 'application/json', 'User-Agent': 'InvestTracker/1.0', ...opts.headers }
    };
    const req = lib.get(url, reqOpts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(opts.timeout || 8000, () => { req.destroy(); resolve(null); });
  });
}

export function httpPost(hostname, port, pathname, body, headers = {}) {
  return new Promise((resolve) => {
    const opts = { hostname, port, path: pathname, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ===== 金价查询 =====
export async function fetchGold(assetId, symbol) {
  // Primary: Auth Gateway proxy
  const port = process.env.AUTH_GATEWAY_PORT || 19000;
  try {
    const body = JSON.stringify({
      sub_channel: 'qclaw',
      query: `${symbol} 黄金价格`,
      request_id: String(Date.now()),
      data_type: 'api'
    });

    const data = await httpPost('localhost', port, '/proxy/api', body, {
      'Remote-URL': 'https://jprx.m.qq.com/aizone/skillserver/v1/proxy/teamrouter_neodata/query',
    });

    const apiData = data?.data?.apiData?.apiRecall || [];
    for (const item of apiData) {
      for (const d of item.data || []) {
        if (assetId === 1 && d.symbol?.includes('AU9999')) return parseFloat(d.new);
        if (assetId === 2 && d.symbol?.includes('AUUSDO')) return parseFloat(d.new);
      }
    }
  } catch {}

  // Fallback: 通过公开 API 获取国际金价
  try {
    // XAUUSD from metals.live (free, no key)
    const metals = await httpGet('https://api.metals.live/v1/spot', { timeout: 5000 });
    if (Array.isArray(metals)) {
      const gold = metals.find(m => m.gold !== undefined);
      if (gold) {
        const xauUsd = parseFloat(gold.gold);
        if (assetId === 2) return xauUsd; // 伦敦金 USD
        if (assetId === 1) {
          // AU9999 ≈ XAUUSD * 汇率 / 31.1035 (盎司→克)
          const rate = await getUsdCny();
          return Math.round(xauUsd * rate / 31.1035 * 100) / 100;
        }
      }
    }
  } catch {}

  return null;
}

// ===== BTC 查询 =====
export async function fetchBTC() {
  // Primary: CoinGecko
  log.debug('Fetching BTC price from CoinGecko');
  const body = await httpGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_7d_change=true');
  const b = body?.bitcoin;
  if (b) {
    log.info('BTC price fetched (CoinGecko)', { usd: b.usd });
    const rate = await getUsdCny();
    return {
      usd: b.usd,
      cny: Math.round(b.usd * rate),
      ch24: b.usd_24h_change || 0,
      ch7d: b.usd_7d_change || 0,
    };
  }

  // Fallback: Binance public API
  log.info('CoinGecko failed, trying Binance fallback');
  const ticker = await httpGet('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', { timeout: 5000 });
  if (ticker?.lastPrice) {
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChangePercent) || 0;
    log.info('BTC price fetched (Binance)', { usd: price });
    const rate = await getUsdCny();
    return {
      usd: price,
      cny: Math.round(price * rate),
      ch24: change,
      ch7d: 0,
    };
  }

  log.warn('All BTC price sources failed');
  return null;
}

// ===== 根据 asset 类型调度 =====
export async function fetchPrice(asset) {
  try {
    if (asset.type === 'gold') {
      const price = await fetchGold(asset.id, asset.symbol);
      if (price) {
        log.debug('Gold price resolved', { assetId: asset.id, price });
        return { price, currency: 'CNY', source: 'neodata' };
      }
      log.warn('Gold price fetch failed', { assetId: asset.id, symbol: asset.symbol });
      return null;
    }
    if (asset.type === 'crypto') {
      const data = await fetchBTC();
      if (!data) return null;
      return { price: data.usd, currency: 'USD', source: 'coingecko', details: data };
    }
    log.debug('No price fetcher for asset type', { type: asset.type });
    return null;
  } catch (e) {
    log.error('fetchPrice exception', { assetId: asset.id, error: e.message });
    return null;
  }
}
