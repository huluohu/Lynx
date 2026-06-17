import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();
const VALID_PLAN_STATUSES = new Set(['pending', 'triggered', 'partial', 'executed', 'cancelled']);
const EXECUTABLE_PLAN_STATUSES = new Set(['pending', 'triggered', 'partial']);
const PLAN_SELECT = `SELECT p.*, ps.status as plan_set_status, ps.version_no as plan_set_version, a.name as asset_name, a.symbol, a.type as asset_type, a.currency as asset_currency
  FROM trading_plans p
  LEFT JOIN plan_sets ps ON ps.id = p.plan_set_id
  JOIN assets a ON p.asset_id = a.id`;
const TRADE_SELECT = `SELECT h.*, a.name as asset_name, a.symbol, a.type as asset_type,
    COALESCE(h.currency, a.currency, 'CNY') as currency
  FROM trade_history h
  JOIN assets a ON h.asset_id = a.id`;

function loadPlan(db, id) {
  return db.prepare(`${PLAN_SELECT} WHERE p.id = ?`).get(id);
}

function loadTrade(db, id) {
  return db.prepare(`${TRADE_SELECT} WHERE h.id = ?`).get(id);
}

function getActivePlanSetId(db, strategyId) {
  return db.prepare("SELECT id FROM plan_sets WHERE strategy_id = ? AND status = 'active' ORDER BY version_no DESC, id DESC LIMIT 1")
    .get(strategyId)?.id || null;
}

function assertPlanSetExecutable(plan) {
  if (plan?.plan_set_id && plan.plan_set_status !== 'active') {
    throw Object.assign(new Error('该计划属于已归档的计划批次，不能继续执行'), { statusCode: 400 });
  }
}

function toPositiveNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function getActiveHolding(db, assetId) {
  return db.prepare("SELECT * FROM holdings WHERE asset_id = ? AND status = 'active'").get(assetId);
}

function applyTradeToHoldings(db, { assetId, type, quantity, amount, price }) {
  const holding = getActiveHolding(db, assetId);

  if (type === 'buy') {
    if (holding) {
      const newQty = Number(holding.quantity || 0) + quantity;
      const newTotalInvested = Number(holding.total_invested || 0) + amount;
      const newAvgCost = newQty > 0 ? newTotalInvested / newQty : 0;
      db.prepare(`UPDATE holdings
        SET quantity = ?, avg_cost = ?, total_invested = ?, status = 'active', updated_at = datetime('now')
        WHERE id = ?`)
        .run(newQty, newAvgCost, newTotalInvested, holding.id);
    } else {
      db.prepare(`INSERT INTO holdings (asset_id, quantity, avg_cost, total_invested, status)
        VALUES (?, ?, ?, ?, 'active')`)
        .run(assetId, quantity, amount / quantity || price, amount);
    }
    return;
  }

  if (!holding || Number(holding.quantity || 0) < quantity) {
    throw Object.assign(new Error('当前持仓数量不足，无法执行卖出计划'), { statusCode: 400 });
  }

  const newQty = Number(holding.quantity || 0) - quantity;
  const newTotalInvested = newQty > 0 ? newQty * Number(holding.avg_cost || 0) : 0;
  if (newQty <= 0) {
    db.prepare(`UPDATE holdings
      SET quantity = 0, total_invested = 0, status = 'closed', updated_at = datetime('now')
      WHERE id = ?`)
      .run(holding.id);
  } else {
    db.prepare(`UPDATE holdings
      SET quantity = ?, total_invested = ?, updated_at = datetime('now')
      WHERE id = ?`)
      .run(newQty, newTotalInvested, holding.id);
  }
}

// GET 所有/某策略下的计划
router.get('/', (req, res) => {
  const db = getDb();
  const { strategy_id, asset_id, plan_set_id, include_superseded, include_cancelled } = req.query;
  let sql = `${PLAN_SELECT} WHERE 1=1`;
  const params = [];
  if (include_cancelled !== '1') {
    sql += " AND p.status != 'cancelled'";
  }
  if (strategy_id) {
    sql += ' AND p.strategy_id = ?';
    params.push(strategy_id);
    if (!plan_set_id && include_superseded !== '1') {
      const activePlanSetId = getActivePlanSetId(db, strategy_id);
      if (activePlanSetId) {
        sql += ' AND p.plan_set_id = ?';
        params.push(activePlanSetId);
      }
    }
  }
  if (plan_set_id) { sql += ' AND p.plan_set_id = ?'; params.push(plan_set_id); }
  if (asset_id) { sql += ' AND p.asset_id = ?'; params.push(asset_id); }
  sql += ' ORDER BY p.seq, p.id';

  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

// GET 单个计划
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = loadPlan(db, req.params.id);
  if (!row) return res.status(404).json({ success: false, error: '计划不存在' });
  res.json({ success: true, data: row });
});

// PUT 编辑
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const { trigger_type, trigger_value, action, quantity, amount, status, notes } = req.body;
  const nextStatus = status ?? existing.status;
  if (!VALID_PLAN_STATUSES.has(nextStatus)) {
    return res.status(400).json({ success: false, error: '无效的计划状态' });
  }

  db.prepare(`UPDATE trading_plans SET trigger_type=?, trigger_value=?, action=?, quantity=?, amount=?,
    status=?, notes=?, updated_at=datetime('now') WHERE id=?`).run(
    trigger_type ?? existing.trigger_type, trigger_value ?? existing.trigger_value,
    action ?? existing.action, quantity ?? existing.quantity, amount ?? existing.amount,
    nextStatus, notes ?? existing.notes, req.params.id
  );

  const row = loadPlan(db, req.params.id);
  res.json({ success: true, data: row });
});

// POST 标记触发
router.post('/:id/trigger', (req, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT id FROM trading_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });
  try { assertPlanSetExecutable(loadPlan(db, req.params.id)); } catch (error) { return res.status(error.statusCode || 400).json({ success: false, error: error.message }); }
  db.prepare("UPDATE trading_plans SET status='triggered', updated_at=datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: loadPlan(db, req.params.id) });
});

// POST 执行计划
router.post('/:id/execute', (req, res) => {
  const db = getDb();
  const executionPrice = toPositiveNumber(req.body.price);
  if (!executionPrice) {
    return res.status(400).json({ success: false, error: '成交价格必须大于 0' });
  }

  try {
    const result = db.transaction(() => {
      const plan = loadPlan(db, req.params.id);
      if (!plan) {
        throw Object.assign(new Error('计划不存在'), { statusCode: 404 });
      }
      assertPlanSetExecutable(plan);
      if (!EXECUTABLE_PLAN_STATUSES.has(plan.status)) {
        throw Object.assign(new Error('当前计划状态不允许执行'), { statusCode: 400 });
      }

      const plannedQuantity = toPositiveNumber(plan.quantity);
      const plannedAmount = toPositiveNumber(plan.amount);
      const executedQuantity = Number(plan.executed_quantity || 0);
      const executedAmount = Number(plan.executed_amount || 0);
      const remainingQuantity = plannedQuantity ? Math.max(plannedQuantity - executedQuantity, 0) : null;
      const remainingAmount = plannedAmount ? Math.max(plannedAmount - executedAmount, 0) : null;

      const actualQuantity = toPositiveNumber(req.body.quantity)
        ?? remainingQuantity
        ?? plannedQuantity
        ?? (toPositiveNumber(req.body.amount) ? Number(req.body.amount) / executionPrice : null)
        ?? (remainingAmount ? remainingAmount / executionPrice : null);

      if (!actualQuantity) {
        throw Object.assign(new Error('无法确定成交数量，请提供有效的 quantity'), { statusCode: 400 });
      }

      if (remainingQuantity !== null && actualQuantity - remainingQuantity > 1e-8) {
        throw Object.assign(new Error('成交数量超过计划剩余数量'), { statusCode: 400 });
      }

      const actualAmount = toPositiveNumber(req.body.amount)
        ?? (remainingAmount && actualQuantity >= remainingQuantity - 1e-8 ? remainingAmount : null)
        ?? actualQuantity * executionPrice;

      applyTradeToHoldings(db, {
        assetId: plan.asset_id,
        type: plan.action,
        quantity: actualQuantity,
        amount: actualAmount,
        price: executionPrice,
      });

      const executedAt = new Date().toISOString();
      const tradeInfo = db.prepare(`INSERT INTO trade_history (
          asset_id, type, quantity, price, total, executed_at, currency, plan_id, strategy_id, plan_set_id, attribution_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          plan.asset_id,
          plan.action,
          actualQuantity,
          executionPrice,
          actualAmount,
          executedAt,
          req.body.currency || plan.asset_currency || 'CNY',
          plan.id,
          plan.strategy_id,
          plan.plan_set_id || null,
          'plan_execute',
        );

      const nextExecutedQuantity = executedQuantity + actualQuantity;
      const nextExecutedAmount = executedAmount + actualAmount;
      const isPartial = Boolean(req.body.partial) || (plannedQuantity ? nextExecutedQuantity < plannedQuantity - 1e-8 : false);
      const nextStatus = isPartial ? 'partial' : 'executed';

      db.prepare(`UPDATE trading_plans
        SET executed_quantity = ?,
            executed_amount = ?,
            executed_price = ?,
            executed_at = ?,
            trade_history_id = ?,
            status = ?,
            updated_at = datetime('now')
        WHERE id = ?`)
        .run(
          nextExecutedQuantity,
          nextExecutedAmount,
          executionPrice,
          executedAt,
          tradeInfo.lastInsertRowid,
          nextStatus,
          plan.id,
        );

      return {
        plan: loadPlan(db, plan.id),
        trade: loadTrade(db, tradeInfo.lastInsertRowid),
      };
    })();

    res.json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message || '计划执行失败' });
  }
});

// POST 取消计划
router.post('/:id/cancel', (req, res) => {
  const db = getDb();
  const plan = db.prepare('SELECT id FROM trading_plans WHERE id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: '计划不存在' });

  db.prepare("UPDATE trading_plans SET status='cancelled', updated_at=datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ success: true, data: loadPlan(db, req.params.id) });
});

export default router;
