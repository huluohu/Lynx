import { getDb } from '../db/database.js';
import { createNotification } from '../routes/notifications.js';
import { pushPendingNotifications } from './push.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('strategy-monitor');
let monitorTimer = null;

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function wasRecentlyNotified(db, { type, planId, strategyId }) {
  const row = db.prepare(`SELECT id FROM notifications
    WHERE type = ?
      AND COALESCE(plan_id, 0) = COALESCE(?, 0)
      AND COALESCE(strategy_id, 0) = COALESCE(?, 0)
      AND created_at >= datetime('now', '-1 day')
    ORDER BY created_at DESC
    LIMIT 1`).get(type, planId || null, strategyId || null);
  return !!row;
}

export function checkStrategyAlerts() {
  const db = getDb();
  const approachingPct = safeNumber(
    db.prepare("SELECT value FROM settings WHERE key = 'plan_approaching_pct'").get()?.value,
    5,
  );

  const strategies = db.prepare(`SELECT id, name FROM strategies WHERE status = 'active' ORDER BY id ASC`).all();
  const latestPriceStmt = db.prepare(`SELECT price, fetched_at FROM price_cache WHERE asset_id = ? ORDER BY datetime(fetched_at) DESC, id DESC LIMIT 1`);
  const planStmt = db.prepare(`SELECT p.*, a.name AS asset_name, a.symbol
    FROM trading_plans p
    LEFT JOIN assets a ON p.asset_id = a.id
    WHERE p.strategy_id = ? AND p.status = 'pending'
    ORDER BY p.seq ASC, p.id ASC`);
  const markTriggeredStmt = db.prepare("UPDATE trading_plans SET status = 'triggered', updated_at = datetime('now') WHERE id = ? AND status = 'pending'");

  let triggered = 0;
  let approaching = 0;

  for (const strategy of strategies) {
    const plans = planStmt.all(strategy.id);
    for (const plan of plans) {
      const latestPrice = latestPriceStmt.get(plan.asset_id);
      if (!latestPrice) continue;

      const price = safeNumber(latestPrice.price);
      const triggerValue = safeNumber(plan.trigger_value);
      if (price <= 0 || triggerValue <= 0) continue;

      const isTriggered = (plan.trigger_type === 'price_below' && price <= triggerValue)
        || (plan.trigger_type === 'price_above' && price >= triggerValue);
      const diffPct = Math.abs((price - triggerValue) / triggerValue) * 100;
      const isApproaching = !isTriggered
        && diffPct <= approachingPct
        && ((plan.trigger_type === 'price_below' && price > triggerValue)
          || (plan.trigger_type === 'price_above' && price < triggerValue));

      if (isTriggered) {
        if (!wasRecentlyNotified(db, { type: 'plan_triggered', planId: plan.id, strategyId: strategy.id })) {
          createNotification(db, {
            type: 'plan_triggered',
            title: `策略触发：${strategy.name}`,
            message: `${plan.asset_name || '资产'} 当前价格 ${price} 已触发${plan.action === 'buy' ? '买入' : '卖出'}条件（阈值 ${triggerValue}）`,
            asset_id: plan.asset_id,
            plan_id: plan.id,
            strategy_id: strategy.id,
            severity: 'danger',
            channel: 'web',
          });
        }
        markTriggeredStmt.run(plan.id);
        triggered += 1;
        continue;
      }

      if (isApproaching && !wasRecentlyNotified(db, { type: 'plan_approaching', planId: plan.id, strategyId: strategy.id })) {
        createNotification(db, {
          type: 'plan_approaching',
          title: `计划接近触发：${strategy.name}`,
          message: `${plan.asset_name || '资产'} 距${plan.action === 'buy' ? '买入' : '卖出'}条件仅 ${diffPct.toFixed(2)}%（当前 ${price} / 阈值 ${triggerValue}）`,
          asset_id: plan.asset_id,
          plan_id: plan.id,
          strategy_id: strategy.id,
          severity: 'warning',
          channel: 'web',
        });
        approaching += 1;
      }
    }
  }

  log.debug('Strategy alerts checked', { strategies: strategies.length, triggered, approaching });
  return { success: true, data: { strategies: strategies.length, triggered, approaching } };
}

export function startMonitor(intervalMs) {
  if (monitorTimer) clearInterval(monitorTimer);

  // Read interval from settings if not provided
  if (!intervalMs) {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'strategy_monitor_interval'").get();
    const minutes = Math.max(1, parseInt(row?.value || '5', 10));
    intervalMs = minutes * 60 * 1000;
  }

  try {
    checkStrategyAlerts();
  } catch (error) {
    log.warn('Initial monitor run failed', { error: error.message });
  }

  monitorTimer = setInterval(() => {
    try {
      checkStrategyAlerts();
      // Auto-push pending notifications via webhook
      pushPendingNotifications().catch(() => {});
    } catch (error) {
      log.warn('Monitor iteration failed', { error: error.message });
    }
  }, intervalMs);

  log.info('Strategy monitor started', { intervalMs });
  return monitorTimer;
}
