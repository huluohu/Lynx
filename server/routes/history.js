import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();
const HISTORY_SELECT = `SELECT h.*, a.name as asset_name, a.symbol, a.type as asset_type,
    COALESCE(h.currency, a.currency, 'CNY') as currency
  FROM trade_history h JOIN assets a ON h.asset_id = a.id`;

function loadTrade(db, id) {
  return db.prepare(`${HISTORY_SELECT} WHERE h.id = ?`).get(id);
}

function getActiveHolding(db, assetId) {
  return db.prepare("SELECT * FROM holdings WHERE asset_id = ? AND status = 'active'").get(assetId);
}

function getLatestHolding(db, assetId) {
  return db.prepare(`SELECT * FROM holdings
    WHERE asset_id = ?
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC, id DESC
    LIMIT 1`).get(assetId);
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
    throw Object.assign(new Error('当前没有足够持仓可卖出'), { statusCode: 400 });
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

function rollbackTradeHoldings(db, trade) {
  const quantity = Number(trade.quantity || 0);
  const total = Number(trade.total || 0);
  const price = Number(trade.price || 0);
  const holding = getLatestHolding(db, trade.asset_id);

  if (trade.type === 'buy') {
    if (!holding) return;

    const currentQty = Number(holding.quantity || 0);
    const currentTotal = Number(holding.total_invested || 0);
    const avgCost = currentQty > 0 ? currentTotal / currentQty : Number(holding.avg_cost || price || 0);
    const qtyReduction = Math.min(quantity, currentQty);
    const newQty = Math.max(0, currentQty - quantity);
    const deductedCost = currentQty > 0 ? avgCost * qtyReduction : Math.min(total, currentTotal);
    const newTotalInvested = Math.max(0, currentTotal - deductedCost);
    const newAvgCost = newQty > 0 ? newTotalInvested / newQty : 0;
    const nextStatus = newQty > 0 ? 'active' : 'closed';

    db.prepare(`UPDATE holdings
      SET quantity = ?, avg_cost = ?, total_invested = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?`)
      .run(newQty, newAvgCost, newTotalInvested, nextStatus, holding.id);
    return;
  }

  const costBasis = holding && Number(holding.avg_cost || 0) > 0 ? Number(holding.avg_cost) : price;
  if (!holding) {
    db.prepare(`INSERT INTO holdings (asset_id, quantity, avg_cost, total_invested, status)
      VALUES (?, ?, ?, ?, 'active')`)
      .run(trade.asset_id, quantity, costBasis, quantity * costBasis);
    return;
  }

  const newQty = Number(holding.quantity || 0) + quantity;
  const newTotalInvested = Number(holding.total_invested || 0) + quantity * costBasis;
  const newAvgCost = newQty > 0 ? newTotalInvested / newQty : costBasis;
  db.prepare(`UPDATE holdings
    SET quantity = ?, avg_cost = ?, total_invested = ?, status = 'active', updated_at = datetime('now')
    WHERE id = ?`)
    .run(newQty, newAvgCost, newTotalInvested, holding.id);
}

function revertPlanExecution(db, trade) {
  if (!trade.plan_id) return;
  const plan = db.prepare('SELECT * FROM trading_plans WHERE id = ?').get(trade.plan_id);
  if (!plan) return;

  const nextExecutedQuantity = Math.max(0, Number(plan.executed_quantity || 0) - Number(trade.quantity || 0));
  const nextExecutedAmount = Math.max(0, Number(plan.executed_amount || 0) - Number(trade.total || 0));
  const latestTrade = db.prepare(`SELECT id, price, executed_at
    FROM trade_history
    WHERE plan_id = ? AND id != ? AND COALESCE(reverted, 0) = 0
    ORDER BY executed_at DESC, id DESC
    LIMIT 1`).get(plan.id, trade.id);

  let nextStatus = plan.status;
  if (['executed', 'partial'].includes(plan.status)) {
    nextStatus = nextExecutedQuantity > 0 ? 'triggered' : 'pending';
  }

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
      latestTrade?.price ?? null,
      latestTrade?.executed_at ?? null,
      latestTrade?.id ?? null,
      nextStatus,
      plan.id,
    );
}

// GET 历史列表
router.get('/', (req, res) => {
  const db = getDb();
  const {
    limit = 50,
    offset = 0,
    asset_id,
    type,
    status,
    currency,
    start_date,
    end_date,
    sort = 'executed_desc',
  } = req.query;

  const conditions = [];
  const params = [];
  const countParams = [];

  if (asset_id) {
    conditions.push('h.asset_id = ?');
    params.push(Number(asset_id));
    countParams.push(Number(asset_id));
  }
  if (type) {
    conditions.push('h.type = ?');
    params.push(type);
    countParams.push(type);
  }
  if (status === 'active') {
    conditions.push('COALESCE(h.reverted, 0) = 0');
  } else if (status === 'reverted') {
    conditions.push('COALESCE(h.reverted, 0) = 1');
  }
  if (currency) {
    conditions.push("COALESCE(h.currency, a.currency, 'CNY') = ?");
    params.push(currency);
    countParams.push(currency);
  }
  if (start_date) {
    conditions.push('date(h.executed_at) >= date(?)');
    params.push(start_date);
    countParams.push(start_date);
  }
  if (end_date) {
    conditions.push('date(h.executed_at) <= date(?)');
    params.push(end_date);
    countParams.push(end_date);
  }

  const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const orderBySql = {
    executed_desc: 'h.executed_at DESC, h.id DESC',
    executed_asc: 'h.executed_at ASC, h.id ASC',
    total_desc: 'h.total DESC, h.id DESC',
    total_asc: 'h.total ASC, h.id ASC',
  }[sort] || 'h.executed_at DESC, h.id DESC';
  const rows = db.prepare(`${HISTORY_SELECT}${whereSql}
    ORDER BY ${orderBySql} LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));
  const total = db.prepare(`SELECT COUNT(*) as count FROM trade_history h JOIN assets a ON h.asset_id = a.id${whereSql}`).get(...countParams).count;
  res.json({ success: true, data: rows, total });
});

// POST 添加历史记录
router.post('/', (req, res) => {
  const db = getDb();
  const { asset_id, type, quantity, price, total, pnl, pnl_pct, executed_at, reason, tags, currency, plan_id } = req.body;

  if (!asset_id || !type || quantity === undefined || quantity === null || price === undefined || price === null) {
    return res.status(400).json({ success: false, error: '缺少必要字段: asset_id, type, quantity, price' });
  }

  const qty = Number(quantity);
  const prc = Number(price);
  const amt = Number(total) || qty * prc;
  const tradeCurrency = currency || db.prepare('SELECT currency FROM assets WHERE id = ?').get(asset_id)?.currency || 'CNY';
  const linkedPlan = plan_id
    ? db.prepare('SELECT id, strategy_id, plan_set_id FROM trading_plans WHERE id = ?').get(plan_id)
    : null;

  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(prc) || prc <= 0) {
    return res.status(400).json({ success: false, error: '数量和价格必须大于 0' });
  }
  if (!['buy', 'sell'].includes(type)) {
    return res.status(400).json({ success: false, error: '交易类型必须是 buy 或 sell' });
  }

  try {
    const rowId = db.transaction(() => {
      applyTradeToHoldings(db, {
        assetId: Number(asset_id),
        type,
        quantity: qty,
        amount: amt,
        price: prc,
      });

      const info = db.prepare(`INSERT INTO trade_history (
          asset_id, type, quantity, price, total, pnl, pnl_pct, executed_at, reason, tags, currency, plan_id, strategy_id, plan_set_id, attribution_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          asset_id,
          type,
          qty,
          prc,
          amt,
          pnl || null,
          pnl_pct || null,
          executed_at || new Date().toISOString(),
          reason || null,
          tags || null,
          tradeCurrency,
          linkedPlan?.id || null,
          linkedPlan?.strategy_id || null,
          linkedPlan?.plan_set_id || null,
          linkedPlan ? 'manual_linked' : 'manual_unlinked',
        );

      return info.lastInsertRowid;
    })();

    const row = loadTrade(db, rowId);
    res.status(201).json({ success: true, data: row });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message || '保存交易记录失败' });
  }
});

// POST 撤销交易记录
router.post('/:id/undo', (req, res) => {
  const db = getDb();
  const rollbackHoldings = req.body.rollback_holdings !== false;

  try {
    const revertedTrade = db.transaction(() => {
      const trade = loadTrade(db, req.params.id);
      if (!trade) {
        throw Object.assign(new Error('交易记录不存在'), { statusCode: 404 });
      }
      if (Number(trade.reverted || 0) === 1) {
        throw Object.assign(new Error('该交易记录已撤销'), { statusCode: 400 });
      }

      if (rollbackHoldings) {
        rollbackTradeHoldings(db, trade);
      }

      const revertedAt = new Date().toISOString();
      db.prepare('UPDATE trade_history SET reverted = 1, reverted_at = ? WHERE id = ?').run(revertedAt, trade.id);
      revertPlanExecution(db, trade);
      return loadTrade(db, trade.id);
    })();

    res.json({ success: true, data: revertedTrade });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message || '撤销交易失败' });
  }
});

// PUT 编辑复盘
router.put('/:id', (req, res) => {
  const db = getDb();
  const { reason, tags } = req.body;
  db.prepare('UPDATE trade_history SET reason=?, tags=? WHERE id=?').run(reason || null, tags || null, req.params.id);
  res.json({ success: true });
});

// DELETE
router.delete('/:id', (req, res) => {
  const db = getDb();
  try {
    const trade = loadTrade(db, req.params.id);
    if (!trade) {
      return res.status(404).json({ success: false, error: '交易记录不存在' });
    }
    if (Number(trade.reverted || 0) !== 1) {
      return res.status(400).json({ success: false, error: '仅支持删除已撤销的交易记录' });
    }

    const info = db.prepare('DELETE FROM trade_history WHERE id = ?').run(req.params.id);
    if (!info.changes) {
      return res.status(404).json({ success: false, error: '交易记录不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '删除交易记录失败' });
  }
});

export default router;
