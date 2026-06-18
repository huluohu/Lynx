import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import Database from 'better-sqlite3';

const agentApi = await import('../services/strategy-agent.js');

function createSettingsDb(values = {}) {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);');
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(values)) stmt.run(key, value);
  return db;
}

test('getAgentConfig prefers search API values saved in settings', () => {
  process.env.AGENT_SEARCH_API_URL = 'https://env.example/search';
  process.env.AGENT_SEARCH_API_KEY = 'env-key';
  const db = createSettingsDb({
    ai_api_url: 'https://llm.example/v1',
    ai_api_key: 'llm-key',
    ai_model: 'model-from-settings',
    agent_search_api_url: 'https://settings.example/search',
    agent_search_api_key: 'settings-key',
  });

  try {
    const config = agentApi.getAgentConfig(db);
    assert.equal(config.searchApiUrl, 'https://settings.example/search');
    assert.equal(config.searchApiKey, 'settings-key');
    assert.equal(config.model, 'model-from-settings');
  } finally {
    db.close();
    delete process.env.AGENT_SEARCH_API_URL;
    delete process.env.AGENT_SEARCH_API_KEY;
  }
});

test('getAgentConfig ignores masked secret values and falls back to environment', () => {
  process.env.AGENT_SEARCH_API_KEY = 'env-key-after-mask';
  const db = createSettingsDb({
    agent_search_api_url: 'https://settings.example/search',
    agent_search_api_key: '****1234',
  });

  try {
    const config = agentApi.getAgentConfig(db);
    assert.equal(config.searchApiUrl, 'https://settings.example/search');
    assert.equal(config.searchApiKey, 'env-key-after-mask');
  } finally {
    db.close();
    delete process.env.AGENT_SEARCH_API_KEY;
  }
});

test('searchNews calls the configured search API with query and API key', async () => {
  const received = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    received.push({
      path: url.pathname,
      query: url.searchParams.get('q'),
      limit: url.searchParams.get('limit'),
      format: url.searchParams.get('format'),
      key: url.searchParams.get('key'),
      authorization: req.headers.authorization,
      xApiKey: req.headers['x-api-key'],
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      results: [
        { title: 'BTC market update', snippet: 'Spot ETF demand remains active.', source: 'test-search', date: '2026-06-18' },
      ],
    }));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const news = await agentApi.searchNews({
      searchApiUrl: `http://127.0.0.1:${port}/search`,
      searchApiKey: 'search-secret',
    }, 'BTC');

    assert.equal(received.length, 1);
    assert.equal(received[0].path, '/search');
    assert.match(received[0].query, /BTC/);
    assert.equal(received[0].limit, '5');
    assert.equal(received[0].format, 'json');
    assert.equal(received[0].key, 'search-secret');
    assert.equal(received[0].authorization, 'Bearer search-secret');
    assert.equal(received[0].xApiKey, 'search-secret');
    assert.deepEqual(news, [{
      title: 'BTC market update',
      snippet: 'Spot ETF demand remains active.',
      source: 'test-search',
      date: '2026-06-18',
    }]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

