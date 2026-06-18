export function getLatestPriceRows(db, assetIds = []) {
  const filters = [];
  const params = [];

  if (assetIds.length) {
    const placeholders = assetIds.map(() => '?').join(',');
    filters.push(`pc.asset_id IN (${placeholders})`);
    params.push(...assetIds);
  }

  const conditions = [...filters, `NOT EXISTS (
      SELECT 1
      FROM price_cache newer
      WHERE newer.asset_id = pc.asset_id
        AND (
          newer.fetched_at > pc.fetched_at
          OR (newer.fetched_at = pc.fetched_at AND newer.id > pc.id)
        )
    )`];
  const whereClause = `WHERE ${conditions.join('\n    AND ')}`;

  return db.prepare(`
    SELECT pc.asset_id, pc.price, pc.currency, pc.source, pc.fetched_at,
      a.name AS asset_name, a.symbol, a.type, a.subtype, a.unit, a.quote_currency
    FROM price_cache pc
    LEFT JOIN assets a ON a.id = pc.asset_id
    ${whereClause}
  `).all(...params);
}

export function getLatestPriceMap(db, assetIds = []) {
  const rows = getLatestPriceRows(db, assetIds);
  return new Map(rows.map((row) => [row.asset_id, row]));
}
