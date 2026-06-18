import { Router } from 'express';
import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';
import { getCachedMarketSnapshot, getMarketSnapshot } from '../services/market-cache.js';
import { buildAssetPriceTrend } from '../services/trend.js';
import { normalizeSqliteUtcTimestamp } from '../utils/datetime.js';
import { explainMarketResolution, lintMarketDataRules } from '../services/market-data/config.js';

const router = Router();
const log = createLogger('market');

const MARKET_DATA_RULE_TABLES = {
  sources: {
    table: 'market_sources',
    idColumn: 'id',
    orderBy: 'asset_class ASC, source_type ASC, priority ASC, id ASC',
    required: ['key', 'name'],
    fields: ['key', 'name', 'asset_class', 'source_type', 'enabled', 'priority', 'timeout_ms', 'config_json'],
  },
  profiles: {
    table: 'market_asset_profiles',
    idColumn: 'id',
    orderBy: 'asset_class ASC, market ASC, canonical_symbol ASC, id ASC',
    required: ['asset_class'],
    fields: ['asset_id', 'asset_class', 'instrument_type', 'base_symbol', 'quote_currency', 'unit', 'market', 'exchange', 'region', 'canonical_symbol', 'identifiers_json', 'rules_json', 'profile_source', 'enabled'],
  },
  mappings: {
    table: 'asset_symbol_mappings',
    idColumn: 'id',
    orderBy: 'asset_class ASC, input_symbol ASC, priority ASC, id ASC',
    required: ['asset_class', 'input_symbol'],
    fields: ['asset_class', 'input_symbol', 'canonical_symbol', 'instrument_type', 'base_symbol', 'quote_currency', 'unit', 'market', 'exchange', 'region', 'identifiers_json', 'rules_json', 'priority', 'enabled'],
  },
  capabilities: {
    table: 'market_source_capabilities',
    idColumn: 'id',
    orderBy: 'source_key ASC, asset_class ASC, priority ASC, id ASC',
    required: ['source_key', 'asset_class'],
    fields: ['source_key', 'asset_class', 'instrument_type', 'markets_json', 'exchanges_json', 'regions_json', 'base_symbols_json', 'quote_currencies_json', 'units_json', 'identifiers_required_json', 'priority', 'enabled', 'metadata_json'],
  },
  'symbol-rules': {
    table: 'market_source_symbol_rules',
    idColumn: 'id',
    orderBy: 'source_key ASC, asset_class ASC, priority ASC, id ASC',
    required: ['source_key', 'asset_class', 'symbol_template'],
    fields: ['source_key', 'asset_class', 'market', 'exchange', 'symbol_template', 'priority', 'enabled'],
  },
  adapters: {
    table: 'market_source_adapters',
    idColumn: 'source_key',
    orderBy: 'source_key ASC',
    required: ['source_key', 'adapter_type', 'parser_type'],
    fields: ['source_key', 'adapter_type', 'endpoint_template', 'method', 'headers_json', 'parser_type', 'parser_config_json', 'timeout_ms', 'requires_proxy', 'dependency_json', 'enabled'],
  },
};

function stringifyJsonField(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeRulePayload(definition, body = {}, { partial = false } = {}) {
  const payload = {};
  for (const field of definition.fields) {
    if (!(field in body)) continue;
    if (field.endsWith('_json')) payload[field] = stringifyJsonField(body[field]);
    else if (['enabled', 'requires_proxy'].includes(field)) payload[field] = body[field] ? 1 : 0;
    else if (['priority', 'timeout_ms', 'asset_id'].includes(field)) payload[field] = body[field] == null || body[field] === '' ? null : Number(body[field]);
    else payload[field] = body[field] == null ? null : String(body[field]).trim();
  }
  if (!partial) {
    for (const field of definition.required) {
      if (!payload[field] && payload[field] !== 0) return { error: `${field} required` };
    }
  }
  return { payload };
}

function getRuleDefinition(kind) {
  return MARKET_DATA_RULE_TABLES[kind] || null;
}

function safeJson(value) {
  if (value == null) return null;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function writeRuleChange(db, { kind, ruleId, action, before, after, operator = 'api' }) {
  try {
    db.prepare(`INSERT INTO market_rule_changes
      (rule_kind, rule_id, action, before_json, after_json, operator)
      VALUES (?, ?, ?, ?, ?, ?)`).run(kind, ruleId == null ? null : String(ruleId), action, safeJson(before), safeJson(after), operator);
  } catch {}
}

function readAllRuleRows(db) {
  const result = {};
  for (const [kind, definition] of Object.entries(MARKET_DATA_RULE_TABLES)) {
    result[kind] = db.prepare(`SELECT * FROM ${definition.table} ORDER BY ${definition.orderBy}`).all();
  }
  return result;
}

function upsertImportedRule(db, kind, row) {
  const definition = getRuleDefinition(kind);
  if (!definition) return { skipped: true, reason: 'unknown kind' };
  const { payload, error } = normalizeRulePayload(definition, row || {}, { partial: true });
  if (error) return { skipped: true, reason: error };
  const fields = Object.keys(payload).filter(field => payload[field] !== undefined);
  if (!fields.length) return { skipped: true, reason: 'empty row' };

  const naturalId = definition.idColumn === 'id' ? row.id : payload[definition.idColumn];
  const existing = naturalId == null ? null : db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(naturalId);
  if (existing) {
    const updateFields = fields.filter(field => field !== definition.idColumn);
    if (!updateFields.length) return { updated: false, id: naturalId };
    db.prepare(`UPDATE ${definition.table} SET ${updateFields.map(field => `${field} = ?`).join(', ')}, updated_at = datetime('now') WHERE ${definition.idColumn} = ?`)
      .run(...updateFields.map(field => payload[field]), naturalId);
    const after = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(naturalId);
    writeRuleChange(db, { kind, ruleId: naturalId, action: 'import_update', before: existing, after });
    return { updated: true, id: naturalId };
  }

  const insertFields = fields.filter(field => definition.idColumn !== 'id' || field !== 'id');
  const info = db.prepare(`INSERT INTO ${definition.table} (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`)
    .run(...insertFields.map(field => payload[field]));
  const id = definition.idColumn === 'id' ? info.lastInsertRowid : payload[definition.idColumn];
  const after = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(id);
  writeRuleChange(db, { kind, ruleId: id, action: 'import_create', before: null, after });
  return { created: true, id };
}

function normalizeSourcePayload(body = {}) {
  const key = String(body.key || body.name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  const allowedAssetClasses = ['crypto', 'precious_metal', 'equity', 'forex', 'fund', 'index', 'commodity', 'all'];
  const config = body.config_json
    ? (typeof body.config_json === 'string' ? JSON.parse(body.config_json) : body.config_json)
    : {
        url_template: body.url_template || body.url,
        price_path: body.price_path || 'price',
        currency_path: body.currency_path || '',
        timestamp_path: body.timestamp_path || '',
        headers: body.headers || {},
      };
  return {
    key: key ? `custom_${key.replace(/^custom_/, '')}` : `custom_${Date.now()}`,
    name: String(body.name || key || 'Custom Source').trim(),
    asset_class: allowedAssetClasses.includes(body.asset_class) ? body.asset_class : 'all',
    enabled: body.enabled == null ? 1 : (body.enabled ? 1 : 0),
    priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 100,
    timeout_ms: Number.isFinite(Number(body.timeout_ms)) ? Number(body.timeout_ms) : 5000,
    config,
  };
}

function validateCustomSourcePayload(payload) {
  if (!payload.name) return 'name required';
  if (!payload.config?.url_template && !payload.config?.url) return 'url_template required';
  try {
    const url = String(payload.config.url_template || payload.config.url).replace(/{[^}]+}/g, 'BTC');
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'only http/https URLs are allowed';
  } catch {
    return 'invalid url_template';
  }
  if (!payload.config?.price_path) return 'price_path required';
  return null;
}

// GET 行情源健康/配置列表
router.get('/sources', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM market_sources
    ORDER BY asset_class ASC, source_type ASC, priority ASC, id ASC`).all();
  res.json({ success: true, data: rows });
});

// POST 新增自定义 HTTP 行情源
router.post('/sources', (req, res) => {
  const payload = normalizeSourcePayload(req.body || {});
  const error = validateCustomSourcePayload(payload);
  if (error) return res.status(400).json({ success: false, error });

  const db = getDb();
  try {
    const info = db.prepare(`INSERT INTO market_sources
      (key, name, asset_class, source_type, enabled, priority, timeout_ms, config_json)
      VALUES (?, ?, ?, 'custom_http', ?, ?, ?, ?)`).run(
        payload.key,
        payload.name,
        payload.asset_class,
        payload.enabled,
        payload.priority,
        payload.timeout_ms,
        JSON.stringify(payload.config),
      );
    const row = db.prepare('SELECT * FROM market_sources WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message.includes('UNIQUE') ? 'source key already exists' : e.message });
  }
});

// PUT 更新行情源（内置源仅允许 enabled/priority/timeout）
router.put('/sources/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM market_sources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'source not found' });

  if (existing.source_type === 'custom_http') {
    const payload = normalizeSourcePayload({ ...existing, ...req.body, key: existing.key });
    const error = validateCustomSourcePayload(payload);
    if (error) return res.status(400).json({ success: false, error });
    db.prepare(`UPDATE market_sources SET name=?, asset_class=?, enabled=?, priority=?, timeout_ms=?, config_json=?, updated_at=datetime('now')
      WHERE id=?`).run(payload.name, payload.asset_class, payload.enabled, payload.priority, payload.timeout_ms, JSON.stringify(payload.config), req.params.id);
  } else {
    db.prepare(`UPDATE market_sources SET enabled=?, priority=?, timeout_ms=?, updated_at=datetime('now') WHERE id=?`).run(
      req.body.enabled == null ? existing.enabled : (req.body.enabled ? 1 : 0),
      Number.isFinite(Number(req.body.priority)) ? Number(req.body.priority) : existing.priority,
      Number.isFinite(Number(req.body.timeout_ms)) ? Number(req.body.timeout_ms) : existing.timeout_ms,
      req.params.id,
    );
  }

  const row = db.prepare('SELECT * FROM market_sources WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: row });
});

// DELETE 删除自定义源
router.delete('/sources/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM market_sources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'source not found' });
  if (existing.source_type !== 'custom_http') return res.status(400).json({ success: false, error: 'builtin source cannot be deleted' });
  db.prepare('DELETE FROM market_sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST 测试自定义源
router.post('/sources/:id/test', async (req, res) => {
  const db = getDb();
  const source = db.prepare('SELECT * FROM market_sources WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).json({ success: false, error: 'source not found' });
  if (source.source_type !== 'custom_http') return res.status(400).json({ success: false, error: 'only custom_http source can be tested' });
  const asset = req.body?.asset_id
    ? db.prepare('SELECT * FROM assets WHERE id = ?').get(req.body.asset_id)
    : {
        id: null,
        name: req.body?.name || 'Test Asset',
        symbol: req.body?.symbol || 'BTC',
        type: req.body?.asset_class || source.asset_class || 'crypto',
        currency: req.body?.currency || 'USD',
        quote_currency: req.body?.currency || 'USD',
        subtype: req.body?.subtype || null,
        unit: req.body?.unit || null,
        provider_symbols: req.body?.provider_symbols ? JSON.stringify(req.body.provider_symbols) : null,
      };
  if (!asset) return res.status(404).json({ success: false, error: 'asset not found' });
  try {
    const { testCustomMarketSource } = await import('../services/price.js');
    const result = await testCustomMarketSource(asset, source);
    if (!result) return res.status(422).json({ success: false, error: 'source returned no valid price' });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(422).json({ success: false, error: e.message });
  }
});

// GET 市场数据规则类型
router.get('/data/rules', (req, res) => {
  res.json({ success: true, data: Object.keys(MARKET_DATA_RULE_TABLES) });
});

// GET 导出全部市场数据规则
router.get('/data/export', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    data: {
      version: 1,
      exported_at: new Date().toISOString(),
      rules: readAllRuleRows(db),
    },
  });
});

// POST 导入市场数据规则，支持 dry_run 预览
router.post('/data/import', (req, res) => {
  const dryRun = req.body?.dry_run === true || req.query.dry_run === '1';
  const rules = req.body?.rules || req.body?.data?.rules || req.body || {};
  const summary = { created: 0, updated: 0, skipped: 0, details: [] };
  const db = getDb();
  const apply = db.transaction(() => {
    for (const [kind, rows] of Object.entries(rules)) {
      if (!getRuleDefinition(kind) || !Array.isArray(rows)) continue;
      for (const row of rows) {
        const result = upsertImportedRule(db, kind, row);
        if (result.created) summary.created++;
        else if (result.updated) summary.updated++;
        else summary.skipped++;
        summary.details.push({ kind, ...result });
      }
    }
    if (dryRun) throw new Error('__DRY_RUN_ROLLBACK__');
  });
  try {
    apply();
    res.json({ success: true, data: summary });
  } catch (e) {
    if (e.message === '__DRY_RUN_ROLLBACK__') return res.json({ success: true, data: { ...summary, dry_run: true } });
    res.status(400).json({ success: false, error: e.message });
  }
});

// GET 规则变更审计记录
router.get('/data/changes', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const rows = getDb().prepare('SELECT * FROM market_rule_changes ORDER BY id DESC LIMIT ?').all(limit);
  res.json({ success: true, data: rows });
});

// GET 市场数据规则列表
router.get('/data/rules/:kind', (req, res) => {
  const definition = getRuleDefinition(req.params.kind);
  if (!definition) return res.status(404).json({ success: false, error: 'unknown rule kind' });
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM ${definition.table} ORDER BY ${definition.orderBy}`).all();
  res.json({ success: true, data: rows });
});

// POST 新增市场数据规则
router.post('/data/rules/:kind', (req, res) => {
  const definition = getRuleDefinition(req.params.kind);
  if (!definition) return res.status(404).json({ success: false, error: 'unknown rule kind' });
  const { payload, error } = normalizeRulePayload(definition, req.body || {});
  if (error) return res.status(400).json({ success: false, error });

  const fields = Object.keys(payload).filter(field => payload[field] !== undefined);
  if (!fields.length) return res.status(400).json({ success: false, error: 'empty payload' });
  const placeholders = fields.map(() => '?').join(', ');
  const db = getDb();
  try {
    const info = db.prepare(`INSERT INTO ${definition.table} (${fields.join(', ')}) VALUES (${placeholders})`)
      .run(...fields.map(field => payload[field]));
    const id = definition.idColumn === 'id' ? info.lastInsertRowid : payload[definition.idColumn];
    const row = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(id);
    writeRuleChange(db, { kind: req.params.kind, ruleId: id, action: 'create', before: null, after: row, operator: req.user?.username || 'api' });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// PUT 更新市场数据规则
router.put('/data/rules/:kind/:id', (req, res) => {
  const definition = getRuleDefinition(req.params.kind);
  if (!definition) return res.status(404).json({ success: false, error: 'unknown rule kind' });
  const { payload, error } = normalizeRulePayload(definition, req.body || {}, { partial: true });
  if (error) return res.status(400).json({ success: false, error });
  const fields = Object.keys(payload).filter(field => field !== definition.idColumn && payload[field] !== undefined);
  if (!fields.length) return res.status(400).json({ success: false, error: 'empty payload' });

  const db = getDb();
  const existing = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'rule not found' });

  const assignments = fields.map(field => `${field} = ?`).join(', ');
  db.prepare(`UPDATE ${definition.table} SET ${assignments}, updated_at = datetime('now') WHERE ${definition.idColumn} = ?`)
    .run(...fields.map(field => payload[field]), req.params.id);
  const row = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(req.params.id);
  writeRuleChange(db, { kind: req.params.kind, ruleId: req.params.id, action: 'update', before: existing, after: row, operator: req.user?.username || 'api' });
  res.json({ success: true, data: row });
});

// DELETE 软删除/禁用市场数据规则
router.delete('/data/rules/:kind/:id', (req, res) => {
  const definition = getRuleDefinition(req.params.kind);
  if (!definition) return res.status(404).json({ success: false, error: 'unknown rule kind' });
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'rule not found' });
  if (definition.fields.includes('enabled')) {
    db.prepare(`UPDATE ${definition.table} SET enabled = 0, updated_at = datetime('now') WHERE ${definition.idColumn} = ?`).run(req.params.id);
    const after = db.prepare(`SELECT * FROM ${definition.table} WHERE ${definition.idColumn} = ?`).get(req.params.id);
    writeRuleChange(db, { kind: req.params.kind, ruleId: req.params.id, action: 'disable', before: existing, after, operator: req.user?.username || 'api' });
  } else {
    db.prepare(`DELETE FROM ${definition.table} WHERE ${definition.idColumn} = ?`).run(req.params.id);
    writeRuleChange(db, { kind: req.params.kind, ruleId: req.params.id, action: 'delete', before: existing, after: null, operator: req.user?.username || 'api' });
  }
  res.json({ success: true });
});

// POST 规则试算：不真实请求行情，只解释资产会匹配哪些源
router.post('/data/resolve-test', (req, res) => {
  const db = getDb();
  const asset = req.body?.asset_id
    ? db.prepare('SELECT * FROM assets WHERE id = ?').get(req.body.asset_id)
    : {
        id: null,
        symbol: req.body?.symbol || 'BTC',
        type: req.body?.type || req.body?.asset_class || 'crypto',
        currency: req.body?.currency || req.body?.quote_currency || 'USD',
        quote_currency: req.body?.quote_currency || req.body?.currency || 'USD',
        unit: req.body?.unit || null,
        subtype: req.body?.subtype || null,
        provider_symbols: req.body?.provider_symbols ? JSON.stringify(req.body.provider_symbols) : null,
      };
  if (!asset) return res.status(404).json({ success: false, error: 'asset not found' });
  res.json({ success: true, data: explainMarketResolution(asset) });
});

// GET/POST 规则质量检查
router.get('/data/lint', (req, res) => {
  res.json({ success: true, data: lintMarketDataRules() });
});

router.post('/data/lint', (req, res) => {
  res.json({ success: true, data: lintMarketDataRules() });
});

// GET 所有资产价格
router.get('/prices', async (req, res) => {
  const db = getDb();
  const assets = db.prepare('SELECT * FROM assets').all();
  const force = req.query.force === '1';

  if (!force) {
    const results = assets.map((asset) => getCachedMarketSnapshot(db, asset));

    log.info('Prices served from cache', {
      total: assets.length,
      cached: results.filter((item) => item.fetched_at).length,
      empty: results.filter((item) => item.empty_cache).length,
    });

    res.json({ success: true, data: results });
    return;
  }

  const freshResults = await Promise.all(assets.map((asset) => getMarketSnapshot(db, asset, { forceRefresh: true })));

  log.info('Prices fetched', {
    total: assets.length,
    fresh: freshResults.filter((item) => !item.cached).length,
    fallback: freshResults.filter((item) => item.cached && item.cache_status !== 'missing').length,
    empty: freshResults.filter((item) => item.empty_cache).length,
  });

  res.json({ success: true, data: freshResults });
});

// POST 手工更新单个资产行情
router.post('/prices/:assetId/manual', (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId);
  if (!asset) return res.status(404).json({ success: false, error: 'Asset not found' });

  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ success: false, error: 'price must be greater than 0' });
  }

  const currency = String(req.body?.currency || asset.currency || 'CNY').trim().toUpperCase();
  const fetchedAt = req.body?.fetched_at
    ? normalizeSqliteUtcTimestamp(req.body.fetched_at, { assumeLocalWhenNoTimezone: true })
    : null;

  if (req.body?.fetched_at && !fetchedAt) {
    return res.status(400).json({ success: false, error: 'invalid fetched_at' });
  }

  if (fetchedAt && new Date(`${fetchedAt.replace(' ', 'T')}Z`).getTime() - Date.now() > 60 * 1000) {
    return res.status(400).json({ success: false, error: 'fetched_at cannot be in the future' });
  }

  if (fetchedAt) {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source, fetched_at) VALUES (?, ?, ?, ?, ?)')
      .run(asset.id, price, currency, 'manual', fetchedAt);
  } else {
    db.prepare('INSERT INTO price_cache (asset_id, price, currency, source) VALUES (?, ?, ?, ?)')
      .run(asset.id, price, currency, 'manual');
  }

  const snapshot = getCachedMarketSnapshot(db, asset);
  log.info('Manual price saved', { assetId: asset.id, price, currency });
  res.status(201).json({ success: true, data: snapshot });
});

// GET 当前汇率
router.get('/rate', async (req, res) => {
  try {
    const { getUsdCny } = await import('../services/price.js');
    const rate = await getUsdCny();
    res.json({ success: true, data: { usd_cny: rate, updated: new Date().toISOString() } });
  } catch (e) {
    res.status(500).json({ success: false, error: '获取汇率失败' });
  }
});

// GET 单个资产价格趋势
router.get('/prices/:assetId/trend', (req, res) => {
  const db = getDb();
  const data = buildAssetPriceTrend(db, Number(req.params.assetId), req.query.range);
  if (!data) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data });
});

// GET 单个
router.get('/prices/:assetId', async (req, res) => {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId);
  if (!asset) return res.status(404).json({ success: false, error: 'Not found' });

  const forceRefresh = req.query.force === '1' || req.query.cache !== '1';
  const snapshot = await getMarketSnapshot(db, asset, { forceRefresh });
  res.json({ success: true, data: { ...asset, ...snapshot } });
});

export default router;
