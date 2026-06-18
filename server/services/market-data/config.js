import { getDb } from '../../db/database.js';

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function parseJsonList(value) {
  const parsed = parseJson(value, []);
  if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
  if (typeof parsed === 'string') return parsed.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

function parseJsonObject(value) {
  const parsed = parseJson(value, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function parseProviderSymbols(asset) {
  return parseJsonObject(asset?.provider_symbols);
}

export function normalizeInputSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

export function normalizeAssetClass(asset) {
  const type = String(asset?.type || '').trim().toLowerCase();
  if (type === 'gold') return 'precious_metal';
  return type || 'unknown';
}

function normalizeProfileRow(row, asset, source = 'configured') {
  const identifiers = parseJsonObject(row?.identifiers_json);
  const providerSymbols = parseProviderSymbols(asset);
  const rules = parseJsonObject(row?.rules_json);
  const assetClass = row?.asset_class || normalizeAssetClass(asset);
  const symbol = normalizeInputSymbol(asset?.symbol || row?.canonical_symbol || row?.input_symbol);

  return {
    assetId: asset?.id ?? row?.asset_id ?? null,
    assetClass,
    instrumentType: row?.instrument_type || null,
    baseSymbol: normalizeInputSymbol(row?.base_symbol || row?.canonical_symbol || symbol),
    quoteCurrency: normalizeInputSymbol(row?.quote_currency || asset?.quote_currency || asset?.currency || 'USD'),
    unit: String(row?.unit || asset?.unit || 'unit').trim().toLowerCase(),
    market: row?.market || null,
    exchange: row?.exchange || null,
    region: row?.region || null,
    canonicalSymbol: normalizeInputSymbol(row?.canonical_symbol || symbol),
    symbol,
    identifiers: { ...identifiers, ...providerSymbols },
    rules,
    source,
    raw: asset,
  };
}

function inferProfile(asset) {
  const assetClass = normalizeAssetClass(asset);
  const symbol = normalizeInputSymbol(asset?.symbol);
  const quoteCurrency = normalizeInputSymbol(asset?.quote_currency || asset?.currency || 'USD');
  const unit = String(asset?.unit || (assetClass === 'crypto' ? 'coin' : 'unit')).trim().toLowerCase();

  return {
    assetId: asset?.id ?? null,
    assetClass,
    instrumentType: assetClass === 'crypto' ? 'spot' : null,
    baseSymbol: symbol.replace(/[-_/\s].*$/, ''),
    quoteCurrency,
    unit,
    market: assetClass === 'crypto' ? 'crypto_spot' : null,
    exchange: null,
    region: assetClass === 'crypto' ? 'global' : null,
    canonicalSymbol: symbol,
    symbol,
    identifiers: parseProviderSymbols(asset),
    rules: {},
    source: 'inferred',
    raw: asset,
  };
}

export function loadMarketProfile(asset = {}) {
  const db = getDb();

  try {
    if (asset?.id != null) {
      const row = db.prepare(`SELECT * FROM market_asset_profiles
        WHERE asset_id = ? AND enabled = 1
        ORDER BY id DESC LIMIT 1`).get(asset.id);
      if (row) return normalizeProfileRow(row, asset, row.profile_source || 'configured');
    }
  } catch {}

  try {
    const assetClass = normalizeAssetClass(asset);
    const symbol = normalizeInputSymbol(asset?.symbol);
    const row = db.prepare(`SELECT * FROM asset_symbol_mappings
      WHERE enabled = 1
        AND asset_class = ?
        AND upper(input_symbol) = ?
      ORDER BY priority ASC, id ASC LIMIT 1`).get(assetClass, symbol);
    if (row) return normalizeProfileRow(row, asset, 'mapping');
  } catch {}

  return inferProfile(asset);
}

function matchesValue(actual, allowed = []) {
  if (!allowed.length || allowed.includes('*')) return true;
  if (actual == null || actual === '') return false;
  const normalized = String(actual).trim();
  return allowed.some(item => String(item).trim().toUpperCase() === normalized.toUpperCase());
}

function hasRequiredIdentifiers(profile, required = []) {
  return required.every(key => profile.identifiers?.[key]);
}

function buildCapability(row) {
  return {
    sourceKey: row.source_key,
    assetClass: row.asset_class,
    instrumentType: row.instrument_type || null,
    markets: parseJsonList(row.markets_json),
    exchanges: parseJsonList(row.exchanges_json),
    regions: parseJsonList(row.regions_json),
    baseSymbols: parseJsonList(row.base_symbols_json),
    quoteCurrencies: parseJsonList(row.quote_currencies_json),
    units: parseJsonList(row.units_json),
    identifiersRequired: parseJsonList(row.identifiers_required_json),
    priority: Number(row.priority || 100),
    metadata: parseJsonObject(row.metadata_json),
  };
}

export function evaluateCapability(profile, capability) {
  if (capability.assetClass !== profile.assetClass) {
    return { supported: false, reason: `capability mismatch: asset_class=${profile.assetClass}` };
  }
  if (capability.instrumentType && capability.instrumentType !== profile.instrumentType) {
    return { supported: false, reason: `capability mismatch: instrument_type=${profile.instrumentType || 'unknown'}` };
  }

  const checks = [
    ['market', profile.market, capability.markets],
    ['exchange', profile.exchange, capability.exchanges],
    ['region', profile.region, capability.regions],
    ['base_symbol', profile.baseSymbol, capability.baseSymbols],
    ['quote_currency', profile.quoteCurrency, capability.quoteCurrencies],
    ['unit', profile.unit, capability.units],
  ];

  for (const [field, actual, allowed] of checks) {
    if (!matchesValue(actual, allowed)) {
      return { supported: false, reason: `capability mismatch: ${field}=${actual || 'unknown'}` };
    }
  }

  if (!hasRequiredIdentifiers(profile, capability.identifiersRequired)) {
    const missing = capability.identifiersRequired.filter(key => !profile.identifiers?.[key]);
    return { supported: false, reason: `missing provider identifier: ${missing.join(',')}` };
  }

  return { supported: true, reason: null };
}

function getCapabilitiesForSource(db, sourceKey, assetClass) {
  try {
    return db.prepare(`SELECT * FROM market_source_capabilities
      WHERE enabled = 1
        AND source_key = ?
        AND asset_class = ?
      ORDER BY priority ASC, id ASC`).all(sourceKey, assetClass).map(buildCapability);
  } catch {
    return null;
  }
}

export function selectCapableSourceEntries(profile, sourceEntries = []) {
  const db = getDb();
  const selected = [];
  const skipped = [];

  for (const sourceEntry of sourceEntries) {
    if (sourceEntry.source_type === 'custom_http') {
      selected.push(sourceEntry);
      continue;
    }

    const capabilities = getCapabilitiesForSource(db, sourceEntry.key, profile.assetClass);
    if (capabilities == null) {
      selected.push(sourceEntry);
      continue;
    }
    if (!capabilities.length) {
      skipped.push({ source: sourceEntry.key, reason: 'no enabled capability configured' });
      continue;
    }

    const failures = [];
    const matched = capabilities.find(capability => {
      const result = evaluateCapability(profile, capability);
      if (!result.supported) failures.push(result.reason);
      return result.supported;
    });

    if (matched) selected.push({ ...sourceEntry, capability: matched });
    else skipped.push({ source: sourceEntry.key, reason: failures[0] || 'capability mismatch' });
  }

  return { selected, skipped };
}

function renderTemplate(template, profile, providerSymbol) {
  const values = {
    provider_symbol: providerSymbol || '',
    symbol: profile.symbol || '',
    canonical_symbol: profile.canonicalSymbol || '',
    base_symbol: profile.baseSymbol || '',
    quote_currency: profile.quoteCurrency || '',
    unit: profile.unit || '',
    market: profile.market || '',
    exchange: profile.exchange || '',
    region: profile.region || '',
  };

  return String(template || '').replace(/{([^}]+)}/g, (_, key) => {
    const trimmed = String(key).trim();
    if (trimmed.startsWith('identifier.')) {
      return profile.identifiers?.[trimmed.slice('identifier.'.length)] || '';
    }
    return values[trimmed] ?? '';
  });
}

export function resolveProviderSymbol(asset, profile, sourceKey, fallback = '') {
  const providerSymbols = parseProviderSymbols(asset);
  if (providerSymbols[sourceKey]) return String(providerSymbols[sourceKey]).trim();
  if (profile?.identifiers?.[sourceKey]) return String(profile.identifiers[sourceKey]).trim();

  try {
    const row = getDb().prepare(`SELECT * FROM market_source_symbol_rules
      WHERE enabled = 1
        AND source_key = ?
        AND asset_class = ?
        AND (market IS NULL OR market = ?)
        AND (exchange IS NULL OR exchange = ?)
      ORDER BY priority ASC, id ASC LIMIT 1`).get(sourceKey, profile.assetClass, profile.market, profile.exchange);
    if (row?.symbol_template) return renderTemplate(row.symbol_template, profile, fallback).trim();
  } catch {}

  return String(fallback || asset?.symbol || '').trim();
}

export function loadSourceAdapter(sourceKey) {
  try {
    const row = getDb().prepare(`SELECT * FROM market_source_adapters
      WHERE source_key = ? AND enabled = 1`).get(sourceKey);
    if (!row) return null;
    return {
      sourceKey: row.source_key,
      adapterType: row.adapter_type,
      endpointTemplate: row.endpoint_template,
      method: row.method || 'GET',
      headers: parseJsonObject(row.headers_json),
      parserType: row.parser_type,
      parserConfig: parseJsonObject(row.parser_config_json),
      timeoutMs: Number(row.timeout_ms || 5000),
      requiresProxy: row.requires_proxy === 1,
      dependency: parseJsonObject(row.dependency_json),
    };
  } catch {
    return null;
  }
}

export function renderEndpointTemplate(template, profile, providerSymbol) {
  return renderTemplate(template, profile, providerSymbol);
}

export function isStablePegProfile(profile) {
  return profile?.instrumentType === 'stablecoin' && profile?.rules?.peg_currency && Number.isFinite(Number(profile?.rules?.peg_price));
}

export function recordMarketSourceAttempt({ sourceKey, asset, status, reason, latencyMs, quote, metadata }) {
  try {
    getDb().prepare(`INSERT INTO market_source_attempts
      (source_key, asset_id, symbol, status, reason, latency_ms, quote_price, quote_currency, quote_unit, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        sourceKey,
        asset?.id || null,
        asset?.symbol || null,
        status,
        reason || null,
        Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : null,
        quote?.price ?? quote?.usd ?? null,
        quote?.currency || null,
        quote?.unit || null,
        metadata ? JSON.stringify(metadata).slice(0, 2000) : null,
      );
  } catch {}
}

function getSettingValue(key) {
  try {
    return getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '';
  } catch {
    return '';
  }
}

function getSourceSettingKeys(assetClass) {
  if (assetClass === 'crypto') return ['market_crypto_sources_enabled', 'market_btc_sources_enabled'];
  if (assetClass === 'precious_metal') return ['market_precious_metal_sources_enabled', 'market_gold_sources_enabled'];
  return [];
}

export function loadConfiguredSourceEntries(assetClass) {
  const db = getDb();
  const settingKeys = getSourceSettingKeys(assetClass);
  const configuredKeys = settingKeys
    .map(getSettingValue)
    .find(value => String(value || '').trim())
    ?.split(',')
    .map(item => item.trim())
    .filter(Boolean) || [];

  if (configuredKeys.length) {
    return configuredKeys.map((key, index) => {
      const row = (() => {
        try { return db.prepare('SELECT * FROM market_sources WHERE key = ?').get(key); } catch { return null; }
      })();
      if (row?.enabled === 0) return null;
      return {
        key,
        name: row?.name || key,
        asset_class: row?.asset_class || assetClass,
        source_type: row?.source_type || 'builtin',
        priority: row?.priority ?? index,
        cooldown_until: row?.cooldown_until || null,
      };
    }).filter(Boolean);
  }

  try {
    return db.prepare(`SELECT * FROM market_sources
      WHERE enabled = 1
        AND asset_class IN (?, 'all')
      ORDER BY priority ASC, id ASC`).all(assetClass);
  } catch {
    return [];
  }
}

function isCooldownActive(cooldownUntil) {
  if (!cooldownUntil) return false;
  return new Date(`${String(cooldownUntil).replace(' ', 'T')}Z`).getTime() > Date.now();
}

export function explainMarketResolution(asset = {}) {
  const profile = loadMarketProfile(asset);
  const sourceEntries = loadConfiguredSourceEntries(profile.assetClass);
  const { selected, skipped } = selectCapableSourceEntries(profile, sourceEntries);
  const matched = selected.map(source => {
    const providerSymbol = resolveProviderSymbol(asset, profile, source.key, profile.canonicalSymbol || asset.symbol || '');
    const adapter = loadSourceAdapter(source.key);
    return {
      source: source.key,
      name: source.name,
      status: isCooldownActive(source.cooldown_until) ? 'cooldown' : 'matched',
      provider_symbol: providerSymbol || null,
      capability: source.capability || null,
      adapter: adapter ? {
        adapter_type: adapter.adapterType,
        parser_type: adapter.parserType,
        timeout_ms: adapter.timeoutMs,
        has_endpoint_template: Boolean(adapter.endpointTemplate),
      } : null,
    };
  });

  return {
    profile,
    candidates: [
      ...matched,
      ...skipped.map(item => ({ source: item.source, status: 'skipped', reason: item.reason })),
    ],
  };
}

function tableExists(tableName) {
  try {
    return Boolean(getDb().prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
  } catch {
    return false;
  }
}

export function lintMarketDataRules() {
  const db = getDb();
  const issues = [];
  const add = (severity, code, message, details = {}) => issues.push({ severity, code, message, details });

  if (!tableExists('market_source_capabilities')) {
    return [{ severity: 'error', code: 'MISSING_SCHEMA', message: 'market data resolver tables are missing', details: {} }];
  }

  const capabilities = db.prepare('SELECT * FROM market_source_capabilities WHERE enabled = 1').all();
  const mappings = db.prepare('SELECT * FROM asset_symbol_mappings WHERE enabled = 1').all();
  const symbolRules = db.prepare('SELECT * FROM market_source_symbol_rules WHERE enabled = 1').all();
  const adapters = db.prepare('SELECT * FROM market_source_adapters WHERE enabled = 1').all();
  const sources = db.prepare('SELECT * FROM market_sources').all();
  const sourceKeys = new Set(sources.map(row => row.key));
  const adapterKeys = new Set(adapters.map(row => row.source_key));

  for (const cap of capabilities) {
    const metadata = parseJsonObject(cap.metadata_json);
    if (!sourceKeys.has(cap.source_key)) {
      add('error', 'CAPABILITY_SOURCE_MISSING', `capability references missing source ${cap.source_key}`, { source_key: cap.source_key });
    }

    const required = parseJsonList(cap.identifiers_required_json);
    for (const identifier of required) {
      const hasMapping = mappings.some(row => parseJsonObject(row.identifiers_json)[identifier]);
      const hasRule = symbolRules.some(row => row.source_key === identifier || row.source_key === cap.source_key);
      if (!hasMapping && !hasRule) {
        add('warning', 'IDENTIFIER_UNREACHABLE', `required identifier ${identifier} has no mapping or symbol rule`, { source_key: cap.source_key, identifier });
      }
    }

    if (!adapterKeys.has(cap.source_key) && metadata.execution !== 'legacy_fetcher') {
      add('warning', 'MISSING_ADAPTER', `source ${cap.source_key} has no DB adapter configured`, { source_key: cap.source_key });
    }
  }

  const duplicateRows = db.prepare(`SELECT asset_class, upper(input_symbol) AS input_symbol, priority, COUNT(*) AS count
    FROM asset_symbol_mappings
    WHERE enabled = 1
    GROUP BY asset_class, upper(input_symbol), priority
    HAVING COUNT(*) > 1`).all();
  for (const row of duplicateRows) {
    add('error', 'DUPLICATE_MAPPING_PRIORITY', 'multiple enabled mappings share the same asset_class/input_symbol/priority', row);
  }

  for (const adapter of adapters) {
    const parserConfig = parseJsonObject(adapter.parser_config_json);
    const relatedCaps = capabilities.filter(cap => cap.source_key === adapter.source_key);
    for (const cap of relatedCaps) {
      const currencies = parseJsonList(cap.quote_currencies_json).map(item => item.toUpperCase());
      const units = parseJsonList(cap.units_json).map(item => item.toLowerCase());
      if (parserConfig.currency && currencies.length && !currencies.includes(String(parserConfig.currency).toUpperCase())) {
        add('error', 'ADAPTER_CURRENCY_MISMATCH', 'adapter parser currency is not covered by source capability', { source_key: adapter.source_key, parser_currency: parserConfig.currency, capability_currencies: currencies });
      }
      if (parserConfig.unit && units.length && !units.includes(String(parserConfig.unit).toLowerCase())) {
        add('error', 'ADAPTER_UNIT_MISMATCH', 'adapter parser unit is not covered by source capability', { source_key: adapter.source_key, parser_unit: parserConfig.unit, capability_units: units });
      }
    }
  }

  return issues;
}


