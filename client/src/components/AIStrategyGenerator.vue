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
        {{ generating ? '🤖 AI 分析中...' : '🤖 生成策略' }}
      </button>

      <div v-if="generating" class="generating-hint">
        <span class="spinner"></span> 正在分析{{ selectedAssetIds.length > 1 ? '组合' : '' }}持仓数据并生成策略，请稍候...
      </div>

      <div v-if="error" class="gen-error">{{ error }}</div>
    </div>

    <!-- Step 2: 预览 -->
    <div v-if="step === 'preview'">
      <div class="preview-section">
        <div class="section-title">🎯 策略建议</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">名称</span><span>{{ result.strategy.name }}</span></div>
          <div class="info-row"><span class="info-label">类型</span><span class="badge badge-buy">{{ typeLabel(result.strategy.type) }}</span></div>
          <div class="info-row"><span class="info-label">描述</span><span style="color:var(--text-dim)">{{ result.strategy.description }}</span></div>
          <div class="info-row" v-if="selectedAssetIds.length > 1"><span class="info-label">组合</span><span>{{ selectedAssetNames }}</span></div>
        </div>
      </div>

      <div v-if="result.reasoning" class="preview-section">
        <div class="section-title">💡 策略逻辑</div>
        <p style="font-size:13px;color:var(--text-dim);line-height:1.6">{{ result.reasoning }}</p>
      </div>

      <div class="preview-section">
        <div class="section-title">📋 操盘计划 ({{ result.plans.length }} 步)</div>
        <div class="plan-preview-list">
          <div v-for="p in result.plans" :key="p.seq" class="plan-preview-item">
            <div class="plan-preview-header">
              <span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? '买入' : '卖出' }}</span>
              <span style="font-weight:600">{{ triggerLabel(p.trigger_type) }} {{ p.trigger_value }}</span>
              <span v-if="selectedAssetIds.length > 1 && p.asset_id" class="plan-asset-tag">{{ getAssetName(p.asset_id) }}</span>
            </div>
            <div class="plan-preview-meta">
              <span v-if="p.amount">¥{{ Math.round(p.amount) }}</span>
              <span v-if="p.quantity">{{ p.quantity.toFixed?.(4) || p.quantity }}</span>
              <span v-if="p.new_avg_cost">均价→¥{{ p.new_avg_cost }}</span>
            </div>
            <div v-if="p.notes" style="font-size:11px;color:var(--text-muted);margin-top:2px">{{ p.notes }}</div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn btn-primary" style="flex:1" @click="confirmSave" :disabled="saving">
          {{ saving ? '保存中...' : '✅ 确认采用' }}
        </button>
        <button class="btn" @click="step = 'config'">← 重新生成</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const props = defineProps({
  presetAssetId: { type: [Number, String], default: null },
})
const emit = defineEmits(['done'])

const router = useRouter()
const toast = useToast()
const assets = ref([])
const holdingSummaries = ref([])
const selectedAssetIds = ref([])
const step = ref('config')
const generating = ref(false)
const saving = ref(false)
const error = ref('')
const result = ref(null)
const form = reactive({
  budget: 20000,
  goal: 'recovery',
  risk_level: 'medium',
})

const selectedAssetNames = computed(() => {
  return selectedAssetIds.value
    .map(id => assets.value.find(a => a.id === id))
    .filter(Boolean)
    .map(a => a.name)
    .join('、')
})

function toggleAsset(id) {
  const idx = selectedAssetIds.value.indexOf(id)
  if (idx >= 0) {
    selectedAssetIds.value.splice(idx, 1)
  } else {
    selectedAssetIds.value.push(id)
  }
  loadAssetInfo()
}

function getAssetName(id) {
  const a = assets.value.find(x => x.id === id)
  return a ? a.name : `#${id}`
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

async function generate() {
  error.value = ''
  generating.value = true
  try {
    const res = await api('/api/strategies/ai-generate', {
      method: 'POST',
      body: JSON.stringify({
        asset_ids: selectedAssetIds.value,
        budget: form.budget,
        goal: form.goal,
        risk_level: form.risk_level,
      }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    result.value = json.data
    step.value = 'preview'
  } catch (e) {
    error.value = e.message
  }
  generating.value = false
}

async function confirmSave() {
  saving.value = true
  try {
    const res = await api('/api/strategies/ai-confirm', {
      method: 'POST',
      body: JSON.stringify({
        asset_ids: selectedAssetIds.value,
        strategy: result.value.strategy,
        plans: result.value.plans,
      }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    toast.success('策略已保存')
    emit('done', json.data.strategyId)
  } catch (e) {
    toast.error(e.message)
  }
  saving.value = false
}

function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏' }[t] || t }
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

.generating-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-dim);
}

.gen-error {
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  color: var(--red);
  font-size: 13px;
}

.preview-section {
  margin-bottom: 16px;
}
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }

.plan-preview-list { display: flex; flex-direction: column; gap: 8px; }
.plan-preview-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}
.plan-preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.plan-preview-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-dim); }
.plan-asset-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-dim);
}
</style>
