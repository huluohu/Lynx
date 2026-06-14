/**
 * AI 策略生成服务
 * 调用 LLM API，根据持仓数据生成策略参数和操盘计划
 */
import http from 'http';
import https from 'https';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ai');

// 从 settings 或环境变量获取配置
function getAIConfig(db) {
  const settings = {};
  try {
    const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'ai_%'").all();
    for (const r of rows) settings[r.key] = r.value;
  } catch {}

  return {
    apiUrl: settings.ai_api_url || process.env.AI_API_URL || '',
    apiKey: settings.ai_api_key || process.env.AI_API_KEY || '',
    model: settings.ai_model || process.env.AI_MODEL || 'gpt-4o-mini',
  };
}

/**
 * 构建 Prompt（支持多资产组合）
 */
function buildPrompt(context) {
  const { assets: assetList, budget, goal, riskLevel } = context;

  const assetsInfo = assetList.map(a => {
    const holdingInfo = a.holding
      ? `持仓数量: ${a.holding.quantity}, 成本价: ${a.holding.avg_cost}, 总投入: ${a.holding.total_invested}, 当前市价: ${a.currentPrice || '未知'}, 浮动盈亏: ${a.currentPrice ? ((a.currentPrice - a.holding.avg_cost) / a.holding.avg_cost * 100).toFixed(2) + '%' : '未知'}`
      : '暂无持仓';

    const tradesInfo = a.recentTrades.length
      ? a.recentTrades.map(t => `${t.executed_at?.slice(0,10)} ${t.type} ${t.quantity}@${t.price}`).join('\n')
      : '暂无交易记录';

    return `### ${a.asset.name} (${a.asset.symbol})
- 类型: ${a.asset.type}, 币种: ${a.asset.currency}
- 持仓: ${holdingInfo}
- 近期交易:\n${tradesInfo}`;
  }).join('\n\n');

  const goalMap = { recovery: '扭亏为盈，降低成本', growth: '稳定增长，定期加仓', balanced: '平衡风险，网格交易' };
  const riskMap = { low: '保守（小仓位、宽间距）', medium: '适中', high: '激进（大仓位、密间距）' };
  const isMulti = assetList.length > 1;

  return `你是一位专业的量化交易策略师。请根据以下${isMulti ? '投资组合' : '持仓'}情况，生成一个完整的交易策略和操盘计划。

## 资产信息（共 ${assetList.length} 个）
${assetsInfo}

## 用户需求
- 目标: ${goalMap[goal] || goal}
- 可用预算: ¥${budget}
- 风险偏好: ${riskMap[riskLevel] || riskLevel}
${isMulti ? '- 组合要求: 请综合考虑各资产的相关性和风险分散，合理分配预算' : ''}

## 输出要求
请返回严格的 JSON 格式（不要包含 markdown 代码块标记），结构如下:
{
  "strategy": {
    "name": "策略名称（简短有力）",
    "type": "${goal === 'recovery' ? 'recovery' : goal === 'growth' ? 'dca' : 'grid'}",
    "description": "策略描述（1-2句话）",
    "parameters": {
      "budget": ${budget},
      ${goal === 'recovery' ? `"buy_lines": [{"price": 数字, "amount": 数字, "asset_symbol": "资产代号"}],
      "sell_lines": [{"price": 数字, "amount": 数字, "asset_symbol": "资产代号"}]` :
        goal === 'growth' ? `"amount_per": 数字, "periods": 数字, "frequency": "weekly或monthly"` :
        `"low": 数字, "high": 数字, "grids": 数字`}
    }
  },
  "plans": [
    {
      "seq": 1,
      "asset_id": ${assetList[0].asset.id},
      "trigger_type": "price_below 或 price_above 或 time",
      "trigger_value": 数字,
      "action": "buy 或 sell",
      "quantity": 数字或null,
      "amount": 数字或null,
      "new_avg_cost": 数字或null,
      "notes": "简要说明（含资产名称）"
    }
  ],
  "reasoning": "简要解释策略逻辑（2-3句话）"
}

重要提示：
- 补仓线价格必须低于当前价格/成本价
- 减仓线价格必须高于成本价
- 金额总和不能超过预算
- 操盘计划按 seq 从1开始编号
- 所有价格保留2位小数
${isMulti ? `- 每条操盘计划的 asset_id 必须是以下之一: ${assetList.map(a => `${a.asset.id}(${a.asset.symbol})`).join(', ')}
- 合理分配预算到各资产` : `- 操盘计划的 asset_id 使用 ${assetList[0].asset.id}`}`;
}

/**
 * 调用 OpenAI 兼容 API
 */
function callLLM(apiUrl, apiKey, model, prompt) {
  return new Promise((resolve) => {
    const url = new URL(apiUrl.endsWith('/chat/completions') ? apiUrl : `${apiUrl}/chat/completions`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一位专业量化策略师，只输出 JSON，不输出任何其他文字。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const opts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

/**
 * 从 LLM 响应中提取 JSON
 */
function extractJSON(text) {
  // 尝试直接解析
  try { return JSON.parse(text); } catch {}

  // 尝试提取 ```json ... ``` 块
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }

  // 尝试找到第一个 { 和最后一个 }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }

  return null;
}

/**
 * AI 生成策略主入口（支持多资产）
 */
export async function aiGenerateStrategy(db, { assetIds, assetId, budget, goal, riskLevel }) {
  const config = getAIConfig(db);
  if (!config.apiUrl || !config.apiKey) {
    throw new Error('请先在设置中配置 AI API 地址和密钥');
  }

  // Normalize to array
  const ids = assetIds || (assetId ? [assetId] : []);
  if (ids.length === 0) throw new Error('请选择资产');

  log.info('AI strategy generation started', { assetIds: ids, budget, goal, riskLevel, model: config.model });

  // 收集每个资产的上下文
  const assetList = [];
  for (const id of ids) {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    if (!asset) throw new Error(`资产 ID ${id} 不存在`);

    const holding = db.prepare("SELECT * FROM holdings WHERE asset_id = ? AND status = 'active'").get(id);
    let currentPrice = null;
    const priceRow = db.prepare('SELECT price FROM price_cache WHERE asset_id = ? ORDER BY fetched_at DESC LIMIT 1').get(id);
    if (priceRow) currentPrice = priceRow.price;

    const recentTrades = db.prepare('SELECT * FROM transactions WHERE asset_id = ? ORDER BY executed_at DESC LIMIT 10').all(id);

    assetList.push({ asset, holding, currentPrice, recentTrades });
  }

  log.debug('AI context collected', { assets: assetList.map(a => a.asset.name), count: assetList.length });

  // 构建 prompt
  const prompt = buildPrompt({
    assets: assetList,
    budget: budget || 20000,
    goal: goal || 'recovery',
    riskLevel: riskLevel || 'medium',
  });

  // 调用 LLM
  const startTime = Date.now();
  const response = await callLLM(config.apiUrl, config.apiKey, config.model, prompt);
  const elapsed = Date.now() - startTime;

  if (!response) {
    log.error('AI service no response', { elapsed: `${elapsed}ms` });
    throw new Error('AI 服务无响应，请检查网络和配置');
  }

  log.info('AI response received', { elapsed: `${elapsed}ms`, hasChoices: !!response.choices });

  // 提取内容
  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    const errMsg = response.error?.message || '未获取到有效回复';
    log.error('AI response invalid', { error: errMsg, response: JSON.stringify(response).slice(0, 200) });
    throw new Error(`AI 返回异常: ${errMsg}`);
  }

  // 解析 JSON
  const result = extractJSON(content);
  if (!result || !result.strategy || !result.plans) {
    log.error('AI JSON parse failed', { contentPreview: content.slice(0, 300) });
    throw new Error('AI 返回格式异常，无法解析策略');
  }

  log.info('AI strategy generated', { strategyName: result.strategy.name, plans: result.plans.length });

  return {
    strategy: result.strategy,
    plans: result.plans,
    reasoning: result.reasoning || '',
  };
}
