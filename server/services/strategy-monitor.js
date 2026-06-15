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

function wasRecentlyNotified(db, { type, planId, strategyId, assetId }) {
  if (planId || strategyId) {
    const row = db.prepare(`SELECT id FROM notifications
      WHERE type = ?
        AND COALESCE(plan_id, 0) = COALESCE(?, 0)
        AND COALESCE(strategy_id, 0) = COALESCE(?, 0)
        AND created_at >= datetime('now', '-1 day')
      ORDER BY created_at DESC
      LIMIT 1`).get(type, planId || null, strategyId || null);
    return !!row;
  }
  // For stop_loss and price_swing: deduplicate by asset_id
  const row = db.prepare(`SELECT id FROM notifications
    WHERE type = ?
      AND asset_id = ?
      AND created_at >= datetime('now', '-1 day')
    ORDER BY created_at DESC
    LIMIT 1`).get(type, assetId || null);
  return !!row;
}

export function checkStrategyAlerts() {
  const db = getDb();
  const approachingPct = safeNumber(
    db.prepare("SELECT value FROM settings WHERE key = 'plan_approaching_pct'").get()?.value,
    5,
  );
  const priceAlertThreshold = safeNumber(
    db.prepare("SELECT value FROM settings WHERE key = 'price_alert_threshold'").get()?.value,
    2,
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

  // 3. 持仓止损监控
  const holdings = db.prepare(`SELECT h.*, a.name, a.symbol FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.status = 'active'`).all();
  let stopLossCount = 0;

  for (const h of holdings) {
    const latestPrice = latestPriceStmt.get(h.asset_id);
    if (!latestPrice || !h.stop_loss) continue;
    const price = safeNumber(latestPrice.price);
    const stopLoss = safeNumber(h.stop_loss);
    if (price <= 0 || stopLoss <= 0) continue;
    const diffPct = (price - stopLoss) / stopLoss * 100;

    if (diffPct <= 5) {
      const type = diffPct <= 0 ? 'stop_loss_triggered' : 'stop_loss_approaching';
      if (!wasRecentlyNotified(db, { type, planId: null, strategyId: null, assetId: h.asset_id })) {
        createNotification(db, {
          type,
          title: diffPct <= 0 ? `止损触发：${h.name}` : `接近止损：${h.name}`,
          message: diffPct <= 0
            ? `${h.name} 当前价格 ${price} 已跌破止损线 ${stopLoss}！`
            : `${h.name} 距止损线 ${stopLoss} 仅 ${diffPct.toFixed(1)}%（当前 ${price}）`,
          asset_id: h.asset_id,
          severity: diffPct <= 0 ? 'danger' : 'warning',
          channel: 'web',
        });
        stopLossCount += 1;
      }
    }
  }

  // 4. 价格大幅波动
  const assets = db.prepare('SELECT id, name, symbol FROM assets').all();
  let swingCount = 0;

  for (const asset of assets) {
    const lastTwo = db.prepare(`SELECT price, fetched_at FROM price_cache WHERE asset_id = ? ORDER BY datetime(fetched_at) DESC, id DESC LIMIT 2`).all(asset.id);
    if (lastTwo.length < 2) continue;
    const changePct = (lastTwo[0].price - lastTwo[1].price) / lastTwo[1].price * 100;
    if (Math.abs(changePct) >= priceAlertThreshold) {
      if (!wasRecentlyNotified(db, { type: 'price_swing', planId: null, strategyId: null, assetId: asset.id })) {
        createNotification(db, {
          type: 'price_swing',
          title: `价格波动：${asset.name}`,
          message: changePct >= 0
            ? `${asset.name} 大涨 +${changePct.toFixed(1)}%`
            : `${asset.name} 大跌 ${changePct.toFixed(1)}%`,
          asset_id: asset.id,
          severity: Math.abs(changePct) >= 5 ? 'danger' : 'info',
          channel: 'web',
        });
        swingCount += 1;
      }
    }
  }

  log.debug('Strategy alerts checked', { strategies: strategies.length, triggered, approaching, stopLossCount, swingCount });
  return { success: true, data: { strategies: strategies.length, triggered, approaching, stopLossCount, swingCount } };
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
