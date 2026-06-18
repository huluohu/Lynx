import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
let tempDir;
let dbPath;
let api;

function source(key, assetClass) {
  return { key, name: key, asset_class: assetClass, source_type: 'builtin', priority: 0 };
}

test.before(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'lynx-market-data-test-'));
  dbPath = join(tempDir, 'test.db');
  process.env.DB_PATH = dbPath;

  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE market_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL DEFAULT 'all',
      source_type TEXT NOT NULL DEFAULT 'builtin',
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 100,
      config_json TEXT,
      timeout_ms INTEGER DEFAULT 5000,
      cooldown_until TEXT,
      last_success_at TEXT,
      last_error_at TEXT,
      last_error TEXT,
      fail_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.exec(readFileSync(join(repoRoot, 'migrations', '025_market_data_resolver.sql'), 'utf8'));
  db.close();

  api = await import('../services/market-data/config.js');
});

test.after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

test('AU9999 profile and source selection are driven by DB mappings and capabilities', () => {
  const asset = { symbol: 'AU9999', type: 'gold', currency: 'CNY', unit: 'g' };
  const profile = api.loadMarketProfile(asset);

  assert.equal(profile.source, 'mapping');
  assert.equal(profile.assetClass, 'precious_metal');
  assert.equal(profile.market, 'SGE');
  assert.equal(profile.exchange, 'SGE');
  assert.equal(profile.baseSymbol, 'XAU');
  assert.equal(profile.quoteCurrency, 'CNY');
  assert.equal(profile.unit, 'g');
  assert.equal(api.resolveProviderSymbol(asset, profile, 'sge_sina'), 'SGE_AU9999');

  const plan = api.selectCapableSourceEntries(profile, [
    source('sge_sina', 'precious_metal'),
    source('swissquote', 'precious_metal'),
    source('neodata', 'precious_metal'),
  ]);

  assert.deepEqual(plan.selected.map(item => item.key), ['sge_sina', 'neodata']);
  assert.equal(plan.skipped.length, 1);
  assert.equal(plan.skipped[0].source, 'swissquote');
  assert.match(plan.skipped[0].reason, /capability mismatch/);
});

test('XAUUSD selects global spot source and skips SGE-only source', () => {
  const asset = { symbol: 'XAUUSD', type: 'gold', currency: 'USD', unit: 'oz' };
  const profile = api.loadMarketProfile(asset);

  assert.equal(profile.market, 'global_spot');
  assert.equal(profile.quoteCurrency, 'USD');
  assert.equal(api.resolveProviderSymbol(asset, profile, 'swissquote'), 'XAU/USD');

  const plan = api.selectCapableSourceEntries(profile, [
    source('sge_sina', 'precious_metal'),
    source('swissquote', 'precious_metal'),
  ]);

  assert.deepEqual(plan.selected.map(item => item.key), ['swissquote']);
  assert.equal(plan.skipped[0].source, 'sge_sina');
});

test('USDT stablecoin behavior comes from DB profile rules, not code symbol sets', () => {
  const asset = { symbol: 'USDT', type: 'crypto', currency: 'USD', unit: 'coin' };
  const profile = api.loadMarketProfile(asset);

  assert.equal(profile.instrumentType, 'stablecoin');
  assert.equal(profile.rules.peg_currency, 'USD');
  assert.equal(profile.rules.peg_price, 1);
  assert.equal(api.isStablePegProfile(profile), true);

  const plan = api.selectCapableSourceEntries(profile, [
    source('stablecoin_peg', 'crypto'),
    source('binance', 'crypto'),
  ]);

  assert.deepEqual(plan.selected.map(item => item.key), ['stablecoin_peg']);
  assert.equal(plan.skipped[0].source, 'binance');
});

test('BTC provider symbols come from DB mappings', () => {
  const asset = { symbol: 'BTC', type: 'crypto', currency: 'USD', unit: 'coin' };
  const profile = api.loadMarketProfile(asset);

  assert.equal(profile.source, 'mapping');
  assert.equal(profile.instrumentType, 'spot');
  assert.equal(api.resolveProviderSymbol(asset, profile, 'coingecko'), 'bitcoin');
  assert.equal(api.resolveProviderSymbol(asset, profile, 'kraken'), 'XBTUSD');
  assert.equal(api.resolveProviderSymbol(asset, profile, 'binance'), 'BTCUSDT');
});

test('resolve explain reports matched and skipped candidates for rule maintenance entrypoint', () => {
  const result = api.explainMarketResolution({ symbol: 'AU9999', type: 'gold', currency: 'CNY', unit: 'g' });

  assert.equal(result.profile.market, 'SGE');
  const sge = result.candidates.find(item => item.source === 'sge_sina');
  const swissquote = result.candidates.find(item => item.source === 'swissquote');

  assert.equal(sge.status, 'matched');
  assert.equal(sge.provider_symbol, 'SGE_AU9999');
  assert.equal(sge.adapter.adapter_type, 'text_http');
  assert.equal(swissquote.status, 'skipped');
  assert.match(swissquote.reason, /capability mismatch/);
});

test('rule lint returns structured issues without throwing', () => {
  const issues = api.lintMarketDataRules();
  assert.equal(Array.isArray(issues), true);
  assert.equal(issues.some(issue => issue.severity === 'error'), false);
  assert.equal(issues.some(issue => issue.code === 'MISSING_ADAPTER' && issue.details?.source_key === 'coingecko'), false);
  assert.equal(issues.some(issue => issue.code === 'MISSING_ADAPTER' && issue.details?.source_key === 'neodata'), false);
});

test('json_http/json_path adapter can execute a DB-configured source without legacy fetcher', async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/price/BTC-USD');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { price: 12345.67, currency: 'USD' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const db = new Database(dbPath);
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('market_crypto_sources_enabled', 'test_json');
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('test_json', 'market_crypto_sources_enabled');
  db.prepare(`INSERT INTO market_sources (key, name, asset_class, source_type, enabled, priority)
    VALUES ('test_json', 'Test JSON', 'crypto', 'builtin', 1, 1)`).run();
  db.prepare(`INSERT INTO market_source_capabilities
    (source_key, asset_class, instrument_type, markets_json, regions_json, quote_currencies_json, units_json, identifiers_required_json, priority)
    VALUES ('test_json', 'crypto', 'spot', '["crypto_spot"]', '["global"]', '["USD"]', '["coin"]', '["test_json"]', 1)`).run();
  db.prepare(`UPDATE asset_symbol_mappings
    SET identifiers_json = json_set(identifiers_json, '$.test_json', 'BTC-USD')
    WHERE asset_class = 'crypto' AND input_symbol = 'BTC'`).run();
  db.prepare(`INSERT INTO market_source_adapters
    (source_key, adapter_type, endpoint_template, parser_type, parser_config_json, timeout_ms)
    VALUES ('test_json', 'json_http', ?, 'json_path', '{"price_path":"data.price","currency_path":"data.currency","unit":"coin"}', 1000)`).run(`http://127.0.0.1:${port}/price/{provider_symbol}`);
  db.close();

  try {
    const { fetchCrypto } = await import('../services/price.js');
    const quote = await fetchCrypto({ symbol: 'BTC', type: 'crypto', currency: 'USD', unit: 'coin' });
    assert.equal(quote.source, 'test_json');
    assert.equal(quote.price, 12345.67);
    assert.equal(quote.usd, 12345.67);
    assert.equal(Number.isFinite(quote.cny), true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('fetchPrice uses configured adapters for non-crypto/non-metal assets without AU substring false positives', async () => {
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/equity/AURA');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ quote: { last: 199.12, currency: 'USD' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const db = new Database(dbPath);
  db.prepare(`INSERT INTO market_sources (key, name, asset_class, source_type, enabled, priority)
    VALUES ('test_equity_json', 'Test Equity JSON', 'equity', 'builtin', 1, 1)`).run();
  db.prepare(`INSERT INTO asset_symbol_mappings
    (asset_class, input_symbol, canonical_symbol, instrument_type, base_symbol, quote_currency, unit, market, exchange, region, identifiers_json, rules_json, priority)
    VALUES ('equity', 'AURA', 'AURA', 'stock', 'AURA', 'USD', 'share', 'US', 'NASDAQ', 'US', '{"test_equity_json":"AURA"}', '{}', 1)`).run();
  db.prepare(`INSERT INTO market_source_capabilities
    (source_key, asset_class, instrument_type, markets_json, exchanges_json, regions_json, quote_currencies_json, units_json, identifiers_required_json, priority)
    VALUES ('test_equity_json', 'equity', 'stock', '["US"]', '["NASDAQ"]', '["US"]', '["USD"]', '["share"]', '["test_equity_json"]', 1)`).run();
  db.prepare(`INSERT INTO market_source_adapters
    (source_key, adapter_type, endpoint_template, parser_type, parser_config_json, timeout_ms)
    VALUES ('test_equity_json', 'json_http', ?, 'json_path', '{"price_path":"quote.last","currency_path":"quote.currency","unit":"share"}', 1000)`).run(`http://127.0.0.1:${port}/equity/{provider_symbol}`);
  db.close();

  try {
    const { fetchPrice } = await import('../services/price.js');
    const quote = await fetchPrice({ symbol: 'AURA', type: 'equity', currency: 'USD', unit: 'share' });
    assert.equal(quote.source, 'test_equity_json');
    assert.equal(quote.price, 199.12);
    assert.equal(quote.currency, 'USD');
    assert.equal(quote.unit, 'share');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('unknown asset classes fall back to inferred profiles without throwing', () => {
  const asset = { symbol: 'AAPL', type: 'equity', currency: 'USD', unit: 'share' };
  const profile = api.loadMarketProfile(asset);

  assert.equal(profile.source, 'inferred');
  assert.equal(profile.assetClass, 'equity');
  assert.equal(profile.canonicalSymbol, 'AAPL');

  const plan = api.selectCapableSourceEntries(profile, [source('some_equity_source', 'equity')]);
  assert.deepEqual(plan.selected, []);
  assert.equal(plan.skipped[0].reason, 'no enabled capability configured');
});


