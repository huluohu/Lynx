<template>
  <div class="ai-gen">
    <!-- Step 1: 配置 -->
    <div v-if="step === 'config'">
      <div class="form-group">
        <label class="form-label">选择资产 *（可多选）</label>
        <div class="asset-multi-select">
          <div v-for="a in assets" :key="a.id" class="asset-chip" 
               :class="{ selected: selectedAssetIds.includes(a.id) }"
               @click="toggleAsset(a.id)">
            {{ a.icon }} {{ a.name }}
          </div>
        </div>
        <div v-if="selectedAssetIds.length > 0" class="selected-count">
          已选 {{ selectedAssetIds.length }} 个资产
        </div>
      </div>

      <!-- 持仓摘要 -->
      <div v-if="holdingSummaries.length > 0" class="holding-summary">
        <div v-for="s in holdingSummaries" :key="s.asset_id" class="holding-summary-item">
          <div class="summary-asset-name">{{ s.name }}</div>
          <div class="summary-row"><span>持仓数量</span><b>{{ s.quantity }}</b></div>
          <div class="summary-row"><span>成本价</span><b>¥{{ s.avg_cost }}</b></div>
          <div class="summary-row"><span>总投入</span><b>¥{{ fmt(s.total_invested) }}</b></div>
          <div class="summary-row" v-if="s.pnl_pct !== null">
            <span>浮动盈亏</span>
            <b :class="s.pnl_pct >= 0 ? 'pnl positive' : 'pnl negative'">{{ s.pnl_pct >= 0 ? '+' : '' }}{{ s.pnl_pct }}%</b>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">可用预算 (¥)</label>
        <input class="form-input" type="number" v-model="form.budget" placeholder="20000" inputmode="numeric" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">投资目标</label>
          <select class="form-select" v-model="form.goal">
            <option value="recovery">💉 扭亏为盈</option>
            <option value="growth">📈 稳定增长</option>
            <option value="balanced">⚖️ 平衡网格</option>
            <option value="trend">📊 趋势跟踪</option>
            <option value="rebalance">⚖️ 组合再平衡</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">风险偏好</label>
          <select class="form-select" v-model="form.risk_level">
            <option value="low">🛡️ 保守</option>
            <option value="medium">⚖️ 适中</option>
            <option value="high">🔥 激进</option>
          </select>
        </div>
      </div>

      <button class="btn btn-primary" style="width:100%;margin-top:12px" @click="generate" :disabled="generating || selectedAssetIds.length === 0">
        {{ generating ? '⏳ Agent 工作中...' : '✨ 智能生成策略' }}
      </button>

      <!-- Agent Progress -->
      <div v-if="generating" class="agent-progress">
        <div class="progress-title">🧠 策略 Agent 工作中</div>
        <div class="progress-steps">
          <div v-for="s in agentSteps" :key="s.id" class="progress-step" :class="s.status">
            <span class="step-icon">{{ s.status === 'done' ? '✅' : s.status === 'active' ? '⏳' : '⬜' }}</span>
            <span class="step-label">{{ s.label }}</span>
            <span v-if="s.detail" class="step-detail">{{ s.detail }}</span>
          </div>
        </div>
      </div>

      <div v-if="error" class="gen-error">{{ error }}</div>
    </div>

    <!-- Step 2: 预览结果 -->
    <div v-if="step === 'preview'">
      <!-- 分析报告（可折叠） -->
      <div v-if="result.analysis" class="preview-section analysis-section">
        <div class="section-title clickable" @click="showAnalysis = !showAnalysis">
          📊 市场分析报告 
          <span class="toggle-icon">{{ showAnalysis ? '▼' : '▶' }}</span>
          <span v-if="result.analysis.confidence_level" class="confidence-badge">
            置信度 {{ Math.round(result.analysis.confidence_level * 100) }}%
          </span>
        </div>
        <div v-if="showAnalysis" class="analysis-content">
          <div class="analysis-item">
            <div class="analysis-label">市场评估</div>
            <p>{{ result.analysis.market_assessment }}</p>
          </div>
          <div v-if="result.analysis.macro_outlook" class="analysis-item">
            <div class="analysis-label">宏观展望</div>
            <p>{{ result.analysis.macro_outlook }}</p>
          </div>
          <div v-if="result.analysis.portfolio_diagnosis" class="analysis-item">
            <div class="analysis-label">组合诊断</div>
            <p>{{ result.analysis.portfolio_diagnosis }}</p>
          </div>
          <div v-for="aa in (result.analysis.asset_analyses || [])" :key="aa.asset_name" class="analysis-item">
            <div class="analysis-label">{{ aa.asset_name }}</div>
            <div class="analysis-trend">
              <div v-if="aa.trend?.short_term"><b>短期:</b> {{ aa.trend.short_term }}</div>
              <div v-if="aa.trend?.medium_term"><b>中期:</b> {{ aa.trend.medium_term }}</div>
              <div v-if="aa.trend?.key_support_levels?.length"><b>支撑位:</b> {{ aa.trend.key_support_levels.join(', ') }}</div>
              <div v-if="aa.trend?.key_resistance_levels?.length"><b>阻力位:</b> {{ aa.trend.key_resistance_levels.join(', ') }}</div>
            </div>
            <div v-if="aa.risk_factors?.length" class="analysis-list">
              <span class="list-label">⚠️ 风险:</span> {{ aa.risk_factors.join('；') }}
            </div>
            <div v-if="aa.opportunities?.length" class="analysis-list">
              <span class="list-label">💡 机会:</span> {{ aa.opportunities.join('；') }}
            </div>
          </div>
          <div v-if="result.analysis.data_limitations" class="analysis-item disclaimer">
            <div class="analysis-label">⚠️ 数据局限性</div>
            <p>{{ result.analysis.data_limitations }}</p>
          </div>
        </div>
      </div>

      <!-- 策略建议 -->
      <div class="preview-section">
        <div class="section-title">🎯 策略建议</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">名称</span><span>{{ result.strategy.name }}</span></div>
          <div class="info-row"><span class="info-label">类型</span><span class="badge badge-buy">{{ typeLabel(result.strategy.type) }}</span></div>
          <div class="info-row"><span class="info-label">描述</span><span style="color:var(--text-dim)">{{ result.strategy.description }}</span></div>
          <div class="info-row" v-if="selectedAssetIds.length > 1"><span class="info-label">组合</span><span>{{ selectedAssetNames }}</span></div>
        </div>
      </div>

      <!-- 决策逻辑 -->
      <div v-if="result.reasoning" class="preview-section">
        <div class="section-title">💡 决策逻辑</div>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.6">{{ result.reasoning }}</p>
      </div>

      <!-- 风险管理 -->
      <div v-if="result.risk_management" class="preview-section">
        <div class="section-title">🛡️ 风险管理</div>
        <div class="risk-info">
          <div v-if="result.risk_management.max_loss_tolerance"><b>最大容忍亏损:</b> {{ result.risk_management.max_loss_tolerance }}</div>
          <div v-if="result.risk_management.position_sizing_logic"><b>仓位逻辑:</b> {{ result.risk_management.position_sizing_logic }}</div>
          <div v-if="result.risk_management.stop_loss_triggers?.length">
            <b>止损条件:</b>
            <ul><li v-for="(t, i) in result.risk_management.stop_loss_triggers" :key="i">{{ t }}</li></ul>
          </div>
        </div>
      </div>

      <!-- 执行建议 -->
      <div v-if="result.execution_notes" class="preview-section">
        <div class="section-title">📝 执行建议</div>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.6">{{ result.execution_notes }}</p>
      </div>

      <!-- 操盘计划（可编辑） -->
      <div class="preview-section">
        <div class="section-title">📋 操盘计划 ({{ editablePlans.length }} 步)
          <span class="budget-usage">预算使用: ¥{{ totalBudgetUsed }}</span>
        </div>
        <div class="plan-preview-list">
          <div v-for="(p, idx) in editablePlans" :key="p.seq" class="plan-preview-item" :class="{ editing: editingPlanIdx === idx }">
            <div class="plan-preview-header">
              <span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? '买入' : '卖出' }}</span>
              <template v-if="editingPlanIdx === idx">
                <select v-model="p.trigger_type" class="inline-select">
                  <option value="price_below">价格 ≤</option>
                  <option value="price_above">价格 ≥</option>
                  <option value="time">时间</option>
                </select>
                <input type="number" v-model.number="p.trigger_value" class="inline-input" style="width:80px" />
              </template>
              <template v-else>
                <span style="font-weight:600">{{ triggerLabel(p.trigger_type) }} {{ p.trigger_value }}</span>
              </template>
              <span v-if="selectedAssetIds.length > 1 && p.asset_id" class="plan-asset-tag">{{ getAssetName(p.asset_id) }}</span>
              <div class="plan-actions">
                <button class="plan-action-btn" @click="editingPlanIdx = editingPlanIdx === idx ? -1 : idx" :title="editingPlanIdx === idx ? '完成' : '编辑'">
                  {{ editingPlanIdx === idx ? '✓' : '✏️' }}
                </button>
                <button class="plan-action-btn del" @click="removePlan(idx)" title="删除">✕</button>
              </div>
            </div>
            <div class="plan-preview-meta">
              <template v-if="editingPlanIdx === idx">
                <label>金额: <input type="number" v-model.number="p.amount" class="inline-input" style="width:70px" /></label>
                <label>数量: <input type="number" v-model.number="p.quantity" class="inline-input" style="width:70px" step="0.0001" /></label>
              </template>
              <template v-else>
                <span v-if="p.amount">¥{{ Math.round(p.amount) }}</span>
                <span v-if="p.quantity">{{ typeof p.quantity === 'number' ? p.quantity.toFixed(4) : p.quantity }}</span>
                <span v-if="p.new_avg_cost">均价→¥{{ p.new_avg_cost }}</span>
              </template>
            </div>
            <div v-if="p.rationale && editingPlanIdx !== idx" class="plan-rationale">📌 {{ p.rationale }}</div>
            <div v-else-if="p.notes && editingPlanIdx !== idx" style="font-size:11px;color:var(--text-muted);margin-top:2px">{{ p.notes }}</div>
          </div>
        </div>
      </div>

      <!-- 重新生成区域 -->
      <div class="preview-section regenerate-section">
        <div class="section-title clickable" @click="showRegenerate = !showRegenerate">
          🔄 不满意？调整后重新生成
          <span class="toggle-icon">{{ showRegenerate ? '▼' : '▶' }}</span>
          <span v-if="regenerateCount > 0" class="regen-count">已迭代 {{ regenerateCount }} 次</span>
        </div>
        <div v-if="showRegenerate" class="regenerate-form">
          <textarea 
            v-model="userFeedback" 
            class="form-input feedback-input" 
            placeholder="输入您的调整建议，例如：买入价格再低一些、增加止损条件、减少单笔金额..."
            rows="3"
          ></textarea>
          <button class="btn btn-secondary" style="width:100%;margin-top:8px" @click="regenerate" :disabled="generating || !userFeedback.trim()">
            🔄 基于反馈重新生成
          </button>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-primary" style="flex:1" @click="confirmSave" :disabled="saving">
          {{ saving ? '保存中...' : '✅ 确认采用' }}
        </button>
        <button class="btn" @click="generate" :disabled="generating">🔄 重新生成</button>
        <button class="btn" @click="step = 'config'">⚙️ 改参数</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const props = defineProps({
  presetAssetId: { type: [Number, String], default: null },
  existingStrategyId: { type: [Number, String], default: null },
})
const emit = defineEmits(['done'])

const toast = useToast()
const assets = ref([])
const holdingSummaries = ref([])
const selectedAssetIds = ref([])
const step = ref('config')
const generating = ref(false)
const saving = ref(false)
const error = ref('')
const result = ref(null)
const showAnalysis = ref(false)
const showRegenerate = ref(false)
const editingPlanIdx = ref(-1)
const editablePlans = ref([])
const generationId = ref(null)
const regenerateCount = ref(0)
const userFeedback = ref('')
const form = reactive({
  budget: 20000,
  goal: 'recovery',
  risk_level: 'medium',
})

// Agent progress tracking
const agentSteps = ref([
  { id: 'collecting', label: '收集数据', status: 'pending', detail: '' },
  { id: 'analyzing', label: '市场研判', status: 'pending', detail: '' },
  { id: 'generating', label: '生成策略', status: 'pending', detail: '' },
])

const selectedAssetNames = computed(() => {
  return selectedAssetIds.value
    .map(id => assets.value.find(a => a.id === id))
    .filter(Boolean)
    .map(a => a.name)
    .join('、')
})

const totalBudgetUsed = computed(() => {
  return editablePlans.value
    .filter(p => p.action === 'buy' && p.amount)
    .reduce((sum, p) => sum + (p.amount || 0), 0)
    .toLocaleString()
})

function toggleAsset(id) {
  const idx = selectedAssetIds.value.indexOf(id)
  if (idx >= 0) selectedAssetIds.value.splice(idx, 1)
  else selectedAssetIds.value.push(id)
  loadAssetInfo()
}

function getAssetName(id) {
  const a = assets.value.find(x => x.id === id)
  return a ? a.name : `#${id}`
}

function removePlan(idx) {
  editablePlans.value.splice(idx, 1)
  // Re-number seq
  editablePlans.value.forEach((p, i) => { p.seq = i + 1 })
}

async function loadAssets() {
  const res = await api('/api/assets')
  const json = await res.json()
  assets.value = json.data || []
}

async function loadAssetInfo() {
  holdingSummaries.value = []
  if (selectedAssetIds.value.length === 0) return
  const summaries = []
  for (const assetId of selectedAssetIds.value) {
    try {
      const res = await api(`/api/assets/${assetId}`)
      const json = await res.json()
      if (json.data && json.data.quantity) {
        const h = json.data
        const asset = assets.value.find(a => a.id === assetId)
        const priceRes = await api(`/api/market/prices/${assetId}`)
        const pJson = await priceRes.json()
        const price = pJson.data?.price
        const pnl_pct = price && h.avg_cost ? ((price - h.avg_cost) / h.avg_cost * 100).toFixed(1) : null
        summaries.push({
          asset_id: assetId,
          name: asset?.name || `资产#${assetId}`,
          quantity: h.quantity,
          avg_cost: h.avg_cost,
          total_invested: h.total_invested,
          pnl_pct: pnl_pct ? Number(pnl_pct) : null,
        })
      }
    } catch {}
  }
  holdingSummaries.value = summaries
}

function updateAgentStep(stepId, status, detail) {
  const s = agentSteps.value.find(x => x.id === stepId)
  if (s) {
    s.status = status
    if (detail) s.detail = detail
  }
}

async function generate() {
  error.value = ''
  generating.value = true
  result.value = null
  editablePlans.value = []
  editingPlanIdx.value = -1
  step.value = 'config' // show progress UI

  // Reset progress
  agentSteps.value.forEach(s => { s.status = 'pending'; s.detail = ''; })

  try {
    await doGenerate({
      asset_ids: selectedAssetIds.value,
      budget: form.budget,
      goal: form.goal,
      risk_level: form.risk_level,
    })
  } catch (e) {
    error.value = e.message
  }
  generating.value = false
}

async function regenerate() {
  if (!userFeedback.value.trim()) return
  error.value = ''
  generating.value = true

  // Reset progress
  agentSteps.value.forEach(s => { s.status = 'pending'; s.detail = ''; })
  step.value = 'config' // show progress

  try {
    await doGenerate({
      asset_ids: selectedAssetIds.value,
      budget: form.budget,
      goal: form.goal,
      risk_level: form.risk_level,
      parent_id: generationId.value,
      user_feedback: userFeedback.value.trim(),
    })
    regenerateCount.value++
    userFeedback.value = ''
    showRegenerate.value = false
  } catch (e) {
    error.value = e.message
  }
  generating.value = false
}

async function doGenerate(body) {
  const token = localStorage.getItem('token')
  const baseUrl = import.meta.env.VITE_API_BASE || ''
  const response = await fetch(`${baseUrl}/api/strategies/ai-agent-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const json = JSON.parse(text)
      throw new Error(json.error || `HTTP ${response.status}`)
    } catch (e) {
      if (e.message.startsWith('HTTP')) throw e
      throw new Error(`请求失败: ${response.status}`)
    }
  }

  // Parse SSE stream
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let eventType = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim()
      } else if (line.startsWith('data: ') && eventType) {
        try {
          const data = JSON.parse(line.slice(6))
          handleSSEEvent(eventType, data)
        } catch {}
        eventType = ''
      }
    }
  }
}

function handleSSEEvent(event, data) {
  if (event === 'progress') {
    const { step: stepName, message } = data
    if (stepName === 'collecting') {
      updateAgentStep('collecting', 'active', message)
    } else if (stepName === 'collecting_done') {
      updateAgentStep('collecting', 'done', message)
      updateAgentStep('analyzing', 'active', '')
    } else if (stepName === 'analyzing') {
      updateAgentStep('analyzing', 'active', message)
    } else if (stepName === 'analyzing_done') {
      updateAgentStep('analyzing', 'done', message)
      updateAgentStep('generating', 'active', '')
    } else if (stepName === 'generating') {
      updateAgentStep('generating', 'active', message)
    } else if (stepName === 'done') {
      updateAgentStep('generating', 'done', message)
    }
  } else if (event === 'result') {
    if (data.success && data.data) {
      result.value = data.data
      editablePlans.value = JSON.parse(JSON.stringify(data.data.plans || []))
      generationId.value = data.data.generation_id || null
      step.value = 'preview'
      showAnalysis.value = true
    } else {
      error.value = data.error || '生成失败'
    }
  } else if (event === 'error') {
    error.value = data.error || '生成失败'
  }
}

async function confirmSave() {
  saving.value = true
  try {
    const body = {
      asset_ids: selectedAssetIds.value,
      strategy: result.value.strategy,
      plans: editablePlans.value,
      generation_id: generationId.value,
    }
    if (props.existingStrategyId) {
      body.existing_strategy_id = Number(props.existingStrategyId)
    }
    const res = await api('/api/strategies/ai-confirm', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    toast.success(props.existingStrategyId ? '策略已更新' : '策略已保存')
    emit('done', json.data.strategyId)
  } catch (e) {
    toast.error(e.message)
  }
  saving.value = false
}

function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏', trend:'趋势', rebalance:'再平衡' }[t] || t }
function triggerLabel(t) { return { price_above:'价格 ≥', price_below:'价格 ≤', time:'时间' }[t] || t }
function fmt(n) { return n ? Math.round(n).toLocaleString() : '0' }

onMounted(() => {
  loadAssets()
  if (props.presetAssetId) {
    selectedAssetIds.value = [Number(props.presetAssetId)]
    loadAssetInfo()
  }
})
</script>

<style scoped>
.asset-multi-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.asset-chip {
  padding: 8px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}
.asset-chip:hover { border-color: var(--primary); }
.asset-chip.selected {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}
.selected-count {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-dim);
}

.holding-summary {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}
.holding-summary-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.holding-summary-item:last-child { border-bottom: none; }
.summary-asset-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--primary);
}
.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 13px;
}
.summary-row span:first-child { color: var(--text-dim); }

/* Agent Progress */
.agent-progress {
  margin-top: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
.progress-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
}
.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.progress-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  transition: opacity 0.3s;
}
.progress-step.pending { opacity: 0.4; }
.progress-step.active { opacity: 1; }
.progress-step.done { opacity: 0.8; }
.step-icon { font-size: 16px; }
.step-label { font-weight: 500; }
.step-detail { color: var(--text-dim); font-size: 12px; margin-left: auto; }
.progress-step.active .step-icon { animation: pulse 1.2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

.gen-error {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: var(--red);
  font-size: 13px;
}

/* Analysis Report */
.analysis-section {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
.section-title.clickable {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.toggle-icon { font-size: 10px; color: var(--text-dim); }
.confidence-badge {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(34,197,94,0.15);
  color: var(--green);
  font-weight: 500;
}
.analysis-content {
  margin-top: 12px;
}
.analysis-item {
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.analysis-item:last-child { border-bottom: none; margin-bottom: 0; }
.analysis-item.disclaimer {
  background: rgba(239,68,68,0.05);
  border-radius: 6px;
  padding: 10px;
  border-bottom: none;
}
.analysis-label {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--text);
}
.analysis-item p {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.6;
  margin: 0;
}
.analysis-trend {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.8;
}
.analysis-trend b { color: var(--text-muted); }
.analysis-list {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}
.list-label { font-weight: 600; }

/* Preview */
.preview-section {
  margin-bottom: 16px;
}
.section-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }

.risk-info {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.8;
}
.risk-info b { color: var(--text-muted); }
.risk-info ul { margin: 4px 0 4px 16px; padding: 0; }
.risk-info li { margin-bottom: 2px; }

.plan-preview-list { display: flex; flex-direction: column; gap: 8px; }
.plan-preview-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  transition: border-color 0.2s;
}
.plan-preview-item.editing {
  border-color: var(--primary);
  background: rgba(59,130,246,0.03);
}
.plan-preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.plan-preview-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-dim); align-items: center; }
.plan-preview-meta label { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.plan-rationale {
  font-size: 11px;
  color: var(--primary);
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(59,130,246,0.06);
  border-radius: 4px;
  line-height: 1.5;
}
.plan-asset-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-dim);
}
.plan-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.plan-action-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.plan-action-btn:hover { border-color: var(--primary); background: rgba(59,130,246,0.05); }
.plan-action-btn.del:hover { border-color: var(--red); background: rgba(239,68,68,0.05); color: var(--red); }

.inline-input {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  background: var(--card-bg);
  color: var(--text);
}
.inline-input:focus { border-color: var(--primary); outline: none; }
.inline-select {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  background: var(--card-bg);
  color: var(--text);
}

.budget-usage {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin-left: 8px;
}

/* Regenerate Section */
.regenerate-section {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}
.regenerate-form {
  margin-top: 10px;
}
.feedback-input {
  resize: vertical;
  min-height: 60px;
  font-size: 13px;
}
.regen-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 400;
}
</style>
