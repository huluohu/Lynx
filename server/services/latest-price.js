export function getLatestPriceRows(db, assetIds = []) {
  const filters = [];
  const params = [];

  if (assetIds.length) {
    const placeholders = assetIds.map(() => '?').join(',');
    filters.push(`pc.asset_id IN (${placeholders})`);
    params.push(...assetIds);
  }

  const conditions = [...filters];
  const whereClause = conditions.length ? `WHERE ${conditions.join('\n    AND ')}` : '';

  return db.prepare(`
    SELECT ranked.asset_id, ranked.price, ranked.currency, ranked.source, ranked.fetched_at,
      a.name AS asset_name, a.symbol, a.type, a.subtype, a.unit, a.quote_currency
    FROM (
      SELECT pc.*,
        ROW_NUMBER() OVER (PARTITION BY pc.asset_id ORDER BY pc.fetched_at DESC, pc.id DESC) AS rn
      FROM price_cache pc
      ${whereClause}
    ) ranked
    LEFT JOIN assets a ON a.id = ranked.asset_id
    WHERE ranked.rn = 1
  `).all(...params);
}

export function getLatestPriceMap(db, assetIds = []) {
  const rows = getLatestPriceRows(db, assetIds);
  return new Map(rows.map((row) => [row.asset_id, row]));
}
