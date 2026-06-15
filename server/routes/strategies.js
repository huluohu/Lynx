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

// GET 草稿列表 (must be before /:id)
router.get('/drafts', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, asset_ids, budget, goal, risk_level, strategy, model, elapsed_ms, created_at FROM ai_generation_logs WHERE status = 'draft' ORDER BY created_at DESC"
  ).all();
  const data = rows.map(r => {
    let strategyName = '';
    try { strategyName = JSON.parse(r.strategy)?.name || ''; } catch {}
    return { ...r, strategy_name: strategyName };
  });
  res.json({ success: true, data });
});

// GET 生成历史列表 (must be before /:id)
router.get('/generation-logs', (req, res) => {
  const db = getDb();
  const { status, asset_id } = req.query;
  let sql = 'SELECT id, asset_ids, budget, goal, risk_level, strategy, model, elapsed_ms, status, parent_id, strategy_id, created_at FROM ai_generation_logs';
  const conditions = [];
  const params = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (asset_id) { conditions.push("asset_ids LIKE ?"); params.push(`%${asset_id}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT 50';
  const rows = db.prepare(sql).all(...params);
  const data = rows.map(r => {
    let strategyName = '';
    try { strategyName = JSON.parse(r.strategy)?.name || ''; } catch {}
    return { ...r, strategy_name: strategyName };
  });
  res.json({ success: true, data });
});

// GET 单条生成日志详情 (must be before /:id)
router.get('/generation-logs/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM ai_generation_logs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: '记录不存在' });
  try { row.analysis = JSON.parse(row.analysis); } catch {}
  try { row.strategy = JSON.parse(row.strategy); } catch {}
  try { row.plans = JSON.parse(row.plans); } catch {}
  try { row.risk_management = JSON.parse(row.risk_management); } catch {}
  try { row.asset_ids = JSON.parse(row.asset_ids); } catch {}
  res.json({ success: true, data: row });
});

// GET 单个策略
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

    // Delete old plans and insert new ones in a single transaction
    const regenerate = db.transaction((items) => {
      db.prepare('DELETE FROM trading_plans WHERE strategy_id = ?').run(strategy.id);
      const insert = db.prepare(`INSERT INTO trading_plans (strategy_id, asset_id, seq, trigger_type, trigger_value, action, quantity, amount, new_avg_cost, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const p of items)
        insert.run(strategy.id, p.asset_id || strategy.asset_id, p.seq, p.trigger_type, p.trigger_value, p.action,
          p.quantity || null, p.amount || null, p.new_avg_cost || null, p.notes || null);
    });

    regenerate(plans);

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
  const { asset_id, asset_ids, budget, goal, risk_level, parent_id, user_feedback } = req.body;
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

  log.info('Agent generate request (SSE)', { asset_ids: ids, budget, goal, risk_level, parent_id });

  try {
    const { runStrategyAgent } = await import('../services/strategy-agent.js');
    const db = getDb();

    // If regenerating, inject parent context
    const agentOpts = {
      assetIds: ids,
      budget: Number(budget) || 20000,
      goal: goal || 'recovery',
      riskLevel: risk_level || 'medium',
    };

    if (parent_id && user_feedback) {
      // Load parent result for context
      const parent = db.prepare('SELECT strategy, plans, reasoning FROM ai_generation_logs WHERE id = ?').get(parent_id);
      if (parent) {
        agentOpts.previousResult = {
          strategy: parent.strategy ? JSON.parse(parent.strategy) : null,
          plans: parent.plans ? JSON.parse(parent.plans) : null,
          reasoning: parent.reasoning,
        };
        agentOpts.userFeedback = user_feedback;
      }
    }

    const result = await runStrategyAgent(db, agentOpts, (step, message) => {
      sendEvent('progress', { step, message });
    });

    // Auto-save to ai_generation_logs
    const logResult = db.prepare(`
      INSERT INTO ai_generation_logs (asset_ids, budget, goal, risk_level, analysis, strategy, plans, reasoning, risk_management, execution_notes, model, elapsed_ms, status, user_feedback, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `).run(
      JSON.stringify(ids),
      Number(budget) || 20000,
      goal || 'recovery',
      risk_level || 'medium',
      JSON.stringify(result.analysis),
      JSON.stringify(result.strategy),
      JSON.stringify(result.plans),
      result.reasoning || '',
      JSON.stringify(result.risk_management),
      result.execution_notes || '',
      result._meta?.model || '',
      result._meta?.elapsed_ms || 0,
      user_feedback || null,
      parent_id || null,
    );

    const generationId = Number(logResult.lastInsertRowid);
    sendEvent('result', { success: true, data: { ...result, generation_id: generationId } });
    log.info('Agent generate success', { asset_ids: ids, strategy: result.strategy?.name, generation_id: generationId });
  } catch (e) {
    log.error('Agent generate failed', { asset_ids: ids, error: e.message });
    sendEvent('error', { success: false, error: e.message });
  }

  res.end();
});

// POST 确认采用草稿
router.post('/drafts/:id/adopt', (req, res) => {
  const db = getDb();
  const logRow = db.prepare('SELECT * FROM ai_generation_logs WHERE id = ?').get(req.params.id);
  if (!logRow) return res.status(404).json({ success: false, error: '草稿不存在' });
  if (logRow.status === 'adopted') return res.status(400).json({ success: false, error: '该草稿已被采用' });

  let strategy, plans;
  try { strategy = JSON.parse(logRow.strategy); } catch { return res.status(400).json({ success: false, error: '策略数据异常' }); }
  try { plans = JSON.parse(logRow.plans); } catch { plans = []; }

  // Allow plan overrides from body
  const { plans: overridePlans } = req.body;
  if (overridePlans && Array.isArray(overridePlans)) plans = overridePlans;

  let ids;
  try { ids = JSON.parse(logRow.asset_ids); } catch { ids = []; }
  const primaryAssetId = ids[0] || null;
  const assetIdsJson = ids.length > 1 ? JSON.stringify(ids) : null;

  try {
    const saveAll = db.transaction(() => {
      const params = typeof strategy.parameters === 'string' ? strategy.parameters : JSON.stringify(strategy.parameters || {});
      const sResult = db.prepare(
        'INSERT INTO strategies (name, description, type, asset_id, asset_ids, parameters, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(strategy.name, strategy.description || '', strategy.type, primaryAssetId, assetIdsJson, params, 'active');
      const strategyId = sResult.lastInsertRowid;

      const insert = db.prepare(
        'INSERT INTO trading_plans (strategy_id, asset_id, seq, trigger_type, trigger_value, action, quantity, amount, new_avg_cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const p of plans) {
        const planAssetId = p.asset_id || primaryAssetId;
        insert.run(strategyId, planAssetId, p.seq, p.trigger_type, p.trigger_value, p.action,
          p.quantity || null, p.amount || null, p.new_avg_cost || null, p.notes || p.rationale || null);
      }

      // Mark log as adopted
      db.prepare("UPDATE ai_generation_logs SET status = 'adopted', strategy_id = ? WHERE id = ?").run(strategyId, logRow.id);

      return strategyId;
    });

    const strategyId = saveAll();
    res.json({ success: true, data: { strategyId } });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// DELETE 丢弃草稿
router.delete('/drafts/:id', (req, res) => {
  const db = getDb();
  const logRow = db.prepare('SELECT id, status FROM ai_generation_logs WHERE id = ?').get(req.params.id);
  if (!logRow) return res.status(404).json({ success: false, error: '记录不存在' });
  if (logRow.status === 'adopted') {
    // Don't delete adopted, just mark discarded
    return res.status(400).json({ success: false, error: '已采用的记录不可删除' });
  }
  db.prepare("UPDATE ai_generation_logs SET status = 'discarded' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// POST AI 生成后确认保存 (legacy — still works for direct save without draft)
router.post('/ai-confirm', (req, res) => {
  const { asset_id, asset_ids, strategy, plans, generation_id, existing_strategy_id } = req.body;
  if (!strategy || !plans) return res.status(400).json({ success: false, error: '缺少策略数据' });

  const db = getDb();
  const ids = asset_ids && asset_ids.length > 0 ? asset_ids : (asset_id ? [asset_id] : []);
  const primaryAssetId = ids[0] || null;
  const assetIdsJson = ids.length > 1 ? JSON.stringify(ids) : null;

  try {
    const saveAll = db.transaction(() => {
      const params = typeof strategy.parameters === 'string' ? strategy.parameters : JSON.stringify(strategy.parameters || {});
      let strategyId;

      if (existing_strategy_id) {
        // Update existing strategy
        db.prepare(
          'UPDATE strategies SET name = ?, description = ?, type = ?, asset_id = ?, asset_ids = ?, parameters = ? WHERE id = ?'
        ).run(strategy.name, strategy.description || '', strategy.type, primaryAssetId, assetIdsJson, params, existing_strategy_id);
        strategyId = existing_strategy_id;

        // Remove old plans and re-insert
        db.prepare('DELETE FROM trading_plans WHERE strategy_id = ?').run(strategyId);
      } else {
        // Create new strategy
        const sResult = db.prepare(
          'INSERT INTO strategies (name, description, type, asset_id, asset_ids, parameters, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(strategy.name, strategy.description || '', strategy.type, primaryAssetId, assetIdsJson, params, 'active');
        strategyId = sResult.lastInsertRowid;
      }

      const insert = db.prepare(
        'INSERT INTO trading_plans (strategy_id, asset_id, seq, trigger_type, trigger_value, action, quantity, amount, new_avg_cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const p of plans) {
        const planAssetId = p.asset_id || primaryAssetId;
        insert.run(strategyId, planAssetId, p.seq, p.trigger_type, p.trigger_value, p.action,
          p.quantity || null, p.amount || null, p.new_avg_cost || null, p.notes || p.rationale || null);
      }

      // If there's a generation_id, mark it as adopted
      if (generation_id) {
        db.prepare("UPDATE ai_generation_logs SET status = 'adopted', strategy_id = ? WHERE id = ?").run(strategyId, generation_id);
      }

      return strategyId;
    });

    const strategyId = saveAll();
    res.json({ success: true, data: { strategyId } });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

export default router;
