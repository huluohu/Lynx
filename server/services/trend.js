import { getLatestPriceRows } from './latest-price.js';

const RANGE_CONFIG = {
  '1d': { days: 1, bucketMs: 30 * 60 * 1000 },
  '1w': { days: 7, bucketMs: 4 * 60 * 60 * 1000 },
  '1m': { days: 30, bucketMs: 24 * 60 * 60 * 1000 },
  '6m': { days: 183, bucketMs: 3 * 24 * 60 * 60 * 1000 },
  '1y': { days: 365, bucketMs: 7 * 24 * 60 * 60 * 1000 },
};

export function normalizeTrendRange(range) {
  return RANGE_CONFIG[range] ? range : '1m';
}

function toSqlDate(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function parseSqlDate(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T') + 'Z';
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : null;
}

function convertToCny(value, currency, usdCny) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  const code = String(currency || 'CNY').toUpperCase();
  if (code === 'USD' || code === 'USDT') return amount * usdCny;
  return amount;
}

function buildTimeline(range) {
  const key = normalizeTrendRange(range);
  const config = RANGE_CONFIG[key];
  const endMs = Date.now();
  const startMs = endMs - config.days * 24 * 60 * 60 * 1000;
  const timeline = [];
  for (let ts = startMs; ts < endMs; ts += config.bucketMs) timeline.push(ts);
  if (timeline[timeline.length - 1] !== endMs) timeline.push(endMs);
  return { range: key, config, startMs, endMs, timeline };
}

function getPriceRows(db, assetId, startMs) {
  const startSql = toSqlDate(startMs);
  const rows = db.prepare(`
    SELECT asset_id, price, currency, source, fetched_at
    FROM price_cache
    WHERE asset_id = ? AND fetched_at >= ?
    ORDER BY datetime(fetched_at) ASC, id ASC
  `).all(assetId, startSql);
  const baseline = db.prepare(`
    SELECT asset_id, price, currency, source, fetched_at
    FROM price_cache
    WHERE asset_id = ? AND fetched_at < ?
    ORDER BY datetime(fetched_at) DESC, id DESC
    LIMIT 1
  `).get(assetId, startSql);
  return (baseline ? [baseline, ...rows] : rows)
    .sort((a, b) => (parseSqlDate(a.fetched_at) || 0) - (parseSqlDate(b.fetched_at) || 0));
}

function buildSteppedPricePoints(rows, timeline, fallbackPrice = null, fallbackCurrency = 'CNY') {
  const points = [];
  let idx = 0;
  let current = null;

  for (const ts of timeline) {
    while (idx < rows.length) {
      const rowTime = parseSqlDate(rows[idx].fetched_at);
      if (rowTime == null || rowTime > ts) break;
      current = rows[idx];
      idx++;
    }

    const price = Number(current?.price ?? fallbackPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    points.push({
      t: new Date(ts).toISOString(),
      price,
      currency: current?.currency || fallbackCurrency,
      source: current?.source || null,
      estimated: !current,
    });
  }

  return points;
}

function summarizePoints(points, valueKey = 'value') {
  if (!points.length) {
    return { first: null, last: null, change: null, change_pct: null, min: null, max: null };
  }
  const values = points.map(p => Number(p[valueKey])).filter(Number.isFinite);
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  return {
    first,
    last,
    change,
    change_pct: first ? (change / Math.abs(first)) * 100 : null,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function buildAssetPriceTrend(db, assetId, range = '1m') {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
  if (!asset) return null;

  const { range: normalizedRange, startMs, endMs, timeline } = buildTimeline(range);
  const rows = getPriceRows(db, asset.id, startMs);
  const points = buildSteppedPricePoints(rows, timeline, null, asset.currency || 'CNY')
    .map(point => ({ ...point, value: point.price }));

  return {
    asset: { id: asset.id, name: asset.name, symbol: asset.symbol, type: asset.type, icon: asset.icon, currency: asset.currency },
    range: normalizedRange,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    currency: points[points.length - 1]?.currency || asset.currency || 'CNY',
    points,
    summary: summarizePoints(points),
  };
}

export function buildAssetProfitTrend(db, assetId, range = '1m') {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
  if (!asset) return null;

  const holding = db.prepare("SELECT * FROM holdings WHERE asset_id = ? AND status = 'active'").get(assetId);
  const { range: normalizedRange, startMs, endMs, timeline } = buildTimeline(range);
  if (!holding) {
    return {
      asset: { id: asset.id, name: asset.name, symbol: asset.symbol, type: asset.type, icon: asset.icon, currency: asset.currency },
      range: normalizedRange,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      currency: asset.currency || 'CNY',
      points: [],
      summary: summarizePoints([]),
    };
  }

  const rows = getPriceRows(db, asset.id, startMs);
  const pricePoints = buildSteppedPricePoints(rows, timeline, holding.avg_cost, asset.currency || 'CNY');
  const quantity = Number(holding.quantity || 0);
  const invested = Number(holding.total_invested || 0);
  const points = pricePoints.map(point => {
    const marketValue = quantity * point.price;
    const value = marketValue - invested;
    return {
      t: point.t,
      value,
      market_value: marketValue,
      invested,
      price: point.price,
      currency: point.currency,
      estimated: point.estimated,
    };
  });

  return {
    asset: { id: asset.id, name: asset.name, symbol: asset.symbol, type: asset.type, icon: asset.icon, currency: asset.currency },
    range: normalizedRange,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    currency: asset.currency || 'CNY',
    points,
    summary: summarizePoints(points),
  };
}

export function buildPortfolioProfitTrend(db, range = '1m', usdCny = 7.25) {
  const holdings = db.prepare(`SELECT h.*, a.name, a.symbol, a.type, a.icon, a.currency
    FROM holdings h JOIN assets a ON h.asset_id = a.id WHERE h.status = 'active'`).all();
  const { range: normalizedRange, startMs, endMs, timeline } = buildTimeline(range);

  if (!holdings.length) {
    return {
      range: normalizedRange,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      currency: 'CNY',
      points: [],
      summary: summarizePoints([]),
    };
  }

  const latestRows = new Map(getLatestPriceRows(db, holdings.map(h => h.asset_id)).map(row => [row.asset_id, row]));
  const prepared = holdings.map(holding => {
    const latest = latestRows.get(holding.asset_id);
    const fallbackPrice = Number(latest?.price || holding.avg_cost || 0);
    return {
      holding,
      points: buildSteppedPricePoints(
        getPriceRows(db, holding.asset_id, startMs),
        timeline,
        fallbackPrice,
        latest?.currency || holding.currency || 'CNY',
      ),
    };
  });

  const points = timeline.map((ts, index) => {
    let marketValue = 0;
    let invested = 0;
    let estimated = false;

    for (const item of prepared) {
      const holding = item.holding;
      const pricePoint = item.points[index] || item.points[item.points.length - 1];
      const price = Number(pricePoint?.price || holding.avg_cost || 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      const quantity = Number(holding.quantity || 0);
      const assetMarketValue = quantity * price;
      const assetInvested = Number(holding.total_invested || 0);
      const currency = pricePoint?.currency || holding.currency || 'CNY';
      marketValue += convertToCny(assetMarketValue, currency, usdCny);
      invested += convertToCny(assetInvested, holding.currency || currency, usdCny);
      estimated = estimated || !!pricePoint?.estimated;
    }

    const value = marketValue - invested;
    return {
      t: new Date(ts).toISOString(),
      value,
      market_value: marketValue,
      invested,
      currency: 'CNY',
      estimated,
    };
  });

  return {
    range: normalizedRange,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    currency: 'CNY',
    points,
    summary: summarizePoints(points),
  };
}


