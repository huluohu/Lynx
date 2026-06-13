import http from 'http';
import https from 'https';

const USD_CNY = 6.77;

export function httpGet(url, opts = {}) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const reqOpts = {
      headers: { 'Accept': 'application/json', 'User-Agent': 'InvestTracker/1.0', ...opts.headers }
    };
    const req = lib.get(url, reqOpts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(opts.timeout || 8000, () => { req.destroy(); resolve(null); });
  });
}

export function httpPost(hostname, port, pathname, body, headers = {}) {
  return new Promise((resolve) => {
    const opts = { hostname, port, path: pathname, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ===== 金价查询 =====
export async function fetchGold(assetId, symbol) {
  const port = process.env.AUTH_GATEWAY_PORT || 19000;
  const body = JSON.stringify({
    sub_channel: 'qclaw',
    query: `${symbol} 黄金价格`,
    request_id: String(Date.now()),
    data_type: 'api'
  });

  const data = await httpPost('localhost', port, '/proxy/api', body, {
    'Remote-URL': 'https://jprx.m.qq.com/aizone/skillserver/v1/proxy/teamrouter_neodata/query',
  });

  const apiData = data?.data?.apiData?.apiRecall || [];

  // AU9999 和 XAUUSD (伦敦金)
  for (const item of apiData) {
    for (const d of item.data || []) {
      if (assetId === 1 && d.symbol?.includes('AU9999')) return parseFloat(d.new);
      if (assetId === 2 && d.symbol?.includes('AUUSDO')) return parseFloat(d.new);
    }
  }
  return null;
}

// ===== BTC 查询 =====
export async function fetchBTC() {
  const body = await httpGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_7d_change=true');
  const b = body?.bitcoin;
  if (!b) return null;
  return {
    usd: b.usd,
    cny: Math.round(b.usd * USD_CNY),
    ch24: b.usd_24h_change || 0,
    ch7d: b.usd_7d_change || 0,
  };
}

// ===== 根据 asset 类型调度 =====
export async function fetchPrice(asset) {
  try {
    if (asset.type === 'gold') {
      const price = await fetchGold(asset.id, asset.symbol);
      return price ? { price, currency: 'CNY', source: 'neodata' } : null;
    }
    if (asset.type === 'crypto') {
      const data = await fetchBTC();
      if (!data) return null;
      return { price: data.usd, currency: 'USD', source: 'coingecko', details: data };
    }
    return null;
  } catch {
    return null;
  }
}
