import { Router } from 'express';
import { getDb } from '../db/database.js';
import { generatePlan } from '../services/strategy.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('strategies');
const router = Router();

// GET 策略列表
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT s.*, a.name as asset_name, a.symbol
    FROM strategies s LEFT JOIN assets a ON s.asset_id = a.id ORDER BY s.created_at DESC`).all();
  // Enrich multi-asset strategies with asset names
  for (const row of rows) {
    if (row.asset_ids) {
      try {
        const ids = JSON.parse(row.asset_ids);
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          row.assets = db.prepare(`SELECT id, name, symbol, icon FROM assets WHERE id IN (${placeholders})`).all(...ids);
        }
      } catch {}
    }
  }
  res.json({ success: true, data: rows });
});

// GET 单个
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(`SELECT s.*, a.name as asset_name, a.symbol
    FROM strategies s LEFT JOIN assets a ON s.asset_id = a.id WHERE s.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  // Enrich multi-asset
  if (row.asset_ids) {
    try {
      const ids = JSON.parse(row.asset_ids);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        row.assets = db.prepare(`SELECT id, name, symbol, icon FROM assets WHERE id IN (${placeholders})`).all(...ids);
      }
    } catch {}
  }
  res.json({ success: true, data: row });
});

// POST 创建
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, type, asset_id, asset_ids, parameters } = req.body;
  if (!name || !type) return res.status(400).json({ success: false, error: 'name/type required' });

  const params = JSON.stringify(parameters || {});
  const assetIdsJson = asset_ids ? JSON.stringify(asset_ids) : null;
  // Use first asset_id from array if no single asset_id given
  const primaryAssetId = asset_id || (asset_ids && asset_ids[0]) || null;

  const info = db.prepare(`INSERT INTO strategies (name, description, type, asset_id, asset_ids, parameters)
    VALUES (?, ?, ?, ?, ?, ?)`).run(name, description || null, type, primaryAssetId, assetIdsJson, params);

  const row = db.prepare('SELECT * FROM strategies WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// PUT 编辑
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM strategies WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const { name, description, type, asset_id, asset_ids, parameters, status } = req.body;
  const assetIdsJson = asset_ids ? JSON.stringify(asset_ids) : existing.asset_ids;
  const primaryAssetId = asset_id ?? (asset_ids ? asset_ids[0] : existing.asset_id);

  db.prepare(`UPDATE strategies SET name=?, description=?, type=?, asset_id=?, asset_ids=?, parameters=?,
    status=?, updated_at=datetime('now') WHERE id=?`).run(
    name ?? existing.name, description ?? existing.description, type ?? existing.type,
    primaryAssetId, assetIdsJson,
    parameters ? JSON.stringify(parameters) : existing.parameters,
    status ?? existing.status, req.params.id
  );

  const row = db.prepare('SELECT * FROM strategies WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: row });
});

// DELETE
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM strategies WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST 激活
router.post('/:id/activate', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE strategies SET status='active', updated_at=datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// POST 智能生成操盘计划
router.post('/:id/generate-plan', (req, res) => {
  const db = getDb();
  const strategy = db.prepare(`SELECT s.*, h.quantity, h.avg_cost, h.total_invested
    FROM strategies s LEFT JOIN holdings h ON s.asset_id = h.asset_id AND h.status = 'active'
    WHERE s.id = ?`).get(req.params.id);
  if (!strategy) return res.status(404).json({ success: false, error: 'Strategy not found' });

  const params = JSON.parse(strategy.parameters);
  const holding = {
    quantity: strategy.quantity || 0,
    avg_cost: strategy.avg_cost || 0,
    total_invested: strategy.total_invested || 0,
  };

  try {
    const plans = generatePlan(holding, strategy.type, params);

    // 删除旧计划，写入新计划
    db.prepare('DELETE FROM trading_plans WHERE strategy_id = ?').run(strategy.id);

    const insert = db.prepare(`INSERT INTO trading_plans (strategy_id, asset_id, seq, trigger_type, trigger_value, action, quantity, amount, new_avg_cost, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const insertMany = db.transaction((items) => {
      for (const p of items)
        insert.run(strategy.id, strategy.asset_id, p.seq, p.trigger_type, p.trigger_value, p.action,
          p.quantity || null, p.amount || null, p.new_avg_cost || null, p.notes || null);
    });

    insertMany(plans);

    const result = db.prepare('SELECT * FROM trading_plans WHERE strategy_id = ? ORDER BY seq').all(strategy.id);
    res.json({ success: true, data: result, count: result.length });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// POST AI 智能生成策略
router.post('/ai-generate', async (req, res) => {
  const { asset_id, asset_ids, budget, goal, risk_level } = req.body;
  const ids = asset_ids && asset_ids.length > 0 ? asset_ids : (asset_id ? [asset_id] : []);
  if (ids.length === 0) return res.status(400).json({ success: false, error: '请选择资产' });

  log.info('AI generate request', { asset_ids: ids, budget, goal, risk_level });
  try {
    const { aiGenerateStrategy } = await import('../services/ai.js');
    const result = await aiGenerateStrategy(getDb(), {
      assetIds: ids,
      budget: Number(budget) || 20000,
      goal: goal || 'recovery',
      riskLevel: risk_level || 'medium',
    });
    log.info('AI generate success', { asset_ids: ids, strategyName: result.strategy?.name });
    res.json({ success: true, data: result });
  } catch (e) {
    log.error('AI generate failed', { asset_ids: ids, error: e.message });
    res.status(400).json({ success: false, error: e.message });
  }
});

// POST AI Agent 智能生成策略 (SSE 流式)
router.post('/ai-agent-generate', async (req, res) => {
  const { asset_id, asset_ids, budget, goal, risk_level } = req.body;
  const ids = asset_ids && asset_ids.length > 0 ? asset_ids : (asset_id ? [asset_id] : []);
  if (ids.length === 0) return res.status(400).json({ success: false, error: '请选择资产' });

  // SSE setup
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  log.info('Agent generate request (SSE)', { asset_ids: ids, budget, goal, risk_level });

  try {
    const { runStrategyAgent } = await import('../services/strategy-agent.js');
    const result = await runStrategyAgent(getDb(), {
      assetIds: ids,
      budget: Number(budget) || 20000,
      goal: goal || 'recovery',
      riskLevel: risk_level || 'medium',
    }, (step, message) => {
      sendEvent('progress', { step, message });
    });

    sendEvent('result', { success: true, data: result });
    log.info('Agent generate success', { asset_ids: ids, strategy: result.strategy?.name });
  } catch (e) {
    log.error('Agent generate failed', { asset_ids: ids, error: e.message });
    sendEvent('error', { success: false, error: e.message });
  }

  res.end();
});

// POST AI 生成后确认保存
router.post('/ai-confirm', (req, res) => {
  const { asset_id, asset_ids, strategy, plans } = req.body;
  if (!strategy || !plans) return res.status(400).json({ success: false, error: '缺少策略数据' });

  const db = getDb();
  const ids = asset_ids && asset_ids.length > 0 ? asset_ids : (asset_id ? [asset_id] : []);
  const primaryAssetId = ids[0] || null;
  const assetIdsJson = ids.length > 1 ? JSON.stringify(ids) : null;

  try {
    // 保存策略
    const params = typeof strategy.parameters === 'string' ? strategy.parameters : JSON.stringify(strategy.parameters);
    const sResult = db.prepare(
      'INSERT INTO strategies (name, description, type, asset_id, asset_ids, parameters, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(strategy.name, strategy.description || '', strategy.type, primaryAssetId, assetIdsJson, params, 'active');
    const strategyId = sResult.lastInsertRowid;

    // 保存操盘计划
    const insert = db.prepare(
      'INSERT INTO trading_plans (strategy_id, asset_id, seq, trigger_type, trigger_value, action, quantity, amount, new_avg_cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((items) => {
      for (const p of items) {
        const planAssetId = p.asset_id || primaryAssetId;
        insert.run(strategyId, planAssetId, p.seq, p.trigger_type, p.trigger_value, p.action,
          p.quantity || null, p.amount || null, p.new_avg_cost || null, p.notes || null);
      }
    });
    insertMany(plans);

    res.json({ success: true, data: { strategyId } });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

export default router;
