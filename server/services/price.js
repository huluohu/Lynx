import http from 'http';
import https from 'https';
import { createLogger } from '../utils/logger.js';
import { getDb } from '../db/database.js';

const log = createLogger('price');
let cachedRate = { usd_cny: 7.25, updated: 0 };

// ===== 获取汇率缓存时长（分钟） =====
function getRateCacheDuration() {
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'rate_cache_duration'").get();
    return Math.max(1, parseInt(row?.value || '60', 10)) * 60 * 1000;
  } catch { return 3600000; }
}

// ===== 汇率 (可配置缓存时长) =====
export async function getUsdCny() {
  const now = Date.now();
  const cacheDuration = getRateCacheDuration();
  if (now - cachedRate.updated < cacheDuration) return cachedRate.usd_cny;

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

// ===== HTTP 工具 =====
export function httpGet(url, opts = {}) {
  return new Promise((resolve) => {
    try {
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
    } catch {
      resolve(null);
    }
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
// Primary: Auth Gateway → 腾讯金融数据中台 neodata (AU9999 + AUUSDO)
// Fallback: metals.live 国际金价 (XAUUSD, free, no key)
export async function fetchGold(asset) {
  const { symbol, currency } = asset;
  const isLondonGold = symbol?.includes('AUUSDO') || symbol?.includes('XAUUSD') || currency === 'USD';

  // --- Primary: neodata via Auth Gateway ---
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
        if (!isLondonGold && d.symbol?.includes('AU9999')) {
          const price = parseFloat(d.new);
          log.info('Gold price (neodata AU9999)', { price });
          return { price, currency: 'CNY', source: 'neodata' };
        }
        if (isLondonGold && d.symbol?.includes('AUUSDO')) {
          const price = parseFloat(d.new);
          log.info('Gold price (neodata AUUSDO)', { price });
          return { price, currency: 'USD', source: 'neodata' };
        }
      }
    }
    log.debug('Neodata: no matching gold symbol', { symbol });
  } catch (e) {
    log.debug('Neodata gold failed (gateway may be offline)', { error: e?.message });
  }

  // --- Fallback: Swissquote (XAU/USD, free, no key) ---
  try {
    const data = await httpGet('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', { timeout: 5000 });
    if (Array.isArray(data) && data.length > 0) {
      const prices = data[0]?.spreadProfilePrices;
      if (prices && prices.length > 0) {
        const xauUsd = (prices[0].bid + prices[0].ask) / 2;
        if (isLondonGold) {
          log.info('Gold price (Swissquote)', { usd: xauUsd.toFixed(2) });
          return { price: Math.round(xauUsd * 100) / 100, currency: 'USD', source: 'swissquote' };
        }
        // AU9999 ≈ XAUUSD × 汇率 ÷ 31.1035 (盎司→克)
        const rate = await getUsdCny();
        const cnPrice = Math.round(xauUsd * rate / 31.1035 * 100) / 100;
        log.info('Gold price (Swissquote→CNY)', { xauUsd: xauUsd.toFixed(2), rate, cnPrice });
        return { price: cnPrice, currency: 'CNY', source: 'swissquote' };
      }
    }
  } catch (e) {
    log.warn('Swissquote gold failed', { error: e?.message });
  }

  log.warn('All gold sources failed', { symbol });
  return null;
}

// ===== BTC 查询 =====
// Primary: CoinGecko (free, no key)
// Fallback: Binance public ticker
export async function fetchBTC() {
  log.debug('Fetching BTC price');

  // --- Primary: CoinGecko ---
  const cg = await httpGet(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_7d_change=true',
    { timeout: 8000 }
  );
  if (cg?.bitcoin) {
    const b = cg.bitcoin;
    log.info('BTC price (CoinGecko)', { usd: b.usd });
    const rate = await getUsdCny();
    return { usd: b.usd, cny: Math.round(b.usd * rate), ch24: b.usd_24h_change || 0, ch7d: b.usd_7d_change || 0 };
  }

  // --- Fallback: Binance ---
  log.debug('CoinGecko failed, trying Binance');
  const ticker = await httpGet('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', { timeout: 5000 });
  if (ticker?.lastPrice) {
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChangePercent) || 0;
    log.info('BTC price (Binance)', { usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24: change, ch7d: 0 };
  }

  log.warn('All BTC sources failed');
  return null;
}

// ===== 统一调度入口 =====
export async function fetchPrice(asset) {
  try {
    if (asset.type === 'gold') {
      return await fetchGold(asset);
    }
    if (asset.type === 'crypto') {
      const data = await fetchBTC();
      if (!data) return null;
      const currency = asset.currency || 'USD';
      const price = currency === 'CNY' ? data.cny : data.usd;
      return { price, currency, source: 'coingecko', details: data };
    }
    log.debug('No fetcher for asset type', { type: asset.type });
    return null;
  } catch (e) {
    log.error('fetchPrice exception', { assetId: asset.id, error: e.message });
    return null;
  }
}
