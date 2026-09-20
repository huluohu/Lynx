/**
 * 持仓账目服务 —— 持仓更新的唯一实现，供 routes/plans、routes/history、routes/transactions 复用。
 * 金额/数量沿用系统的浮点口径（见 review 备案：整数最小单位迁移另行立项）。
 */
import { getDb } from '../db/database.js';

function getActiveHolding(db, assetId) {
  return db.prepare("SELECT * FROM holdings WHERE asset_id = ? AND status = 'active'").get(assetId);
}

function getLatestHolding(db, assetId) {
  return db.prepare(`SELECT * FROM holdings
    WHERE asset_id = ?
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC, id DESC
    LIMIT 1`).get(assetId);
}

/**
 * 交易对持仓的增量更新（买入加权、卖出按均价比例缩减）。
 */
export function applyTradeToHoldings(db, { assetId, type, quantity, amount, price }) {
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
    throw Object.assign(new Error('当前持仓数量不足，无法卖出'), { statusCode: 400 });
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

/**
 * 按该资产全部未撤销交易重放持仓（撤销交易后调用，替代不精确的增量回滚：
 * 乱序撤销时"按当前均价扣减"会扭曲剩余持仓的真实成本）。
 * 买入按 total+fee 计入成本；卖出按当时均价比例缩减。
 */
export function recomputeHoldingFromTrades(db, assetId) {
  const trades = db.prepare(`SELECT type, quantity, price, total, COALESCE(fee, 0) AS fee
    FROM trade_history
    WHERE asset_id = ? AND COALESCE(reverted, 0) = 0
    ORDER BY datetime(executed_at) ASC, id ASC`).all(assetId);

  let quantity = 0;
  let invested = 0;

  for (const trade of trades) {
    const qty = Math.max(0, Number(trade.quantity) || 0);
    const total = Number(trade.total) || 0;
    const fee = Number(trade.fee) || 0;

    if (trade.type === 'buy' && qty > 0) {
      const amount = (total > 0 ? total : qty * (Number(trade.price) || 0)) + fee;
      quantity += qty;
      invested += Number.isFinite(amount) ? amount : 0;
    } else if (trade.type === 'sell' && qty > 0) {
      const before = quantity;
      const sellQty = Math.min(qty, before);
      quantity = before - sellQty;
      invested = before > 0 ? invested * (quantity / before) : 0;
      if (quantity <= 1e-8) {
        quantity = 0;
        invested = 0;
      }
    }
  }

  const avgCost = quantity > 0 ? invested / quantity : 0;
  const nextStatus = quantity > 0 ? 'active' : 'closed';
  const holding = getLatestHolding(db, assetId);

  if (holding) {
    db.prepare(`UPDATE holdings
      SET quantity = ?, avg_cost = ?, total_invested = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?`)
      .run(quantity, avgCost, invested, nextStatus, holding.id);
  } else if (quantity > 0) {
    db.prepare(`INSERT INTO holdings (asset_id, quantity, avg_cost, total_invested, status)
      VALUES (?, ?, ?, ?, 'active')`)
      .run(assetId, quantity, avgCost, invested);
  }

  return getLatestHolding(db, assetId);
}
