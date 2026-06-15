import { getDb } from '../db/database.js';
import { getAgentConfig, callLLM } from './strategy-agent.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('market-signal');

function isValidFutureTime(value) {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime()) && d.getTime() > Date.now();
}

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

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function stddev(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (nums.length < 2) return null;
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function round(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number(num.toFixed(digits));
}

function movingAverage(prices, period) {
  if (prices.length < period) return null;
  return round(mean(prices.slice(-period)));
}

function changePct(history, days) {
  if (!history.length) return null;
  const latest = Number(history[history.length - 1].price);
  const latestTime = new Date(history[history.length - 1].fetched_at || Date.now()).getTime();
  const threshold = latestTime - days * 24 * 60 * 60 * 1000;
  const older = [...history].reverse().find(item => new Date(item.fetched_at || 0).getTime() <= threshold) || history[Math.max(0, history.length - (days + 1))];
  const base = Number(older?.price);
  if (!Number.isFinite(latest) || !Number.isFinite(base) || base === 0) return null;
  return round(((latest - base) / base) * 100);
}

function rsi(prices, period = 14) {
  if (prices.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = Number(prices[i]) - Number(prices[i - 1]);
    if (!Number.isFinite(change)) continue;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - (100 / (1 + rs)));
}

function supportResistance(prices, window = 20) {
  const sample = prices.slice(-window).map(Number).filter(Number.isFinite);
  if (!sample.length) return { support: null, resistance: null };
  return {
    support: round(Math.min(...sample)),
    resistance: round(Math.max(...sample)),
  };
}

function buildIndicators(history) {
  const prices = history.map(item => Number(item.price)).filter(Number.isFinite);
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (!prev) continue;
    returns.push(((prices[i] - prev) / prev) * 100);
  }
  const levels = supportResistance(prices);
  return {
    latest_price: round(prices[prices.length - 1]),
    ma5: movingAverage(prices, 5),
    ma20: movingAverage(prices, 20),
    change_1d_pct: changePct(history, 1),
    change_7d_pct: changePct(history, 7),
    change_30d_pct: changePct(history, 30),
    volatility_pct: round(stddev(returns)),
    rsi14: rsi(prices, 14),
    support: levels.support,
    resistance: levels.resistance,
    data_points: history.length,
  };
}

function clampStrength(value, fallback = 5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(10, Math.round(num)));
}

function fallbackSignal(asset, indicators) {
  const latest = Number(indicators.latest_price);
  const ma5 = Number(indicators.ma5);
  const ma20 = Number(indicators.ma20);
  const rsi14 = Number(indicators.rsi14);
  const ch7 = Number(indicators.change_7d_pct);
  let signalType = 'neutral';
  let strength = 5;
  let insight = '指标不足，建议继续观察。';

  const maBullish = Number.isFinite(ma5) && Number.isFinite(ma20) && ma5 > ma20;
  const maBearish = Number.isFinite(ma5) && Number.isFinite(ma20) && ma5 < ma20;
  const priceMomentum = Number.isFinite(ch7) ? ch7 : 0;

  if (maBullish && priceMomentum >= 0 && (!Number.isFinite(rsi14) || rsi14 < 70)) {
    signalType = 'bullish';
    strength = clampStrength(5 + Math.abs(priceMomentum) / 3 + (ma20 ? ((ma5 - ma20) / ma20) * 100 : 0));
    insight = '短期均线位于长期均线上方，价格动能偏强。';
  } else if (maBearish && priceMomentum <= 0 && (!Number.isFinite(rsi14) || rsi14 > 30)) {
    signalType = 'bearish';
    strength = clampStrength(5 + Math.abs(priceMomentum) / 3 + (ma20 ? ((ma20 - ma5) / ma20) * 100 : 0));
    insight = '短期均线弱于长期均线，价格动能偏弱。';
  } else if (Number.isFinite(rsi14) && rsi14 >= 70) {
    signalType = 'bearish';
    strength = clampStrength(6 + (rsi14 - 70) / 5);
    insight = 'RSI 偏高，短线有过热风险。';
  } else if (Number.isFinite(rsi14) && rsi14 <= 30) {
    signalType = 'bullish';
    strength = clampStrength(6 + (30 - rsi14) / 5);
    insight = 'RSI 偏低，价格可能接近超卖区。';
  }

  return {
    signal_type: signalType,
    strength,
    summary: `${asset.name} 当前最新价 ${latest || '-'}，${insight}`,
    ai_analysis: `技术指标自动分析：MA5=${indicators.ma5 ?? '-'}，MA20=${indicators.ma20 ?? '-'}，RSI14=${indicators.rsi14 ?? '-'}，7日涨跌=${indicators.change_7d_pct ?? '-'}%。${insight}`,
    valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function normalizeSavedSignal(row) {
  if (!row) return null;
  return {
    ...row,
    strength: Number(row.strength),
    indicators: typeof row.indicators === 'string' ? (() => { try { return JSON.parse(row.indicators); } catch { return row.indicators; } })() : row.indicators,
  };
}

export async function analyzeMarketSignals(assetId) {
  const db = getDb();
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
  if (!asset) throw new Error('资产不存在');

  const history = db.prepare(`SELECT price, currency, fetched_at FROM (
    SELECT price, currency, fetched_at
    FROM price_cache
    WHERE asset_id = ?
    ORDER BY fetched_at DESC
    LIMIT 120
  ) ORDER BY fetched_at ASC`).all(assetId);

  const indicators = buildIndicators(history);
  const fallback = fallbackSignal(asset, indicators);
  let signal = fallback;

  if (history.length >= 5) {
    const config = getAgentConfig(db);
    if (config.apiUrl && config.apiKey) {
      const historySummary = {
        latest: indicators.latest_price,
        highs_lows: { support: indicators.support, resistance: indicators.resistance },
        changes: {
          day_1: indicators.change_1d_pct,
          day_7: indicators.change_7d_pct,
          day_30: indicators.change_30d_pct,
        },
        moving_averages: { ma5: indicators.ma5, ma20: indicators.ma20 },
        volatility_pct: indicators.volatility_pct,
        rsi14: indicators.rsi14,
      };
      const prompt = `你是一个市场信号分析师。请基于以下资产行情与技术指标，输出严格 JSON。\n\n资产：${asset.name} (${asset.symbol})\n技术指标：${JSON.stringify(historySummary, null, 2)}\n最近价格样本：${history.slice(-10).map(item => `${item.fetched_at}:${item.price}`).join(' | ')}\n\n请返回：\n1. signal_type: bullish / bearish / neutral\n2. strength: 1-10\n3. summary: 一句话总结\n4. ai_analysis: 可执行的判断和提示\n5. valid_until: ISO 时间字符串\n\n返回严格 JSON，不要 markdown 代码块。\nresponse_format: {\"type\":\"json_object\"}`;
      try {
        const response = await callLLM(config.apiUrl, config.apiKey, config.analysisModel || config.model, [
          { role: 'system', content: '你是一位专业市场分析师，只输出严格 JSON。' },
          { role: 'user', content: prompt },
        ], { temperature: 0.2, maxTokens: 1200, timeout: 45000, retries: 1 });
        const content = response?.choices?.[0]?.message?.content;
        const parsed = content ? extractJSON(content) : null;
        if (parsed) {
          signal = {
            signal_type: ['bullish', 'bearish', 'neutral'].includes(parsed.signal_type) ? parsed.signal_type : fallback.signal_type,
            strength: clampStrength(parsed.strength, fallback.strength),
            summary: parsed.summary || fallback.summary,
            ai_analysis: parsed.ai_analysis || fallback.ai_analysis,
            valid_until: isValidFutureTime(parsed.valid_until) ? parsed.valid_until : fallback.valid_until,
          };
        } else {
          log.warn('Market signal parse failed, using fallback', { assetId, preview: content?.slice?.(0, 200) || response?.error?.message || '' });
        }
      } catch (error) {
        log.warn('Market signal AI failed, using fallback', { assetId, error: error.message });
      }
    }
  }

  const info = db.prepare(`INSERT INTO market_signals (asset_id, signal_type, strength, summary, indicators, ai_analysis, valid_until)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(
      assetId,
      signal.signal_type || 'neutral',
      signal.strength ?? 5,
      signal.summary || '',
      JSON.stringify(indicators || null),
      signal.ai_analysis || '',
      signal.valid_until || null
    );

  const saved = db.prepare(`SELECT ms.*, a.name AS asset_name, a.symbol, a.icon, a.type, a.currency
    FROM market_signals ms
    LEFT JOIN assets a ON ms.asset_id = a.id
    WHERE ms.id = ?`).get(info.lastInsertRowid);
  return normalizeSavedSignal(saved);
}

export async function analyzeAllAssets() {
  const db = getDb();
  const assets = db.prepare('SELECT id FROM assets ORDER BY id ASC').all();
  const signals = [];
  for (const asset of assets) {
    try {
      signals.push(await analyzeMarketSignals(asset.id));
    } catch (error) {
      log.warn('Analyze asset failed', { assetId: asset.id, error: error.message });
    }
  }
  return signals;
}
