import http from 'http';
import https from 'https';
import { createLogger } from '../utils/logger.js';
import { getDb } from '../db/database.js';

const log = createLogger('price');
let cachedRate = { usd_cny: 7.25, updated: 0 };

const TROY_OUNCE_GRAMS = 31.1034768;
const DEFAULT_PRECIOUS_METAL_SOURCES = ['neodata', 'swissquote'];
const DEFAULT_CRYPTO_SOURCES = ['coingecko', 'binance', 'coinbase', 'kraken', 'okx', 'bitstamp', 'gemini'];
const LEGACY_GOLD_SOURCES = DEFAULT_PRECIOUS_METAL_SOURCES;
const LEGACY_BTC_SOURCES = DEFAULT_CRYPTO_SOURCES;

const COINGECKO_IDS = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  USDT: 'tether',
  USDC: 'usd-coin',
};

function getEnabledMarketSources(key, defaults) {
  try {
    const keys = Array.isArray(key) ? key : [key];
    for (const item of keys) {
      const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(item);
      const sources = String(row?.value || '').split(',').map(s => s.trim()).filter(Boolean);
      if (sources.length) return sources;
    }
    return defaults;
  } catch {
    return defaults;
  }
}

function ensureMarketSource(source) {
  try {
    getDb().prepare(`INSERT OR IGNORE INTO market_sources (key, name, asset_class, source_type, enabled, priority)
      VALUES (?, ?, ?, ?, 1, 100)`).run(source.key, source.name || source.key, source.asset_class || 'all', source.source_type || 'builtin');
  } catch {}
}

function isSourceInCooldown(sourceKey) {
  try {
    const row = getDb().prepare('SELECT cooldown_until FROM market_sources WHERE key = ?').get(sourceKey);
    if (!row?.cooldown_until) return false;
    return new Date(`${row.cooldown_until.replace(' ', 'T')}Z`).getTime() > Date.now();
  } catch {
    return false;
  }
}

function recordSourceSuccess(sourceKey) {
  try {
    getDb().prepare(`UPDATE market_sources
      SET fail_count = 0, last_success_at = datetime('now'), last_error = NULL, cooldown_until = NULL, updated_at = datetime('now')
      WHERE key = ?`).run(sourceKey);
  } catch {}
}

function recordSourceFailure(sourceKey, errorMessage = 'No data') {
  try {
    const db = getDb();
    const row = db.prepare('SELECT fail_count FROM market_sources WHERE key = ?').get(sourceKey);
    const nextFailCount = Number(row?.fail_count || 0) + 1;
    const cooldownMinutes = nextFailCount >= 10 ? 30 : nextFailCount >= 3 ? 5 : 0;
    db.prepare(`UPDATE market_sources
      SET fail_count = ?, last_error_at = datetime('now'), last_error = ?,
        cooldown_until = CASE WHEN ? > 0 THEN datetime('now', '+' || ? || ' minutes') ELSE cooldown_until END,
        updated_at = datetime('now')
      WHERE key = ?`).run(nextFailCount, String(errorMessage).slice(0, 500), cooldownMinutes, cooldownMinutes, sourceKey);
  } catch {}
}

function getCustomMarketSources(assetClass) {
  try {
    return getDb().prepare(`SELECT * FROM market_sources
      WHERE enabled = 1
        AND source_type = 'custom_http'
        AND asset_class IN (?, 'all')
      ORDER BY priority ASC, id ASC`).all(assetClass);
  } catch {
    return [];
  }
}

function getMarketSourceEntries(assetClass, settingKeys, defaults) {
  const builtinKeys = getEnabledMarketSources(settingKeys, defaults);
  const builtins = builtinKeys.map((key, index) => ({ key, name: key, asset_class: assetClass, source_type: 'builtin', priority: index }));
  const custom = getCustomMarketSources(assetClass);
  for (const source of [...builtins, ...custom]) ensureMarketSource(source);
  return [...builtins, ...custom];
}

function getJsonPathValue(input, path) {
  if (!path) return undefined;
  const normalized = String(path).replace(/^\$\.?/, '').trim();
  if (!normalized) return input;
  return normalized.split('.').reduce((current, part) => {
    if (current == null) return undefined;
    const match = part.match(/^([^[]+)(?:\[(\d+)\])?$/);
    if (!match) return current?.[part];
    const value = current?.[match[1]];
    return match[2] == null ? value : value?.[Number(match[2])];
  }, input);
}

function fillTemplate(template, asset, source) {
  const provider = providerSymbol(asset, source.key, asset?.symbol);
  const values = {
    asset_id: asset?.id || '',
    symbol: asset?.symbol || '',
    provider_symbol: provider,
    currency: asset?.currency || '',
    quote_currency: asset?.quote_currency || asset?.currency || '',
    type: asset?.type || '',
    subtype: asset?.subtype || '',
  };
  return String(template || '').replace(/\{(asset_id|symbol|provider_symbol|currency|quote_currency|type|subtype)\}/g, (_, key) => encodeURIComponent(values[key]));
}

async function fetchCustomHttpSource(asset, source) {
  const config = (() => { try { return JSON.parse(source.config_json || '{}'); } catch { return {}; } })();
  const url = fillTemplate(config.url_template || config.url, asset, source);
  if (!/^https?:\/\//i.test(url)) throw new Error('Invalid custom source URL');
  const headers = config.headers && typeof config.headers === 'object' ? config.headers : {};
  const data = await httpGet(url, { timeout: Number(source.timeout_ms || config.timeout_ms || 5000), headers });
  if (!data) return null;
  const price = Number(getJsonPathValue(data, config.price_path || 'price'));
  if (!Number.isFinite(price) || price <= 0) return null;
  const currency = String(getJsonPathValue(data, config.currency_path) || asset?.currency || 'USD').toUpperCase();
  const timestamp = getJsonPathValue(data, config.timestamp_path);
  return { price, currency, source: source.key, details: { custom: true, timestamp, raw_source: source.name } };
}

export async function testCustomMarketSource(asset, source) {
  return fetchCustomHttpSource(asset, {
    key: source.key || 'custom_test',
    name: source.name || 'Custom test',
    config_json: typeof source.config_json === 'string' ? source.config_json : JSON.stringify(source.config_json || source.config || {}),
    timeout_ms: source.timeout_ms || 5000,
  });
}

function parseProviderSymbols(asset) {
  if (!asset?.provider_symbols) return {};
  try {
    const parsed = typeof asset.provider_symbols === 'string' ? JSON.parse(asset.provider_symbols) : asset.provider_symbols;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function providerSymbol(asset, provider, fallback) {
  const symbols = parseProviderSymbols(asset);
  const value = symbols?.[provider];
  return String(value || fallback || asset?.symbol || '').trim();
}

function normalizeAssetSymbol(asset) {
  return String(asset?.symbol || '').trim().toUpperCase().replace(/[-_/\s].*$/, '');
}

function isCryptoAsset(asset) {
  return asset?.type === 'crypto';
}

function isPreciousMetalAsset(asset) {
  const type = String(asset?.type || '').toLowerCase();
  const symbol = String(asset?.symbol || '').toUpperCase();
  return type === 'gold'
    || type === 'precious_metal'
    || ['XAU', 'XAG', 'XPT', 'XPD', 'AU', 'AG'].some(prefix => symbol.includes(prefix));
}

function resolveMetalCode(asset) {
  const subtype = String(asset?.subtype || '').toLowerCase();
  const symbol = String(asset?.symbol || '').toUpperCase();
  if (subtype === 'silver' || symbol.includes('XAG') || symbol.startsWith('AG')) return 'XAG';
  if (subtype === 'platinum' || symbol.includes('XPT')) return 'XPT';
  if (subtype === 'palladium' || symbol.includes('XPD')) return 'XPD';
  return 'XAU';
}

function normalizeUnit(asset, fallback = 'unit') {
  return String(asset?.unit || fallback).trim() || fallback;
}

async function convertUsdPerOz(usdPerOz, asset) {
  const currency = String(asset?.currency || asset?.quote_currency || 'USD').toUpperCase();
  const unit = normalizeUnit(asset, 'oz').toLowerCase();
  let price = Number(usdPerOz);
  let resolvedCurrency = 'USD';

  if (unit === 'g' || unit === 'gram') price = price / TROY_OUNCE_GRAMS;
  else if (unit === 'kg') price = price / TROY_OUNCE_GRAMS * 1000;

  if (currency === 'CNY') {
    const rate = await getUsdCny();
    price *= rate;
    resolvedCurrency = 'CNY';
  }

  return { price: Math.round(price * 100) / 100, currency: resolvedCurrency };
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
  if (resolveMetalCode(asset) !== 'XAU') return null;
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

async function fetchPreciousMetalSwissquote(asset) {
  const metalCode = resolveMetalCode(asset);
  const instrument = providerSymbol(asset, 'swissquote', `${metalCode}/USD`).toUpperCase();
  const data = await httpGet(`https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${encodeURIComponent(instrument)}`, { timeout: 4500 });
  if (Array.isArray(data) && data.length > 0) {
    const prices = data[0]?.spreadProfilePrices;
    if (prices && prices.length > 0) {
      const usdPerOz = (prices[0].bid + prices[0].ask) / 2;
      const converted = await convertUsdPerOz(usdPerOz, asset);
      log.info('Precious metal price (Swissquote)', { symbol: asset.symbol, instrument, usdPerOz: usdPerOz.toFixed(2), price: converted.price, currency: converted.currency });
      return { ...converted, source: 'swissquote', details: { usd_per_oz: usdPerOz, metal: metalCode, instrument } };
    }
  }
  return null;
}

// ===== 贵金属查询（兼容旧 gold） =====
export async function fetchPreciousMetal(asset) {
  const { symbol, currency } = asset;
  const isLondonGold = symbol?.includes('AUUSDO') || symbol?.includes('XAUUSD') || currency === 'USD';
  const enabledSources = getMarketSourceEntries('precious_metal', ['market_precious_metal_sources_enabled', 'market_gold_sources_enabled'], DEFAULT_PRECIOUS_METAL_SOURCES);

  for (const sourceEntry of enabledSources) {
    const source = sourceEntry.key;
    if (isSourceInCooldown(source)) {
      log.debug('Precious metal source skipped during cooldown', { source, symbol });
      continue;
    }
    try {
      const result = sourceEntry.source_type === 'custom_http'
        ? await fetchCustomHttpSource(asset, sourceEntry)
        : source === 'neodata'
        ? await fetchGoldNeodata(asset, isLondonGold)
        : source === 'swissquote'
          ? await fetchPreciousMetalSwissquote(asset)
          : null;
      if (result) {
        recordSourceSuccess(source);
        return result;
      }
      recordSourceFailure(source, 'No data');
      log.debug('Precious metal source returned no data', { source, symbol });
    } catch (e) {
      recordSourceFailure(source, e?.message || 'Source failed');
      log.warn('Precious metal source failed', { source, symbol, error: e?.message });
    }
  }

  log.warn('All precious metal sources failed', { symbol, enabledSources });
  return null;
}

export async function fetchGold(asset) {
  return fetchPreciousMetal(asset);
}

async function fetchCryptoCoinGecko(asset) {
  const symbol = normalizeAssetSymbol(asset);
  const id = providerSymbol(asset, 'coingecko', COINGECKO_IDS[symbol] || asset?.subtype);
  if (!id) return null;
  const cg = await httpGet(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true`,
    { timeout: 4500 }
  );
  if (cg?.[id]) {
    const b = cg[id];
    log.info('Crypto price (CoinGecko)', { symbol, id, usd: b.usd });
    const rate = await getUsdCny();
    return { usd: b.usd, cny: Math.round(b.usd * rate), ch24: b.usd_24h_change || 0, ch7d: b.usd_7d_change || 0, source: 'coingecko' };
  }
  return null;
}

async function fetchCryptoBinance(asset) {
  const symbol = providerSymbol(asset, 'binance', `${normalizeAssetSymbol(asset)}USDT`).toUpperCase();
  const ticker = await httpGet(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, { timeout: 4500 });
  if (ticker?.lastPrice) {
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChangePercent) || 0;
    log.info('Crypto price (Binance)', { symbol, usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24: change, ch7d: 0, source: 'binance' };
  }
  return null;
}

async function fetchCryptoCoinbase(asset) {
  const pair = providerSymbol(asset, 'coinbase', `${normalizeAssetSymbol(asset)}-USD`).toUpperCase();
  const data = await httpGet(`https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`, { timeout: 4500 });
  const price = Number(data?.data?.amount);
  if (Number.isFinite(price) && price > 0) {
    log.info('Crypto price (Coinbase)', { pair, usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24: 0, ch7d: 0, source: 'coinbase' };
  }
  return null;
}

async function fetchCryptoKraken(asset) {
  const symbol = normalizeAssetSymbol(asset);
  const pairName = symbol === 'BTC' ? 'XBTUSD' : `${symbol}USD`;
  const pairParam = providerSymbol(asset, 'kraken', pairName).toUpperCase();
  const data = await httpGet(`https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pairParam)}`, { timeout: 4500 });
  const pair = data?.result ? Object.values(data.result)[0] : null;
  const price = Number(pair?.c?.[0]);
  const open24 = Number(pair?.o);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('Crypto price (Kraken)', { pair: pairParam, usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0, source: 'kraken' };
  }
  return null;
}

async function fetchCryptoOKX(asset) {
  const instId = providerSymbol(asset, 'okx', `${normalizeAssetSymbol(asset)}-USDT`).toUpperCase();
  const data = await httpGet(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`, { timeout: 4500 });
  const item = Array.isArray(data?.data) ? data.data[0] : null;
  const price = Number(item?.last);
  const open24 = Number(item?.open24h);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('Crypto price (OKX)', { instId, usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0, source: 'okx' };
  }
  return null;
}

async function fetchCryptoBitstamp(asset) {
  const pairName = providerSymbol(asset, 'bitstamp', `${normalizeAssetSymbol(asset)}USD`).toLowerCase();
  const data = await httpGet(`https://www.bitstamp.net/api/v2/ticker/${encodeURIComponent(pairName)}/`, { timeout: 4500 });
  const price = Number(data?.last);
  const open24 = Number(data?.open);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('Crypto price (Bitstamp)', { pair: pairName, usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0, source: 'bitstamp' };
  }
  return null;
}

async function fetchCryptoGemini(asset) {
  const pairName = providerSymbol(asset, 'gemini', `${normalizeAssetSymbol(asset)}USD`).toUpperCase();
  const data = await httpGet(`https://api.gemini.com/v2/ticker/${encodeURIComponent(pairName)}`, { timeout: 4500 });
  const price = Number(data?.close);
  const open24 = Number(data?.open);
  if (Number.isFinite(price) && price > 0) {
    const ch24 = Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : 0;
    log.info('Crypto price (Gemini)', { pair: pairName, usd: price });
    const rate = await getUsdCny();
    return { usd: price, cny: Math.round(price * rate), ch24, ch7d: 0, source: 'gemini' };
  }
  return null;
}

// ===== 加密货币查询（兼容旧 BTC） =====
export async function fetchCrypto(asset = { symbol: 'BTC', type: 'crypto', currency: 'USD' }) {
  const symbol = normalizeAssetSymbol(asset);
  log.debug('Fetching crypto price', { symbol });

  const enabledSources = getMarketSourceEntries('crypto', ['market_crypto_sources_enabled', 'market_btc_sources_enabled'], DEFAULT_CRYPTO_SOURCES);
  const fetchers = {
    coingecko: fetchCryptoCoinGecko,
    binance: fetchCryptoBinance,
    coinbase: fetchCryptoCoinbase,
    kraken: fetchCryptoKraken,
    okx: fetchCryptoOKX,
    bitstamp: fetchCryptoBitstamp,
    gemini: fetchCryptoGemini,
  };

  for (const sourceEntry of enabledSources) {
    const source = sourceEntry.key;
    if (isSourceInCooldown(source)) {
      log.debug('Crypto source skipped during cooldown', { source, symbol });
      continue;
    }
    const fetcher = sourceEntry.source_type === 'custom_http' ? null : fetchers[source];
    if (!fetcher && sourceEntry.source_type !== 'custom_http') continue;
    try {
      const result = sourceEntry.source_type === 'custom_http'
        ? await fetchCustomHttpSource(asset, sourceEntry)
        : await fetcher(asset);
      if (result) {
        recordSourceSuccess(source);
        return result;
      }
      recordSourceFailure(source, 'No data');
      log.debug('Crypto source returned no data', { source, symbol });
    } catch (e) {
      recordSourceFailure(source, e?.message || 'Source failed');
      log.warn('Crypto source failed', { source, symbol, error: e?.message });
    }
  }

  log.warn('All crypto sources failed', { symbol, enabledSources });
  return null;
}

export async function fetchBTC() {
  return fetchCrypto({ symbol: 'BTC', type: 'crypto', currency: 'USD', subtype: 'bitcoin', unit: 'coin' });
}

// ===== 统一调度入口 =====
export async function fetchPrice(asset) {
  try {
    if (asset.data_source === 'manual') {
      log.debug('Manual price source, skipping remote fetch', { assetId: asset.id });
      return null;
    }
    if (isPreciousMetalAsset(asset)) {
      return await fetchPreciousMetal(asset);
    }
    if (isCryptoAsset(asset)) {
      const data = await fetchCrypto(asset);
      if (!data) return null;
      const currency = asset.currency || 'USD';
      const price = currency === 'CNY' ? data.cny : data.usd;
      return { price, currency, source: data.source || 'crypto', details: data };
    }
    log.debug('No fetcher for asset type', { type: asset.type });
    return null;
  } catch (e) {
    log.error('fetchPrice exception', { assetId: asset.id, error: e.message });
    return null;
  }
}
