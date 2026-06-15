import { getDb } from '../db/database.js';
import { getAgentConfig, callLLM } from './strategy-agent.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai-review');

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text?.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  const start = text?.indexOf('{');
  const end = text?.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

function safeParse(value, fallback) {
  try { return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback); } catch { return fallback; }
}

function clampScore(value, fallback = 6) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(1, Math.min(10, Math.round(score)));
}

function strategyAssetIds(strategy) {
  const ids = new Set();
  if (strategy.asset_id) ids.add(Number(strategy.asset_id));
  for (const id of safeParse(strategy.asset_ids, [])) {
    if (id) ids.add(Number(id));
  }
  return [...ids].filter(Boolean);
}

function normalizeRecommendations(value, fallback = []) {
  if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(/\n|；|;/).map(v => v.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
  }
  return fallback;
}

function normalizeDeviation(value, fallback) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string' && value.trim()) {
    try { return JSON.parse(value); } catch { return { analysis: value.trim() }; }
  }
  return fallback;
}

function formatPlans(plans) {
  if (!plans.length) return '暂无操盘计划';
  return plans.map(p => `- [${p.status}] 第${p.seq || '-'}步 ${p.asset_name || ''} ${p.action === 'buy' ? '买入' : '卖出'}，触发条件：${p.trigger_type === 'price_above' ? '价格 ≥' : p.trigger_type === 'price_below' ? '价格 ≤' : '时间'} ${p.trigger_value}，数量：${p.quantity ?? '-'}，金额：${p.amount ?? '-'}，备注：${p.notes || '无'}`).join('\n');
}

function formatTrades(trades) {
  if (!trades.length) return '暂无实际交易记录';
  return trades.slice(0, 20).map(t => `- [${t.executed_at || '-'}] ${t.asset_name || ''} ${t.type === 'buy' ? '买入' : '卖出'} ${t.quantity ?? '-'} @ ${t.price ?? '-'}，金额 ${t.total ?? '-'}，P&L ${t.pnl ?? '-'}，原因：${t.reason || '无'}`).join('\n');
}

function formatPrices(prices) {
  if (!prices.length) return '暂无最新价格';
  return prices.map(p => `${p.asset_name || p.symbol || `资产#${p.asset_id}`}: ${p.currency === 'USD' ? '$' : '¥'}${Number(p.price).toFixed(2)} (${p.fetched_at || '-'})`).join('；');
}

function formatHoldings(holdings, latestPriceMap) {
  if (!holdings.length) return '暂无持仓';
  return holdings.map(h => {
    const latestPrice = latestPriceMap.get(h.asset_id)?.price;
    const marketValue = Number.isFinite(latestPrice) ? latestPrice * Number(h.quantity || 0) : null;
    const unrealized = Number.isFinite(marketValue) ? marketValue - Number(h.total_invested || 0) : null;
    return `${h.asset_name}: 持仓 ${h.quantity || 0}，成本 ${h.avg_cost || 0}，总投入 ${h.total_invested || 0}` +
      `${Number.isFinite(latestPrice) ? `，现价 ${latestPrice.toFixed(2)}` : ''}` +
      `${Number.isFinite(unrealized) ? `，浮盈亏 ${unrealized.toFixed(2)}` : ''}`;
  }).join('；');
}

function buildFallbackReview(strategy, plans, trades, holdings, latestPrices) {
  const executed = plans.filter(p => p.status === 'executed').length;
  const triggered = plans.filter(p => p.status === 'triggered').length;
  const pending = plans.filter(p => p.status === 'pending').length;
  const totalPlans = plans.length || 1;
  const realizedPnl = trades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  const executionRate = ((executed + triggered) / totalPlans) * 100;
  const scoreBase = 5 + (executionRate >= 50 ? 1 : 0) + (realizedPnl > 0 ? 2 : realizedPnl < 0 ? -1 : 0);
  const recommendations = [];

  if (!plans.length) recommendations.push('先生成并维护清晰的操盘计划，再进行复盘对照。');
  if (pending > executed) recommendations.push('待执行计划较多，建议复核触发条件是否过于保守或与当前行情脱节。');
  if (!trades.length) recommendations.push('当前缺少实际成交记录，建议执行后补充交易复盘以提高分析准确性。');
  if (realizedPnl < 0) recommendations.push('近期已实现盈亏为负，建议收紧仓位与止损纪律。');
  if (!recommendations.length) recommendations.push('继续跟踪计划执行偏差，并在关键价位附近更新阈值。');

  const latestPriceMap = new Map(latestPrices.map(item => [item.asset_id, item]));
  const priceSummary = formatPrices(latestPrices);
  return {
    summary: `策略「${strategy.name}」当前执行率约 ${executionRate.toFixed(0)}%，已实现盈亏 ${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(2)}。`,
    performance_score: clampScore(scoreBase),
    deviation_analysis: {
      planned_vs_actual: {
        total_plans: plans.length,
        executed_plans: executed,
        triggered_plans: triggered,
        pending_plans: pending,
        actual_trade_count: trades.length,
      },
      key_observations: [
        plans.length ? `计划执行率 ${executionRate.toFixed(1)}%` : '尚未建立计划基线',
        trades.length ? `累计已实现盈亏 ${realizedPnl.toFixed(2)}` : '暂无可对照的实际交易数据',
      ],
    },
    recommendations,
    market_context: `基于系统最新价格，${priceSummary}。当前持仓概览：${formatHoldings(holdings, latestPriceMap)}。`,
  };
}

function normalizeSavedReview(row) {
  if (!row) return null;
  return {
    ...row,
    performance_score: row.performance_score == null ? null : Number(row.performance_score),
    deviation_analysis: safeParse(row.deviation_analysis, row.deviation_analysis || null),
    recommendations: safeParse(row.recommendations, []),
  };
}

export async function generateStrategyReview(strategyId) {
  const db = getDb();
  const strategy = db.prepare(`SELECT s.*, a.name AS asset_name, a.symbol, a.icon
    FROM strategies s
    LEFT JOIN assets a ON s.asset_id = a.id
    WHERE s.id = ?`).get(strategyId);

  if (!strategy) throw new Error('策略不存在');

  const assetIds = strategyAssetIds(strategy);
  const placeholders = assetIds.map(() => '?').join(',');
  const parsedParameters = safeParse(strategy.parameters, {});
  const plans = db.prepare(`SELECT tp.*, a.name AS asset_name, a.symbol
    FROM trading_plans tp
    LEFT JOIN assets a ON tp.asset_id = a.id
    WHERE tp.strategy_id = ?
    ORDER BY tp.seq ASC, tp.id ASC`).all(strategyId);

  const trades = assetIds.length
    ? db.prepare(`SELECT th.*, a.name AS asset_name, a.symbol
      FROM trade_history th
      LEFT JOIN assets a ON th.asset_id = a.id
      WHERE th.asset_id IN (${placeholders})
      ORDER BY th.executed_at DESC, th.id DESC
      LIMIT 50`).all(...assetIds)
    : [];

  const holdings = assetIds.length
    ? db.prepare(`SELECT h.*, a.name AS asset_name, a.symbol
      FROM holdings h
      LEFT JOIN assets a ON h.asset_id = a.id
      WHERE h.status = 'active' AND h.asset_id IN (${placeholders})`).all(...assetIds)
    : [];

  const latestPrices = assetIds.length
    ? db.prepare(`SELECT pc.asset_id, pc.price, pc.currency, pc.fetched_at, a.name AS asset_name, a.symbol
      FROM price_cache pc
      JOIN (
        SELECT asset_id, MAX(fetched_at) AS max_ts
        FROM price_cache
        WHERE asset_id IN (${placeholders})
        GROUP BY asset_id
      ) latest ON latest.asset_id = pc.asset_id AND latest.max_ts = pc.fetched_at
      LEFT JOIN assets a ON pc.asset_id = a.id`).all(...assetIds)
    : [];

  const latestPriceMap = new Map(latestPrices.map(item => [item.asset_id, item]));
  const realizedPnl = trades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  const holdingSummary = formatHoldings(holdings, latestPriceMap);
  const prompt = `你是一个投资策略复盘分析师。请评估以下策略的执行情况。\n\n策略：${strategy.name} (${strategy.type})\n参数：${JSON.stringify(parsedParameters, null, 2)}\n\n操盘计划状态：\n${formatPlans(plans)}\n\n实际交易记录：\n${formatTrades(trades)}\n\n当前价格：${formatPrices(latestPrices)}\n当前持仓：${holdingSummary}\n已实现盈亏：${realizedPnl.toFixed(2)}\n\n请给出：\n1. performance_score (1-10分)\n2. deviation_analysis: 计划与实际的偏差分析\n3. recommendations: 具体调整建议（数组）\n4. market_context: 当前市场环境对策略的影响\n5. summary: 一句话总结\n\n返回严格 JSON 格式，不要包含 markdown 代码块。\nresponse_format: {\"type\":\"json_object\"}`;

  const fallback = buildFallbackReview(strategy, plans, trades, holdings, latestPrices);
  const config = getAgentConfig(db);
  let result = fallback;

  if (config.apiUrl && config.apiKey) {
    try {
      const response = await callLLM(config.apiUrl, config.apiKey, config.analysisModel || config.model, [
        { role: 'system', content: '你是一位专业的投资策略复盘分析师。只输出严格 JSON，字段必须完整、客观、可执行。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.2, maxTokens: 1800, timeout: 60000, retries: 1 });
      const content = response?.choices?.[0]?.message?.content;
      const parsed = content ? extractJSON(content) : null;
      if (parsed) {
        result = {
          summary: parsed.summary || fallback.summary,
          performance_score: clampScore(parsed.performance_score, fallback.performance_score),
          deviation_analysis: normalizeDeviation(parsed.deviation_analysis, fallback.deviation_analysis),
          recommendations: normalizeRecommendations(parsed.recommendations, fallback.recommendations),
          market_context: parsed.market_context || fallback.market_context,
        };
      } else {
        log.warn('AI review parse failed, using fallback', { strategyId, preview: content?.slice?.(0, 200) || response?.error?.message || '' });
      }
    } catch (error) {
      log.warn('AI review failed, using fallback', { strategyId, error: error.message });
    }
  }

  const info = db.prepare(`INSERT INTO strategy_reviews (strategy_id, review_type, summary, performance_score, deviation_analysis, recommendations, market_context)
    VALUES (?, 'periodic', ?, ?, ?, ?, ?)`)
    .run(
      strategyId,
      result.summary,
      result.performance_score,
      JSON.stringify(result.deviation_analysis || {}),
      JSON.stringify(result.recommendations || []),
      result.market_context || ''
    );

  const saved = db.prepare('SELECT * FROM strategy_reviews WHERE id = ?').get(info.lastInsertRowid);
  return normalizeSavedReview(saved);
}
