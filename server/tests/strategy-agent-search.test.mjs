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

function createTraceDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE agent_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT UNIQUE NOT NULL,
      trigger TEXT NOT NULL DEFAULT 'generate',
      asset_ids TEXT NOT NULL,
      params TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      generation_log_id INTEGER,
      model TEXT,
      elapsed_ms INTEGER
    );
    CREATE TABLE agent_resume_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trace_id INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE ai_generation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_ids TEXT NOT NULL,
      budget REAL,
      goal TEXT,
      risk_level TEXT,
      analysis TEXT,
      strategy TEXT,
      plans TEXT,
      reasoning TEXT,
      risk_management TEXT,
      execution_notes TEXT,
      model TEXT,
      elapsed_ms INTEGER,
      status TEXT DEFAULT 'draft',
      user_feedback TEXT,
      parent_id INTEGER,
      strategy_id INTEGER,
      agent_version TEXT,
      prompt_versions TEXT
    );
  `);
  return db;
}

test('loadResumeState allows failed traces without checkpoints to restart from collect', () => {
  const db = createTraceDb();
  const result = db.prepare(`
    INSERT INTO agent_traces (run_id, trigger, asset_ids, params, status)
    VALUES (?, 'generate', ?, ?, 'failed')
  `).run('failed-before-collect', JSON.stringify([1, 3]), JSON.stringify({
    budget: 20000,
    goal: 'recovery',
    riskLevel: 'medium',
  }));

  try {
    const state = agentApi.loadResumeState(db, result.lastInsertRowid, {
      assetIds: [1, 3],
      budget: 20000,
      goal: 'recovery',
      riskLevel: 'medium',
    });
    assert.equal(state.capability.resumable, true);
    assert.equal(state.capability.mode, 'restart-step');
    assert.equal(state.capability.from_step, 'collect');
  } finally {
    db.close();
  }
});

test('done traces with linked generation logs recover completed results', () => {
  const db = createTraceDb();
  const logResult = db.prepare(`
    INSERT INTO ai_generation_logs (asset_ids, budget, goal, risk_level, analysis, strategy, plans, reasoning, risk_management, execution_notes, model, elapsed_ms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(
    JSON.stringify([1, 3]),
    20000,
    'recovery',
    'medium',
    JSON.stringify({ summary: 'analysis' }),
    JSON.stringify({ name: 'Recovered strategy' }),
    JSON.stringify([{ seq: 1, action: 'buy', asset_id: 1, amount: 1000 }]),
    'because',
    JSON.stringify({ max_loss: 0.1 }),
    'notes',
    'test-model',
    1234,
  );
  const result = db.prepare(`
    INSERT INTO agent_traces (run_id, trigger, asset_ids, params, status, generation_log_id)
    VALUES (?, 'generate', ?, ?, 'done', ?)
  `).run('completed-run', JSON.stringify([1, 3]), JSON.stringify({
    budget: 20000,
    goal: 'recovery',
    riskLevel: 'medium',
  }), logResult.lastInsertRowid);

  try {
    const params = {
      assetIds: [1, 3],
      budget: 20000,
      goal: 'recovery',
      riskLevel: 'medium',
    };
    const capability = agentApi.getStrategyAgentResumeCapability(db, result.lastInsertRowid, params);
    assert.equal(capability.resumable, true);
    assert.equal(capability.mode, 'recover-result');
    assert.equal(capability.source, 'generation_log');

    const recovered = agentApi.recoverStrategyAgentResult(db, result.lastInsertRowid, params);
    assert.equal(recovered.generationId, logResult.lastInsertRowid);
    assert.equal(recovered.result.strategy.name, 'Recovered strategy');
    assert.deepEqual(recovered.result.plans, [{ seq: 1, action: 'buy', asset_id: 1, amount: 1000 }]);
    assert.equal(recovered.result._meta.recovered, true);
  } finally {
    db.close();
  }
});

test('done traces without result data are not resumable', () => {
  const db = createTraceDb();
  const result = db.prepare(`
    INSERT INTO agent_traces (run_id, trigger, asset_ids, params, status)
    VALUES (?, 'generate', ?, ?, 'done')
  `).run('done-without-result', JSON.stringify([1, 3]), JSON.stringify({
    budget: 20000,
    goal: 'recovery',
    riskLevel: 'medium',
  }));

  try {
    const capability = agentApi.getStrategyAgentResumeCapability(db, result.lastInsertRowid, {
      assetIds: [1, 3],
      budget: 20000,
      goal: 'recovery',
      riskLevel: 'medium',
    });
    assert.equal(capability.resumable, false);
    assert.equal(capability.code, 'RESUME_DONE_RESULT_MISSING');
  } finally {
    db.close();
  }
});

test('done traces recover from final checkpoints when no draft was linked', () => {
  const db = createTraceDb();
  const result = db.prepare(`
    INSERT INTO agent_traces (run_id, trigger, asset_ids, params, status)
    VALUES (?, 'generate', ?, ?, 'done')
  `).run('done-with-final-checkpoint', JSON.stringify([1, 3]), JSON.stringify({
    budget: 20000,
    goal: 'recovery',
    riskLevel: 'medium',
  }));
  db.prepare(`
    INSERT INTO agent_resume_checkpoints (trace_id, step_name, payload)
    VALUES (?, 'final', ?)
  `).run(result.lastInsertRowid, JSON.stringify({
    result: {
      strategy: { name: 'Final checkpoint strategy' },
      plans: [{ seq: 1, action: 'hold', asset_id: 3 }],
      _meta: { trace_id: result.lastInsertRowid },
    },
  }));

  try {
    const params = {
      assetIds: [1, 3],
      budget: 20000,
      goal: 'recovery',
      riskLevel: 'medium',
    };
    const capability = agentApi.getStrategyAgentResumeCapability(db, result.lastInsertRowid, params);
    assert.equal(capability.resumable, true);
    assert.equal(capability.source, 'final_checkpoint');

    const recovered = agentApi.recoverStrategyAgentResult(db, result.lastInsertRowid, params);
    assert.equal(recovered.generationId, null);
    assert.equal(recovered.result.strategy.name, 'Final checkpoint strategy');
    assert.equal(recovered.result._meta.recovery_source, 'final_checkpoint');
  } finally {
    db.close();
  }
});

test('resume capability rejects asset mismatches', () => {
  const db = createTraceDb();
  const result = db.prepare(`
    INSERT INTO agent_traces (run_id, trigger, asset_ids, params, status)
    VALUES (?, 'generate', ?, ?, 'failed')
  `).run('asset-mismatch', JSON.stringify([1, 3]), JSON.stringify({
    budget: 20000,
    goal: 'recovery',
    riskLevel: 'medium',
  }));

  try {
    const capability = agentApi.getStrategyAgentResumeCapability(db, result.lastInsertRowid, {
      assetIds: [1],
      budget: 20000,
      goal: 'recovery',
      riskLevel: 'medium',
    });
    assert.equal(capability.resumable, false);
    assert.equal(capability.code, 'RESUME_ASSET_MISMATCH');
  } finally {
    db.close();
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
