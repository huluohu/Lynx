import { Router } from 'express';
import { getDb } from '../db/database.js';
import { createLogger } from '../utils/logger.js';
import { getCachedMarketSnapshot, getMarketSnapshot } from '../services/market-cache.js';
import { buildAssetPriceTrend } from '../services/trend.js';
import { normalizeSqliteUtcTimestamp } from '../utils/datetime.js';

const router = Router();
const log = createLogger('market');

function normalizeSourcePayload(body = {}) {
  const key = String(body.key || body.name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
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
    asset_class: ['crypto', 'precious_metal', 'all'].includes(body.asset_class) ? body.asset_class : 'all',
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
