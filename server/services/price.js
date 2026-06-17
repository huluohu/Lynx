import http from 'http';
import https from 'https';
import { createLogger } from '../utils/logger.js';
import { getDb } from '../db/database.js';

const log = createLogger('price');
let cachedRate = { usd_cny: 7.25, updated: 0 };

const DEFAULT_GOLD_SOURCES = ['neodata', 'swissquote'];
const DEFAULT_BTC_SOURCES = ['coingecko', 'binance', 'coinbase', 'kraken', 'okx', 'bitstamp', 'gemini'];

function getEnabledMarketSources(key, defaults) {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    const sources = String(row?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    return sources.length ? sources : defaults;
  } catch {
    return defaults;
  }
}

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

async function fetchGoldNeodata(asset, isLondonGold) {
  const { symbol } = asset;
  const port = process.env.AUTH_GATEWAY_PORT || 19000;

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
  return null;
}

async function fetchGoldSwissquote(isLondonGold) {
  const data = await httpGet('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', { timeout: 4500 });
  if (Array.isArray(data) && data.length > 0) {
    const prices = data[0]?.spreadProfilePrices;
    if (prices && prices.length > 0) {
      const xauUsd = (prices[0].bid + prices[0].ask) / 2;
      if (isLondonGold) {
        log.info('Gold price (Swissquote)', { usd: xauUsd.toFixed(2) });
        return { price: Math.round(xauUsd * 100) / 100, currency: 'USD', source: 'swissquote' };
      }
      const rate = await getUsdCny();
      const cnPrice = Math.round(xauUsd * rate / 31.1035 * 100) / 100;
      log.info('Gold price (Swissquote→CNY)', { xauUsd: xauUsd.toFixed(2), rate, cnPrice });
      return { price: cnPrice, currency: 'CNY', source: 'swissquote' };
    }
  }
  return null;
}

// ===== 金价查询 =====
export async function fetchGold(asset) {
  const { symbol, currency } = asset;
  const isLondonGold = symbol?.includes('AUUSDO') || symbol?.includes('XAUUSD') || currency === 'USD';
  const enabledSources = getEnabledMarketSources('market_gold_sources_enabled', DEFAULT_GOLD_SOURCES);

  for (const source of enabledSources) {
    try {
      const result = source === 'neodata'
        ? await fetchGoldNeodata(asset, isLondonGold)
        : source === 'swissquote'
          ? await fetchGoldSwissquote(isLondonGold)
          : null;
      if (result) return result;
      log.debug('Gold source returned no data', { source, symbol });
    } catch (e) {
      log.warn('Gold source failed', { source, symbol, error: e?.message });
    }
  }

  log.warn('All gold sources failed', { symbol, enabledSources });
  return null;
}

async function fetchBTCCoinGecko() {
  const cg = await httpGet(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_7d_change=true',
    { timeout: 4500 }
  );
  if (cg?.bitcoin) {
    const b = cg.bitcoin;
    log.info('BTC price (CoinGecko)', { usd: b.usd });
    const rate = await getUsdCny();
    return { usd: b.usd, cny: Math.round(b.usd * rate), ch24: b.usd_24h_change || 0, ch7d: b.usd_7d_change || 0 };
  }
  return null;
}

async function fetchBTCBinance() {
  const ticker = await httpGet('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', { timeout: 4500 });
  if (ticker?.lastPrice) {
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChangePercent) || 0;
    log.info('BTC price (Binance)', { usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24: change, ch7d: 0 };
  }
  return null;
}

async function fetchBTCCoinbase() {
  const data = await httpGet('https://api.coinbase.com/v2/prices/BTC-USD/spot', { timeout: 4500 });
  const price = Number(data?.data?.amount);
  if (Number.isFinite(price) && price > 0) {
    log.info('BTC price (Coinbase)', { usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24: 0, ch7d: 0 };
  }
  return null;
}

async function fetchBTCKraken() {
  const data = await httpGet('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', { timeout: 4500 });
  const pair = data?.result ? Object.values(data.result)[0] : null;
  const price = Number(pair?.c?.[0]);
  const open24 = Number(pair?.o);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('BTC price (Kraken)', { usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0 };
  }
  return null;
}

async function fetchBTCOKX() {
  const data = await httpGet('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT', { timeout: 4500 });
  const item = Array.isArray(data?.data) ? data.data[0] : null;
  const price = Number(item?.last);
  const open24 = Number(item?.open24h);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('BTC price (OKX)', { usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0 };
  }
  return null;
}

async function fetchBTCBitstamp() {
  const data = await httpGet('https://www.bitstamp.net/api/v2/ticker/btcusd/', { timeout: 4500 });
  const price = Number(data?.last);
  const open24 = Number(data?.open);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('BTC price (Bitstamp)', { usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0 };
  }
  return null;
}

async function fetchBTCGemini() {
  const data = await httpGet('https://api.gemini.com/v2/ticker/BTCUSD', { timeout: 4500 });
  const price = Number(data?.close);
  const open24 = Number(data?.open);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('BTC price (Gemini)', { usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0 };
  }
  return null;
}

// ===== BTC 查询 =====
export async function fetchBTC() {
  log.debug('Fetching BTC price');

  const enabledSources = getEnabledMarketSources('market_btc_sources_enabled', DEFAULT_BTC_SOURCES);
  const fetchers = {
    coingecko: fetchBTCCoinGecko,
    binance: fetchBTCBinance,
    coinbase: fetchBTCCoinbase,
    kraken: fetchBTCKraken,
    okx: fetchBTCOKX,
    bitstamp: fetchBTCBitstamp,
    gemini: fetchBTCGemini,
  };

  for (const source of enabledSources) {
    const fetcher = fetchers[source];
    if (!fetcher) continue;
    try {
      const result = await fetcher();
      if (result) return result;
      log.debug('BTC source returned no data', { source });
    } catch (e) {
      log.warn('BTC source failed', { source, error: e?.message });
    }
  }

  log.warn('All BTC sources failed', { enabledSources });
  return null;
}

// ===== 统一调度入口 =====
export async function fetchPrice(asset) {
  try {
    if (asset.data_source === 'manual') {
      log.debug('Manual price source, skipping remote fetch', { assetId: asset.id });
      return null;
    }
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
