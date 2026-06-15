import { getDb } from '../db/database.js';
import { getAgentConfig, callLLM } from './strategy-agent.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('strategy-chat');

const STRATEGY_FIELDS = new Set(['name', 'description', 'type', 'asset_id', 'asset_ids', 'parameters', 'status']);
const PLAN_FIELDS = new Set(['asset_id', 'trigger_type', 'trigger_value', 'action', 'quantity', 'amount', 'new_avg_cost', 'status', 'notes']);

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

function numericOrNull(value) {
  if (value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function clonePlan(plan) {
  return {
    id: plan.id,
    strategy_id: plan.strategy_id,
    asset_id: plan.asset_id,
    seq: plan.seq,
    trigger_type: plan.trigger_type,
    trigger_value: plan.trigger_value,
    action: plan.action,
    quantity: plan.quantity,
    amount: plan.amount,
    new_avg_cost: plan.new_avg_cost,
    status: plan.status,
    notes: plan.notes,
  };
}

function planLabel(planOrLocator) {
  if (planOrLocator?.seq != null) return `第${planOrLocator.seq}步`;
  if (planOrLocator?.id != null) return `计划#${planOrLocator.id}`;
  return '计划';
}

function normalizeStrategyUpdates(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const normalized = {};
  for (const [key, value] of Object.entries(updates)) {
    if (!STRATEGY_FIELDS.has(key) || value === undefined) continue;
    if (key === 'parameters') {
      if (value && typeof value === 'object' && !Array.isArray(value)) normalized.parameters = value;
      continue;
    }
    if (key === 'asset_id') {
      const num = numericOrNull(value);
      if (num !== undefined) normalized.asset_id = num;
      continue;
    }
    if (key === 'asset_ids') {
      const ids = Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : safeParse(value, []);
      normalized.asset_ids = Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : [];
      continue;
    }
    normalized[key] = value;
  }
  return Object.keys(normalized).length ? normalized : null;
}

function normalizePlanPatch(patch, { allowSeq = false } = {}) {
  if (!patch || typeof patch !== 'object') return null;
  const normalized = {};
  if (patch.id != null) {
    const id = Number(patch.id);
    if (Number.isFinite(id)) normalized.id = id;
  }
  if (patch.seq != null) {
    const seq = Number(patch.seq);
    if (Number.isFinite(seq)) normalized.seq = Math.max(1, Math.round(seq));
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!PLAN_FIELDS.has(key) || value === undefined) continue;
    if (key === 'asset_id') {
      const num = numericOrNull(value);
      if (num !== undefined) normalized.asset_id = num;
      continue;
    }
    if (['trigger_value', 'quantity', 'amount', 'new_avg_cost'].includes(key)) {
      const num = numericOrNull(value);
      if (num !== undefined || value === null) normalized[key] = num;
      continue;
    }
    normalized[key] = value;
  }
  if (!allowSeq) delete normalized.seq;
  return Object.keys(normalized).length ? normalized : null;
}

function normalizePlanDeletes(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (item && typeof item === 'object') {
      const normalized = {};
      if (item.id != null) {
        const id = Number(item.id);
        if (Number.isFinite(id)) normalized.id = id;
      }
      if (item.seq != null) {
        const seq = Number(item.seq);
        if (Number.isFinite(seq)) normalized.seq = Math.max(1, Math.round(seq));
      }
      return Object.keys(normalized).length ? normalized : null;
    }
    const seq = Number(item);
    return Number.isFinite(seq) ? { seq: Math.max(1, Math.round(seq)) } : null;
  }).filter(Boolean);
}

function normalizeChatResult(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return {
      understood: false,
      interpretation: '无法理解',
      changes: null,
      summary: '请更具体地描述您想做的调整',
    };
  }

  const understood = Boolean(parsed.understood);
  if (!understood) {
    return {
      understood: false,
      interpretation: parsed.interpretation || '无法理解',
      changes: null,
      summary: parsed.summary || '请更具体地描述您想做的调整',
    };
  }

  const changes = parsed.changes && typeof parsed.changes === 'object' ? parsed.changes : {};
  return {
    understood: true,
    interpretation: parsed.interpretation || '已理解用户意图',
    changes: {
      strategy_updates: normalizeStrategyUpdates(changes.strategy_updates),
      plans_add: Array.isArray(changes.plans_add) ? changes.plans_add.map(item => normalizePlanPatch(item, { allowSeq: true })).filter(Boolean) : [],
      plans_update: Array.isArray(changes.plans_update) ? changes.plans_update.map(item => normalizePlanPatch(item, { allowSeq: true })).filter(Boolean) : [],
      plans_delete: normalizePlanDeletes(changes.plans_delete),
    },
    summary: parsed.summary || '已生成策略调整建议',
  };
}

function hasEffectiveChanges(changes) {
  return Boolean(
    changes?.strategy_updates
    || changes?.plans_add?.length
    || changes?.plans_update?.length
    || changes?.plans_delete?.length
  );
}

function formatPlansTable(plans) {
  if (!plans.length) return '（暂无操盘计划）';
  return [
    'seq | id | trigger_type | trigger_value | action | quantity | amount',
    ...plans.map(plan => [
      plan.seq ?? '-',
      plan.id ?? '-',
      plan.trigger_type ?? '-',
      plan.trigger_value ?? '-',
      plan.action ?? '-',
      plan.quantity ?? '-',
      plan.amount ?? '-',
    ].join(' | ')),
  ].join('\n');
}

function loadStrategyContext(db, strategyId) {
  const strategy = db.prepare(`SELECT s.*, a.name AS asset_name, a.symbol
    FROM strategies s
    LEFT JOIN assets a ON s.asset_id = a.id
    WHERE s.id = ?`).get(strategyId);
  if (!strategy) throw new Error('策略不存在');

  const plans = db.prepare(`SELECT tp.*, a.name AS asset_name, a.symbol
    FROM trading_plans tp
    LEFT JOIN assets a ON tp.asset_id = a.id
    WHERE tp.strategy_id = ?
    ORDER BY tp.seq ASC, tp.id ASC`).all(strategyId);

  return { strategy, plans };
}

function buildChatPrompt(strategy, plans, userMessage) {
  const parsedParameters = safeParse(strategy.parameters, {});
  return `你是投资策略助手。用户会用自然语言描述对策略的调整。\n\n当前策略：\n- 名称：${strategy.name}\n- 类型：${strategy.type}\n- 参数：${JSON.stringify(parsedParameters, null, 2)}\n\n当前操盘计划：\n${formatPlansTable(plans)}\n\n用户输入：${userMessage}\n\n请分析用户意图，返回严格JSON格式的修改指令：\n{\n  "understood": true/false,\n  "interpretation": "你理解的用户意图（一句话）",\n  "changes": {\n    "strategy_updates": {\n      "name": "新名称",\n      "parameters": { }\n    },\n    "plans_add": [\n      { "seq": 4, "trigger_type": "price_below", "trigger_value": 900, "action": "buy", "amount": 3000 }\n    ],\n    "plans_update": [\n      { "seq": 2, "amount": 6000 }\n    ],\n    "plans_delete": [3]\n  },\n  "summary": "即将执行的修改概要（中文）"\n}\n\n要求：\n1. 只能输出 JSON，不要输出 markdown 代码块或额外解释。\n2. 如果只改 strategy.parameters 的部分字段，必须返回合并后的完整 parameters 对象。\n3. plans_update 用 seq 或 id 定位；plans_delete 优先返回 seq。\n4. 新增计划如未指定 seq，请放在合适位置并给出 seq。\n5. 如果无法理解用户意图，返回 {"understood": false, "interpretation": "无法理解", "changes": null, "summary": "请更具体地描述您想做的调整"}。`;
}

function findPlanIndex(plans, locator) {
  if (locator?.id != null) return plans.findIndex(item => Number(item.id) === Number(locator.id));
  if (locator?.seq != null) return plans.findIndex(item => Number(item.seq) === Number(locator.seq));
  return -1;
}

function applyPlanUpdates(target, patch) {
  for (const field of PLAN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) target[field] = patch[field];
  }
}

function validatePlanForInsert(plan, strategy) {
  if (!plan.trigger_type || !plan.action) throw new Error('新增计划缺少触发条件或操作类型');
  const triggerValue = numericOrNull(plan.trigger_value);
  if (triggerValue === undefined || triggerValue === null) throw new Error('新增计划缺少有效触发值');
  if (plan.amount == null && plan.quantity == null) throw new Error('新增计划至少需要金额或数量');
  if (!plan.asset_id && !strategy.asset_id) throw new Error('新增计划缺少关联资产');
}

function buildFinalPlans(strategy, currentPlans, changes) {
  const working = currentPlans.map(clonePlan);

  for (const locator of changes?.plans_delete || []) {
    const index = findPlanIndex(working, locator);
    if (index === -1) throw new Error(`${planLabel(locator)}不存在，无法删除`);
    working.splice(index, 1);
  }

  for (const patch of changes?.plans_update || []) {
    const index = findPlanIndex(working, patch);
    if (index === -1) throw new Error(`${planLabel(patch)}不存在，无法更新`);
    applyPlanUpdates(working[index], patch);
  }

  for (const addition of changes?.plans_add || []) {
    validatePlanForInsert(addition, strategy);
    const insertAt = addition.seq ? Math.min(Math.max(addition.seq - 1, 0), working.length) : working.length;
    const plan = {
      id: null,
      strategy_id: Number(strategy.id),
      asset_id: addition.asset_id || strategy.asset_id,
      seq: addition.seq || working.length + 1,
      trigger_type: addition.trigger_type,
      trigger_value: addition.trigger_value,
      action: addition.action,
      quantity: addition.quantity ?? null,
      amount: addition.amount ?? null,
      new_avg_cost: addition.new_avg_cost ?? null,
      status: addition.status || 'pending',
      notes: addition.notes ?? null,
    };
    working.splice(insertAt, 0, plan);
  }

  return working.map((plan, index) => ({ ...plan, seq: index + 1 }));
}

function updateStrategyRow(db, strategyId, updates) {
  if (!updates || !Object.keys(updates).length) return;
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    if (key === 'parameters') values.push(JSON.stringify(value || {}));
    else if (key === 'asset_ids') values.push(value ? JSON.stringify(value) : null);
    else values.push(value);
  }
  fields.push("updated_at = datetime('now')");
  values.push(strategyId);
  db.prepare(`UPDATE strategies SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function persistPlans(db, strategyId, currentPlans, finalPlans) {
  const currentIds = new Set(currentPlans.map(plan => Number(plan.id)));
  const finalIds = new Set(finalPlans.filter(plan => plan.id != null).map(plan => Number(plan.id)));
  const idsToDelete = [...currentIds].filter(id => !finalIds.has(id));
  if (idsToDelete.length) {
    const placeholders = idsToDelete.map(() => '?').join(',');
    db.prepare(`DELETE FROM trading_plans WHERE strategy_id = ? AND id IN (${placeholders})`).run(strategyId, ...idsToDelete);
  }

  const updateStmt = db.prepare(`UPDATE trading_plans SET
    asset_id = ?,
    seq = ?,
    trigger_type = ?,
    trigger_value = ?,
    action = ?,
    quantity = ?,
    amount = ?,
    new_avg_cost = ?,
    status = ?,
    notes = ?,
    updated_at = datetime('now')
    WHERE id = ? AND strategy_id = ?`);
  const insertStmt = db.prepare(`INSERT INTO trading_plans
    (strategy_id, asset_id, seq, trigger_type, trigger_value, action, quantity, amount, new_avg_cost, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const plan of finalPlans) {
    if (plan.id != null) {
      updateStmt.run(
        plan.asset_id,
        plan.seq,
        plan.trigger_type,
        plan.trigger_value,
        plan.action,
        plan.quantity ?? null,
        plan.amount ?? null,
        plan.new_avg_cost ?? null,
        plan.status || 'pending',
        plan.notes ?? null,
        plan.id,
        strategyId,
      );
    } else {
      insertStmt.run(
        strategyId,
        plan.asset_id,
        plan.seq,
        plan.trigger_type,
        plan.trigger_value,
        plan.action,
        plan.quantity ?? null,
        plan.amount ?? null,
        plan.new_avg_cost ?? null,
        plan.status || 'pending',
        plan.notes ?? null,
      );
    }
  }
}

export async function processStrategyChat(strategyId, userMessage) {
  const db = getDb();
  const message = String(userMessage || '').trim();
  if (!message) throw new Error('请输入调整内容');

  const { strategy, plans } = loadStrategyContext(db, strategyId);
  const config = getAgentConfig(db);
  if (!config.apiUrl || !config.apiKey) throw new Error('AI 服务未配置');

  const response = await callLLM(
    config.apiUrl,
    config.apiKey,
    config.analysisModel || config.model,
    [
      { role: 'system', content: '你是一位严谨的投资策略编辑助手。你只能输出严格 JSON，不要输出任何额外文本。' },
      { role: 'user', content: buildChatPrompt(strategy, plans, message) },
    ],
    { temperature: 0.1, maxTokens: 1800, timeout: 60000, retries: 1 }
  );

  const content = response?.choices?.[0]?.message?.content;
  const parsed = content ? extractJSON(content) : null;
  if (!parsed) {
    log.warn('Strategy chat parse failed', { strategyId, preview: content?.slice?.(0, 200) || response?.error?.message || '' });
  }

  const result = normalizeChatResult(parsed);
  if (result.understood && !hasEffectiveChanges(result.changes)) {
    return {
      understood: false,
      interpretation: result.interpretation || '无法生成明确修改',
      changes: null,
      summary: '我理解了您的意思，但还需要更明确的修改目标。',
    };
  }
  return result;
}

export function applyStrategyChanges(strategyId, changes) {
  const db = getDb();
  const { strategy, plans } = loadStrategyContext(db, strategyId);
  const normalizedChanges = {
    strategy_updates: normalizeStrategyUpdates(changes?.strategy_updates),
    plans_add: Array.isArray(changes?.plans_add) ? changes.plans_add.map(item => normalizePlanPatch(item, { allowSeq: true })).filter(Boolean) : [],
    plans_update: Array.isArray(changes?.plans_update) ? changes.plans_update.map(item => normalizePlanPatch(item, { allowSeq: true })).filter(Boolean) : [],
    plans_delete: normalizePlanDeletes(changes?.plans_delete),
  };

  const finalPlans = buildFinalPlans(strategy, plans, normalizedChanges);

  const tx = db.transaction(() => {
    updateStrategyRow(db, strategyId, normalizedChanges.strategy_updates);
    persistPlans(db, Number(strategyId), plans, finalPlans);
  });
  tx();

  return loadStrategyContext(db, strategyId);
}
