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
    ORDER BY fetched_at ASC, id ASC
  `).all(assetId, startSql);
  const baseline = db.prepare(`
    SELECT asset_id, price, currency, source, fetched_at
    FROM price_cache
    WHERE asset_id = ? AND fetched_at < ?
    ORDER BY fetched_at DESC, id DESC
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

function getAssetTradeRows(db, assetId, endMs) {
  return db.prepare(`
    SELECT id, type, quantity, price, total, COALESCE(fee, 0) AS fee, executed_at
    FROM trade_history
    WHERE asset_id = ?
      AND COALESCE(reverted, 0) = 0
      AND type IN ('buy', 'sell')
      AND executed_at IS NOT NULL
      AND executed_at <= ?
    ORDER BY executed_at ASC, id ASC
  `).all(assetId, toSqlDate(endMs));
}

function reconcileCostPointsToHolding(points, holding) {
  if (!points.length || !holding) return points;
  const currentQuantity = Number(holding.quantity || 0);
  const currentInvested = Number(holding.total_invested || 0);
  if (!Number.isFinite(currentQuantity) || !Number.isFinite(currentInvested)) return points;

  const last = points[points.length - 1];
  const quantityDelta = currentQuantity - Number(last.quantity || 0);
  const investedDelta = currentInvested - Number(last.invested || 0);
  const isAligned = Math.abs(quantityDelta) < 1e-8 && Math.abs(investedDelta) < 0.01;
  if (isAligned) return points;

  const adjustedAt = parseSqlDate(holding.updated_at) || parseSqlDate(last.t) || Date.now();
  let applied = false;
  const reconciled = points.map((point) => {
    const pointTime = parseSqlDate(point.t);
    if (pointTime == null || pointTime < adjustedAt) return point;
    applied = true;
    const quantity = Math.max(0, Number(point.quantity || 0) + quantityDelta);
    const invested = Math.max(0, Number(point.invested || 0) + investedDelta);
    return {
      ...point,
      quantity,
      invested,
      avg_cost: quantity > 0 ? invested / quantity : 0,
      estimated: true,
    };
  });

  if (!applied) {
    reconciled[reconciled.length - 1] = {
      ...last,
      quantity: currentQuantity,
      invested: currentInvested,
      avg_cost: currentQuantity > 0 ? currentInvested / currentQuantity : 0,
      estimated: true,
    };
  }

  return reconciled;
}

function buildHoldingCostPoints(trades, timeline, fallbackHolding = null) {
  if (!trades.length && fallbackHolding) {
    const quantity = Number(fallbackHolding.quantity || 0);
    const invested = Number(fallbackHolding.total_invested || 0);
    const avgCost = quantity > 0 ? invested / quantity : Number(fallbackHolding.avg_cost || 0);
    return timeline.map(ts => ({ t: new Date(ts).toISOString(), quantity, invested, avg_cost: avgCost, estimated: true }));
  }

  const points = [];
  let idx = 0;
  let quantity = 0;
  let invested = 0;
  let avgCost = 0;

  for (const ts of timeline) {
    while (idx < trades.length) {
      const tradeTime = parseSqlDate(trades[idx].executed_at);
      if (tradeTime == null || tradeTime > ts) break;

      const trade = trades[idx];
      const tradeQty = Math.max(0, Number(trade.quantity || 0));
      const tradePrice = Number(trade.price || 0);
      const tradeTotal = Number(trade.total || 0);
      const tradeFee = Number(trade.fee || 0);

      if (trade.type === 'buy' && tradeQty > 0) {
        const grossAmount = Number.isFinite(tradeTotal) && tradeTotal > 0 ? tradeTotal : tradeQty * tradePrice;
        const amount = grossAmount + (Number.isFinite(tradeFee) && tradeFee > 0 ? tradeFee : 0);
        quantity += tradeQty;
        invested += Number.isFinite(amount) ? amount : 0;
        avgCost = quantity > 0 ? invested / quantity : 0;
      } else if (trade.type === 'sell' && tradeQty > 0) {
        const sellQty = Math.min(tradeQty, quantity);
        quantity = Math.max(0, quantity - sellQty);
        invested = quantity > 0 ? quantity * avgCost : 0;
        avgCost = quantity > 0 ? avgCost : 0;
      }

      idx++;
    }

    points.push({
      t: new Date(ts).toISOString(),
      quantity,
      invested,
      avg_cost: avgCost,
      estimated: false,
    });
  }

  return reconcileCostPointsToHolding(points, fallbackHolding);
}

function currentHoldingCostPoint(holding) {
  const quantity = Number(holding?.quantity || 0);
  const invested = Number(holding?.total_invested || 0);
  return {
    quantity,
    invested,
    avg_cost: quantity > 0 ? invested / quantity : Number(holding?.avg_cost || 0),
    estimated: false,
  };
}

function costPointDiffers(a, b) {
  if (!a || !b) return true;
  return Math.abs(Number(a.quantity || 0) - Number(b.quantity || 0)) >= 1e-8
    || Math.abs(Number(a.invested || 0) - Number(b.invested || 0)) >= 0.01;
}

function buildCostPointResolver(costPoints) {
  let index = 0;
  return (timeValue) => {
    if (!costPoints.length) return { quantity: 0, invested: 0, avg_cost: 0, estimated: true };
    const time = parseSqlDate(timeValue);
    if (time == null) return costPoints[costPoints.length - 1];

    while (index + 1 < costPoints.length) {
      const nextTime = parseSqlDate(costPoints[index + 1].t);
      if (nextTime == null || nextTime > time) break;
      index++;
    }

    return costPoints[index] || costPoints[costPoints.length - 1];
  };
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

  const currentCost = currentHoldingCostPoint(holding);
  const fallbackPrice = Number(holding.avg_cost || currentCost.avg_cost || 0);
  const rows = getPriceRows(db, asset.id, startMs);
  const pricePoints = buildSteppedPricePoints(rows, timeline, fallbackPrice, asset.currency || 'CNY');
  const costPoints = buildHoldingCostPoints(getAssetTradeRows(db, asset.id, endMs), timeline, holding);
  const lastCostPoint = costPoints[costPoints.length - 1];
  const closingCost = { ...currentCost, estimated: !!lastCostPoint?.estimated || costPointDiffers(currentCost, lastCostPoint) };
  const resolveCostPoint = buildCostPointResolver(costPoints);
  const points = pricePoints.map((point, index) => {
    const isLastPoint = index === pricePoints.length - 1;
    const costPoint = isLastPoint ? closingCost : resolveCostPoint(point.t);
    const quantity = Number(costPoint.quantity || 0);
    const invested = Number(costPoint.invested || 0);
    const marketValue = quantity * point.price;
    const value = marketValue - invested;
    return {
      t: point.t,
      value,
      market_value: marketValue,
      invested,
      quantity,
      avg_cost: costPoint.avg_cost,
      price: point.price,
      currency: point.currency,
      estimated: point.estimated || costPoint.estimated,
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


