import { Router } from 'express';
import { getDb } from '../db/database.js';
import { applyTradeToHoldings, recomputeHoldingFromTrades } from '../services/holdings-service.js';

const router = Router();
const HISTORY_SELECT = `SELECT h.*, a.name as asset_name, a.symbol, a.type as asset_type,
    COALESCE(h.currency, a.currency, 'CNY') as currency
  FROM trade_history h JOIN assets a ON h.asset_id = a.id`;

function loadTrade(db, id) {
  return db.prepare(`${HISTORY_SELECT} WHERE h.id = ?`).get(id);
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
  const parsedLimit = Math.min(500, Math.max(1, Math.trunc(Number(limit)) || 50));
  const parsedOffset = Math.max(0, Math.trunc(Number(offset)) || 0);

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
    ORDER BY ${orderBySql} LIMIT ? OFFSET ?`).all(...params, parsedLimit, parsedOffset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM trade_history h JOIN assets a ON h.asset_id = a.id${whereSql}`).get(...countParams).count;
  res.json({ success: true, data: rows, total });
});

// POST 添加历史记录
router.post('/', (req, res) => {
  const db = getDb();
  const { asset_id, type, quantity, price, total, fee = 0, pnl, pnl_pct, executed_at, reason, tags, currency, plan_id } = req.body;

  if (!asset_id || !type || quantity === undefined || quantity === null || price === undefined || price === null) {
    return res.status(400).json({ success: false, error: '缺少必要字段: asset_id, type, quantity, price' });
  }

  const qty = Number(quantity);
  const prc = Number(price);
  const tradeTotal = Number(total) || qty * prc;
  const tradeFee = Number(fee || 0);
  const costAmount = type === 'buy' ? tradeTotal + (Number.isFinite(tradeFee) ? tradeFee : 0) : tradeTotal;
  const tradeCurrency = currency || db.prepare('SELECT currency FROM assets WHERE id = ?').get(asset_id)?.currency || 'CNY';
  const linkedPlan = plan_id
    ? db.prepare('SELECT id, strategy_id, plan_set_id FROM trading_plans WHERE id = ?').get(plan_id)
    : null;

  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(prc) || prc <= 0) {
    return res.status(400).json({ success: false, error: '数量和价格必须大于 0' });
  }
  if (!Number.isFinite(tradeTotal) || tradeTotal < 0 || !Number.isFinite(tradeFee) || tradeFee < 0) {
    return res.status(400).json({ success: false, error: '成交金额和手续费不能为负数' });
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
        amount: costAmount,
        price: prc,
      });

      const info = db.prepare(`INSERT INTO trade_history (
          asset_id, type, quantity, price, total, fee, pnl, pnl_pct, executed_at, reason, tags, currency, plan_id, strategy_id, plan_set_id, attribution_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          asset_id,
          type,
          qty,
          prc,
          tradeTotal,
          tradeFee,
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

      const revertedAt = new Date().toISOString();
      // 先标记撤销，再基于剩余交易全量重放持仓，保证重放不含被撤销的这笔
      db.prepare('UPDATE trade_history SET reverted = 1, reverted_at = ? WHERE id = ?').run(revertedAt, trade.id);

      if (rollbackHoldings) {
        recomputeHoldingFromTrades(db, trade.asset_id);
      }

      revertPlanExecution(db, trade);
      return loadTrade(db, trade.id);
    })();

    res.json({ success: true, data: revertedTrade });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: error.message || '撤销交易失败' });
  }
});

// PUT 编辑复盘（部分更新：仅覆盖显式传入的字段）
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id, reason, tags FROM trade_history WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: '交易记录不存在' });
  const { reason, tags } = req.body || {};
  const nextReason = reason === undefined ? existing.reason : reason;
  const nextTags = tags === undefined ? existing.tags : tags;
  db.prepare('UPDATE trade_history SET reason=?, tags=? WHERE id=?').run(nextReason, nextTags, req.params.id);
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
