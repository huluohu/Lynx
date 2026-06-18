import http from 'http';
import https from 'https';
import { createLogger } from '../utils/logger.js';
import { getDb } from '../db/database.js';
import {
  isStablePegProfile,
  loadConfiguredSourceEntries,
  loadMarketProfile,
  loadSourceAdapter,
  recordMarketSourceAttempt,
  renderEndpointTemplate,
  resolveProviderSymbol,
  selectCapableSourceEntries,
} from './market-data/config.js';

const log = createLogger('price');
let cachedRate = { usd_cny: 7.25, updated: 0 };

const TROY_OUNCE_GRAMS = 31.1034768;
const DEFAULT_PRECIOUS_METAL_SOURCES = ['sge_sina', 'neodata', 'swissquote'];
const DEFAULT_CRYPTO_SOURCES = ['stablecoin_peg', 'coingecko', 'binance', 'coinbase', 'kraken', 'okx', 'bitstamp', 'gemini'];

function getEnabledMarketSources(key, defaults) {
  try {
    const keys = Array.isArray(key) ? key : [key];
    for (const item of keys) {
      const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(item);
      if (row) return String(row.value || '').split(',').map(s => s.trim()).filter(Boolean);
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
  const db = getDb();
  const enabledBuiltins = builtins.filter((source) => {
    try {
      const row = db.prepare('SELECT enabled FROM market_sources WHERE key = ?').get(source.key);
      return row?.enabled !== 0;
    } catch {
      return true;
    }
  });
  return [...enabledBuiltins, ...custom];
}

function getJsonPathValue(input, path) {
  if (!path) return undefined;
  const normalized = String(path).replace(/^\$\.?/, '').trim();
  if (!normalized) return input;
  return normalized.split('.').reduce((current, part) => {
    if (current == null) return undefined;
    const match = part.match(/^([^[]+)(?:\[(\d+)])?$/);
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
  return String(template || '').replace(/{(asset_id|symbol|provider_symbol|currency|quote_currency|type|subtype)}/g, (_, key) => encodeURIComponent(values[key]));
}

async function fetchCustomHttpSource(asset, source) {
  const config = (() => { try { return JSON.parse(source.config_json || '{}'); } catch { return {}; } })();
  const url = fillTemplate(config.url_template || config.url, asset, source);
  if (!/^https?:\/\//i.test(url)) throw new Error('Invalid custom source URL');
  const headers = config.headers && typeof config.headers === 'object' ? config.headers : {};
  const data = await httpGet(url, { timeout: Number(source.timeout_ms || config.timeout_ms || 5000), headers, throwOnError: true });
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

function providerSymbol(asset, provider, fallback) {
  return resolveProviderSymbol(asset, asset?.__marketProfile, provider, fallback || asset?.symbol || '');
}

function withMarketProfile(asset, profile) {
  return { ...asset, __marketProfile: profile };
}

function normalizeAssetSymbol(asset) {
  return String(asset?.__marketProfile?.baseSymbol || asset?.symbol || '').trim().toUpperCase().replace(/[-_/\s].*$/, '');
}

async function buildStablePegCryptoQuote(asset, profile) {
  const rate = await getUsdCny();
  const symbol = profile?.baseSymbol || normalizeAssetSymbol(asset);
  const pegPrice = Number(profile?.rules?.peg_price || 1);

  return {
    usd: pegPrice,
    cny: Math.round(pegPrice * rate * 100) / 100,
    ch24: 0,
    ch7d: 0,
    source: 'stablecoin_peg',
    details: {
      stablecoin: true,
      symbol,
      peg_currency: profile?.rules?.peg_currency || 'USD',
      resolver: 'configured_profile',
    },
  };
}

function isCryptoAsset(asset) {
  return asset?.type === 'crypto';
}

function isPreciousMetalAsset(asset) {
  const type = String(asset?.type || '').toLowerCase();
  const subtype = String(asset?.subtype || '').toLowerCase();
  const symbol = String(asset?.symbol || '').toUpperCase();
  if (type === 'gold' || type === 'precious_metal') return true;
  if (type && type !== 'unknown') return false;
  if (['gold', 'silver', 'platinum', 'palladium'].includes(subtype)) return true;
  return /^(XAU|XAG|XPT|XPD)(USD|CNY|USDT)?$/.test(symbol)
    || /^(AU|AG)\d{3,6}$/.test(symbol);
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
  return new Promise((resolve, reject) => {
    let settled = false;

    function done(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      if (opts.throwOnError) reject(error);
      else resolve(null);
    }

    try {
      const lib = url.startsWith('https') ? https : http;
      const reqOpts = {
        headers: { 'Accept': 'application/json', 'User-Agent': 'InvestTracker/1.0', ...opts.headers }
      };
      const req = lib.get(url, reqOpts, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            fail(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          try {
            done(JSON.parse(body));
          } catch {
            const summary = String(body || '').slice(0, 120).replace(/\s+/g, ' ');
            fail(new Error(`Invalid JSON response${summary ? `: ${summary}` : ''}`));
          }
        });
      });
      req.on('error', error => fail(new Error(error?.message || 'HTTP request failed')));
      req.setTimeout(opts.timeout || 8000, () => {
        req.destroy();
        fail(new Error(`Request timeout after ${opts.timeout || 8000}ms`));
      });
    } catch (error) {
      fail(error);
    }
  });
}

export function httpGetText(url, opts = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;

    function done(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      if (opts.throwOnError) reject(error);
      else resolve(null);
    }

    try {
      const lib = url.startsWith('https') ? https : http;
      const reqOpts = {
        headers: { 'Accept': '*/*', 'User-Agent': 'InvestTracker/1.0', ...opts.headers }
      };
      const req = lib.get(url, reqOpts, res => {
        const chunks = [];
        res.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            fail(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const buffer = Buffer.concat(chunks);
          const encoding = opts.encoding || 'utf8';
          try {
            done(new TextDecoder(encoding).decode(buffer));
          } catch {
            done(buffer.toString(encoding));
          }
        });
      });
      req.on('error', error => fail(new Error(error?.message || 'HTTP request failed')));
      req.setTimeout(opts.timeout || 8000, () => {
        req.destroy();
        fail(new Error(`Request timeout after ${opts.timeout || 8000}ms`));
      });
    } catch (error) {
      fail(error);
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

  if (!data) {
    throw new Error(`neodata proxy unavailable or returned invalid data on localhost:${port}`);
  }

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

async function fetchConfiguredMarketSource(asset, profile, sourceEntry) {
  const adapter = loadSourceAdapter(sourceEntry.key);
  if (!adapter) return null;

  const provider = providerSymbol(asset, sourceEntry.key, profile?.canonicalSymbol || asset?.symbol);
  if (!provider) throw new Error(`No provider symbol resolved for ${sourceEntry.key}`);

  const url = renderEndpointTemplate(adapter.endpointTemplate, profile, encodeURIComponent(provider));
  const started = Date.now();

  if (adapter.method && adapter.method.toUpperCase() !== 'GET') {
    throw new Error(`Unsupported adapter method ${adapter.method}`);
  }

  let price;
  let parsedCurrency;
  let parsedUnit;
  let details = {};

  if (adapter.adapterType === 'json_http' && adapter.parserType === 'json_path') {
    const data = await httpGet(url, { timeout: adapter.timeoutMs, throwOnError: true, headers: adapter.headers });
    const pricePath = renderEndpointTemplate(adapter.parserConfig.price_path || 'price', profile, provider);
    price = Number(getJsonPathValue(data, pricePath));
    if (adapter.parserConfig.currency_path) parsedCurrency = getJsonPathValue(data, adapter.parserConfig.currency_path);
    if (adapter.parserConfig.unit_path) parsedUnit = getJsonPathValue(data, adapter.parserConfig.unit_path);
    details = {
      parser_type: 'json_path',
      price_path: pricePath,
      timestamp: adapter.parserConfig.timestamp_path ? getJsonPathValue(data, adapter.parserConfig.timestamp_path) : null,
    };
  } else if (adapter.adapterType === 'text_http' && adapter.parserType === 'sina_hq_csv') {
    const text = await httpGetText(url, {
      timeout: adapter.timeoutMs,
      throwOnError: true,
      headers: adapter.headers,
      encoding: adapter.parserConfig.encoding || 'utf8',
    });
    const match = String(text || '').match(/="([^"]*)"/);
    const fields = match?.[1]?.split(',') || [];
    price = Number(fields[Number(adapter.parserConfig.price_index ?? 0)]);
    details = {
      parser_type: 'sina_hq_csv',
      name: fields[Number(adapter.parserConfig.name_index ?? -1)] || null,
      timestamp: fields[Number(adapter.parserConfig.timestamp_index ?? -1)] || null,
    };
  } else if (adapter.adapterType === 'text_http' && adapter.parserType === 'text_regex') {
    const text = await httpGetText(url, {
      timeout: adapter.timeoutMs,
      throwOnError: true,
      headers: adapter.headers,
      encoding: adapter.parserConfig.encoding || 'utf8',
    });
    const pattern = adapter.parserConfig.pattern;
    if (!pattern) throw new Error('text_regex parser requires pattern');
    const flags = adapter.parserConfig.flags || '';
    const match = String(text || '').match(new RegExp(pattern, flags));
    price = Number(match?.[Number(adapter.parserConfig.price_group || 1)]);
    details = { parser_type: 'text_regex', matched: Boolean(match) };
  } else {
    return null;
  }

  const latencyMs = Date.now() - started;

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`${sourceEntry.key} returned no valid price for ${provider}`);
  }

  const quote = {
    price: Math.round(price * 100) / 100,
    currency: String(parsedCurrency || adapter.parserConfig.currency || profile.quoteCurrency || asset?.currency || 'USD').toUpperCase(),
    unit: parsedUnit || adapter.parserConfig.unit || profile.unit || asset?.unit || null,
    source: sourceEntry.key,
    details: {
      ...details,
      provider_symbol: provider,
      market: profile.market,
      exchange: profile.exchange,
      quote_contract: 'market-data-v1',
      profile_source: profile.source,
      latency_ms: latencyMs,
    },
  };
  if (profile.assetClass === 'crypto') {
    if (quote.currency === 'USD') {
      const rate = await getUsdCny();
      quote.usd = quote.price;
      quote.cny = Math.round(quote.price * rate);
    } else if (quote.currency === 'CNY') {
      const rate = await getUsdCny();
      quote.cny = quote.price;
      quote.usd = Math.round((quote.price / rate) * 100) / 100;
    }
    quote.ch24 = 0;
    quote.ch7d = 0;
  }
  recordMarketSourceAttempt({ sourceKey: sourceEntry.key, asset, status: 'success', latencyMs, quote });
  return quote;
}

async function fetchConfiguredAssetPrice(asset) {
  const profile = loadMarketProfile(asset);
  const runtimeAsset = withMarketProfile(asset, profile);
  const sourceEntries = loadConfiguredSourceEntries(profile.assetClass);
  const { selected: enabledSources, skipped } = selectCapableSourceEntries(profile, sourceEntries);
  const failures = skipped.map(item => ({ source: item.source, reason: item.reason, skipped: true }));

  for (const item of skipped) {
    recordMarketSourceAttempt({ sourceKey: item.source, asset, status: 'skipped', reason: item.reason, metadata: { profile } });
  }

  for (const sourceEntry of enabledSources) {
    const source = sourceEntry.key;
    if (isSourceInCooldown(source)) {
      const reason = 'Source in cooldown';
      failures.push({ source, reason });
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'skipped', reason, metadata: { profile } });
      log.debug('Configured source skipped during cooldown', { source, symbol: asset?.symbol, assetClass: profile.assetClass });
      continue;
    }

    const hasAdapter = sourceEntry.source_type === 'custom_http' || Boolean(loadSourceAdapter(source));
    if (!hasAdapter) {
      const reason = 'No adapter configured';
      failures.push({ source, reason, skipped: true });
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'skipped', reason, metadata: { profile } });
      continue;
    }

    try {
      const result = sourceEntry.source_type === 'custom_http'
        ? await fetchCustomHttpSource(runtimeAsset, sourceEntry)
        : await fetchConfiguredMarketSource(runtimeAsset, profile, sourceEntry);
      if (result) {
        recordSourceSuccess(source);
        return result;
      }
      const reason = 'No valid price returned';
      failures.push({ source, reason });
      recordSourceFailure(source, reason);
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'failed', reason, metadata: { profile } });
    } catch (e) {
      const reason = e?.message || 'Source failed';
      failures.push({ source, reason });
      recordSourceFailure(source, reason);
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'failed', reason, metadata: { profile } });
      log.warn('Configured source failed', { source, symbol: asset?.symbol, assetClass: profile.assetClass, error: reason });
    }
  }

  log.debug('No configured market data source produced a price', { symbol: asset?.symbol, assetClass: profile.assetClass, profile, failures });
  return null;
}

async function fetchPreciousMetalSwissquote(asset) {
  const metalCode = resolveMetalCode(asset);
  const instrument = providerSymbol(asset, 'swissquote', `${metalCode}/USD`).toUpperCase();
  const instrumentPath = instrument.split('/').map(part => encodeURIComponent(part)).join('/');
  const data = await httpGet(`https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${instrumentPath}`, { timeout: 4500, throwOnError: true });
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
  const profile = loadMarketProfile(asset);
  const runtimeAsset = withMarketProfile(asset, profile);
  const isLondonGold = profile.market === 'global_spot' || symbol?.includes('AUUSDO') || symbol?.includes('XAUUSD') || currency === 'USD';
  const configuredSources = getMarketSourceEntries('precious_metal', ['market_precious_metal_sources_enabled', 'market_gold_sources_enabled'], DEFAULT_PRECIOUS_METAL_SOURCES);
  const { selected: enabledSources, skipped } = selectCapableSourceEntries(profile, configuredSources);
  const failures = skipped.map(item => ({ source: item.source, reason: item.reason, skipped: true }));
  for (const item of skipped) {
    recordMarketSourceAttempt({ sourceKey: item.source, asset, status: 'skipped', reason: item.reason, metadata: { profile } });
  }

  for (const sourceEntry of enabledSources) {
    const source = sourceEntry.key;
    if (isSourceInCooldown(source)) {
      const reason = 'Source in cooldown';
      failures.push({ source, reason });
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'skipped', reason, metadata: { profile } });
      log.debug('Precious metal source skipped during cooldown', { source, symbol });
      continue;
    }
    try {
      const result = sourceEntry.source_type === 'custom_http'
        ? await fetchCustomHttpSource(runtimeAsset, sourceEntry)
        : await fetchConfiguredMarketSource(runtimeAsset, profile, sourceEntry)
          || (source === 'neodata'
            ? await fetchGoldNeodata(runtimeAsset, isLondonGold)
            : source === 'swissquote'
              ? await fetchPreciousMetalSwissquote(runtimeAsset)
              : null);
      if (result) {
        recordSourceSuccess(source);
        return result;
      }
      const reason = 'No valid price returned';
      failures.push({ source, reason });
      recordSourceFailure(source, reason);
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'failed', reason, metadata: { profile } });
      log.debug('Precious metal source returned no data', { source, symbol });
    } catch (e) {
      const reason = e?.message || 'Source failed';
      failures.push({ source, reason });
      recordSourceFailure(source, reason);
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'failed', reason, metadata: { profile } });
      log.warn('Precious metal source failed', { source, symbol, error: reason });
    }
  }

  log.warn('All precious metal sources failed', { symbol, profile, enabledSources, failures });
  return null;
}

export async function fetchGold(asset) {
  return fetchPreciousMetal(asset);
}

async function fetchCryptoCoinGecko(asset) {
  const symbol = normalizeAssetSymbol(asset);
  const id = providerSymbol(asset, 'coingecko', asset?.subtype || symbol.toLowerCase());
  if (!id) return null;
  const cg = await httpGet(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true`,
    { timeout: 4500, throwOnError: true }
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
  const ticker = await httpGet(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, { timeout: 4500, throwOnError: true });
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
  const data = await httpGet(`https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`, { timeout: 4500, throwOnError: true });
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
  const pairName = `${symbol}USD`;
  const pairParam = providerSymbol(asset, 'kraken', pairName).toUpperCase();
  const data = await httpGet(`https://api.kraken.com/0/public/Ticker?pair=${encodeURIComponent(pairParam)}`, { timeout: 4500, throwOnError: true });
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
  const data = await httpGet(`https://www.okx.com/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`, { timeout: 4500, throwOnError: true });
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
  const data = await httpGet(`https://www.bitstamp.net/api/v2/ticker/${encodeURIComponent(pairName)}/`, { timeout: 4500, throwOnError: true });
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
  const data = await httpGet(`https://api.gemini.com/v2/ticker/${encodeURIComponent(pairName)}`, { timeout: 4500, throwOnError: true });
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
  const profile = loadMarketProfile(asset);
  const runtimeAsset = withMarketProfile(asset, profile);
  const symbol = normalizeAssetSymbol(runtimeAsset);
  log.debug('Fetching crypto price', { symbol });

  if (isStablePegProfile(profile)) {
    log.info('Stablecoin price resolved by configured peg profile', { symbol, profileSource: profile.source });
    const quote = await buildStablePegCryptoQuote(runtimeAsset, profile);
    recordMarketSourceAttempt({ sourceKey: 'stablecoin_peg', asset, status: 'success', quote, metadata: { profile } });
    return quote;
  }

  const configuredSources = getMarketSourceEntries('crypto', ['market_crypto_sources_enabled', 'market_btc_sources_enabled'], DEFAULT_CRYPTO_SOURCES);
  const { selected: enabledSources, skipped } = selectCapableSourceEntries(profile, configuredSources);
  const fetchers = {
    coingecko: fetchCryptoCoinGecko,
    binance: fetchCryptoBinance,
    coinbase: fetchCryptoCoinbase,
    kraken: fetchCryptoKraken,
    okx: fetchCryptoOKX,
    bitstamp: fetchCryptoBitstamp,
    gemini: fetchCryptoGemini,
  };
  const failures = skipped.map(item => ({ source: item.source, reason: item.reason, skipped: true }));
  for (const item of skipped) {
    recordMarketSourceAttempt({ sourceKey: item.source, asset, status: 'skipped', reason: item.reason, metadata: { profile } });
  }

  for (const sourceEntry of enabledSources) {
    const source = sourceEntry.key;
    if (isSourceInCooldown(source)) {
      const reason = 'Source in cooldown';
      failures.push({ source, reason });
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'skipped', reason, metadata: { profile } });
      log.debug('Crypto source skipped during cooldown', { source, symbol });
      continue;
    }
    const fetcher = sourceEntry.source_type === 'custom_http' ? null : fetchers[source];
    const hasConfiguredAdapter = sourceEntry.source_type !== 'custom_http' && Boolean(loadSourceAdapter(source));
    if (!fetcher && !hasConfiguredAdapter && sourceEntry.source_type !== 'custom_http') {
      failures.push({ source, reason: 'No fetcher registered' });
      continue;
    }
    try {
      const result = sourceEntry.source_type === 'custom_http'
        ? await fetchCustomHttpSource(runtimeAsset, sourceEntry)
        : await fetchConfiguredMarketSource(runtimeAsset, profile, sourceEntry) || (fetcher ? await fetcher(runtimeAsset) : null);
      if (result) {
        recordSourceSuccess(source);
        return result;
      }
      const reason = 'No valid price returned';
      failures.push({ source, reason });
      recordSourceFailure(source, reason);
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'failed', reason, metadata: { profile } });
      log.debug('Crypto source returned no data', { source, symbol });
    } catch (e) {
      const reason = e?.message || 'Source failed';
      failures.push({ source, reason });
      recordSourceFailure(source, reason);
      recordMarketSourceAttempt({ sourceKey: source, asset, status: 'failed', reason, metadata: { profile } });
      log.warn('Crypto source failed', { source, symbol, error: reason });
    }
  }

  log.warn('All crypto sources failed', { symbol, profile, enabledSources, failures });
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
    return await fetchConfiguredAssetPrice(asset);
  } catch (e) {
    log.error('fetchPrice exception', { assetId: asset.id, error: e.message });
    return null;
  }
}
