<template>
  <div>
    <div class="page-header"><h1 class="page-title">操盘计划</h1></div>

    <div class="filter-bar">
      <select class="form-select filter-select" v-model="filterAsset" @change="loadData">
        <option value="">全部资产</option>
        <option v-for="a in assets" :key="a.id" :value="a.id">{{ a.icon }} {{ a.name }}</option>
      </select>
      <select class="form-select filter-select" v-model="filterStrategy" @change="loadData">
        <option value="">全部策略</option>
        <option v-for="s in strategies" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <select class="form-select filter-select" v-model="filterStatus" @change="loadData">
        <option value="">全部状态</option>
        <option value="pending">等待</option>
        <option value="triggered">触发中</option>
        <option value="partial">部分执行</option>
        <option value="executed">已执行</option>
        <option value="cancelled">已取消</option>
      </select>
    </div>

    <div v-if="selectedPlan" class="card execute-card">
      <div class="execute-card-header">
        <div>
          <div class="section-title" style="margin-bottom:8px">执行计划 #{{ selectedPlan.seq || selectedPlan.id }}</div>
          <div class="execute-summary">{{ selectedPlan.asset_name }} · {{ triggerLabel(selectedPlan.trigger_type) }} {{ selectedPlan.trigger_value }}</div>
        </div>
        <button class="btn btn-sm" @click="closeExecuteForm">关闭</button>
      </div>

      <div class="execute-grid">
        <div class="execute-item"><span>计划方向</span><b>{{ selectedPlan.action === 'buy' ? '买入' : '卖出' }}</b></div>
        <div class="execute-item"><span>计划数量</span><b>{{ quantityText(selectedPlan.quantity) }}</b></div>
        <div class="execute-item"><span>计划金额</span><b>{{ moneyText(selectedPlan.amount, selectedPlan.asset_currency) }}</b></div>
        <div class="execute-item"><span>执行进度</span><b>{{ executionProgressLabel(selectedPlan) }}</b></div>
        <div class="execute-item"><span>剩余数量</span><b>{{ quantityText(remainingQuantity(selectedPlan)) }}</b></div>
        <div class="execute-item"><span>剩余金额</span><b>{{ moneyText(remainingAmount(selectedPlan), selectedPlan.asset_currency) }}</b></div>
      </div>

      <form @submit.prevent="submitExecution">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">实际成交价</label>
            <input class="form-input" type="number" step="any" min="0" v-model="executeForm.price" required />
          </div>
          <div class="form-group">
            <label class="form-label">实际成交数量（可选）</label>
            <input class="form-input" type="number" step="any" min="0" v-model="executeForm.quantity" :placeholder="remainingQuantity(selectedPlan) ? String(remainingQuantity(selectedPlan)) : '留空使用计划值'" />
          </div>
        </div>
        <label class="execute-checkbox">
          <input type="checkbox" v-model="executeForm.partial" />
          <span>标记为部分执行</span>
        </label>
        <div class="execute-actions">
          <button type="submit" class="btn btn-primary" :disabled="executeSubmitting">{{ executeSubmitting ? '执行中...' : '确认执行' }}</button>
          <button type="button" class="btn" @click="closeExecuteForm">取消</button>
        </div>
      </form>
    </div>

    <div v-if="loading" class="card">
      <div v-for="i in 4" :key="i" style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="skeleton" style="width:32px;height:16px;border-radius:4px"></div>
        <div class="skeleton skeleton-text" style="width:80px"></div>
        <div class="skeleton skeleton-text" style="width:60px"></div>
        <div class="skeleton skeleton-text" style="width:50px;margin-left:auto"></div>
      </div>
    </div>

    <div class="card" v-else-if="filteredPlans.length">
      <table class="hide-mobile">
        <thead><tr><th>#</th><th>资产</th><th>策略</th><th>触发</th><th>操作</th><th>数量</th><th>金额</th><th>补后均价</th><th>执行进度</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="p in filteredPlans" :key="p.id">
            <td>{{ p.seq }}</td>
            <td><span class="icon-text">{{ p.asset_name }}</span> <span class="plan-symbol">{{ p.symbol }}</span></td>
            <td class="plan-strategy">{{ strategyName(p.strategy_id) }}</td>
            <td>{{ triggerLabel(p.trigger_type) }} <b>{{ p.trigger_value }}</b></td>
            <td><span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'">{{ p.action==='buy'?'买入':'卖出' }}</span></td>
            <td>{{ quantityText(p.quantity) }}</td>
            <td>{{ moneyText(p.amount, p.asset_currency) }}</td>
            <td>{{ moneyText(p.new_avg_cost, p.asset_currency) }}</td>
            <td>
              <div class="plan-progress-text">{{ executionProgressLabel(p) }}</div>
              <div v-if="Number(p.quantity || 0) > 0" class="progress-bar">
                <div class="progress-fill plan-progress-fill" :style="{ width: `${executionRatio(p)}%` }"></div>
              </div>
            </td>
            <td><span class="badge" :class="statusBadge(p.status)">{{ statusLabel(p.status) }}</span></td>
            <td>
              <button v-if="canExecute(p)" class="btn btn-sm btn-primary" @click="openExecuteForm(p)">执行</button>
              <span v-else class="plan-action-placeholder">-</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="show-mobile plan-cards">
        <div v-for="p in filteredPlans" :key="p.id" class="plan-card">
          <div class="plan-card-header">
            <span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'">{{ p.action==='buy'?'买入':'卖出' }}</span>
            <span style="font-weight:600">{{ p.asset_name }}</span>
            <span class="badge" :class="statusBadge(p.status)" style="margin-left:auto">{{ statusLabel(p.status) }}</span>
          </div>
          <div class="plan-card-body">
            <div class="plan-card-strategy">{{ strategyName(p.strategy_id) }}</div>
            <div class="plan-card-trigger">{{ triggerLabel(p.trigger_type) }} <b>{{ p.trigger_value }}</b></div>
            <div class="plan-card-meta">
              <span v-if="p.quantity">数量: {{ quantityText(p.quantity) }}</span>
              <span v-if="p.amount">金额: {{ moneyText(p.amount, p.asset_currency) }}</span>
              <span v-if="p.new_avg_cost">均价→{{ moneyText(p.new_avg_cost, p.asset_currency) }}</span>
            </div>
            <div class="plan-card-progress">{{ executionProgressLabel(p) }}</div>
            <div v-if="Number(p.quantity || 0) > 0" class="progress-bar">
              <div class="progress-fill plan-progress-fill" :style="{ width: `${executionRatio(p)}%` }"></div>
            </div>
            <div v-if="canExecute(p)" class="plan-card-actions">
              <button class="btn btn-sm btn-primary" @click="openExecuteForm(p)">执行</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="card empty"><div class="empty-icon">📋</div><p>暂无操盘计划，去创建一个策略并生成计划</p></div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { currencySymbol } from '../utils/currency.js'

const toast = useToast()
const plans = ref([])
const assets = ref([])
const strategies = ref([])
const loading = ref(true)
const filterAsset = ref('')
const filterStrategy = ref('')
const filterStatus = ref('')
const selectedPlanId = ref(null)
const executeSubmitting = ref(false)
const executeForm = reactive({ price: '', quantity: '', partial: false, currency: 'CNY' })

const filteredPlans = computed(() => {
  let result = plans.value
  if (filterStatus.value) {
    result = result.filter(p => p.status === filterStatus.value)
  }
  return result
})

const selectedPlan = computed(() => plans.value.find(p => String(p.id) === String(selectedPlanId.value)) || null)

async function loadData() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filterAsset.value) params.set('asset_id', filterAsset.value)
    if (filterStrategy.value) params.set('strategy_id', filterStrategy.value)
    const res = await api(`/api/plans?${params.toString()}`)
    const json = await res.json()
    plans.value = json.data || []
    if (selectedPlanId.value && !plans.value.some(p => String(p.id) === String(selectedPlanId.value))) {
      closeExecuteForm()
    }
  } finally {
    loading.value = false
  }
}

function strategyName(id) {
  const s = strategies.value.find(strategy => strategy.id === id)
  return s ? s.name : `策略#${id}`
}

function triggerLabel(type) {
  return { price_above: '≥', price_below: '≤', time: '时间' }[type] || type
}

function statusLabel(status) {
  return { pending: '等待', triggered: '⚡触发中', partial: '部分执行', executed: '已执行', cancelled: '取消' }[status] || status
}

function statusBadge(status) {
  return { pending: 'badge-pending', triggered: 'badge-triggered', partial: 'badge-partial', executed: 'badge-executed', cancelled: 'badge-sell' }[status] || ''
}

function canExecute(plan) {
  return ['pending', 'triggered', 'partial'].includes(plan.status)
}

function quantityText(value) {
  if (value === null || value === undefined || value === '') return '-'
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function moneyText(value, currency = 'CNY') {
  if (value === null || value === undefined || value === '') return '-'
  const symbol = currencySymbol(currency)
  const prefix = symbol.length > 1 ? `${symbol} ` : symbol
  return `${prefix}${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function remainingQuantity(plan) {
  const planned = Number(plan.quantity || 0)
  const executed = Number(plan.executed_quantity || 0)
  if (!planned) return null
  return Math.max(planned - executed, 0)
}

function remainingAmount(plan) {
  const planned = Number(plan.amount || 0)
  const executed = Number(plan.executed_amount || 0)
  if (!planned) return null
  return Math.max(planned - executed, 0)
}

function executionRatio(plan) {
  const planned = Number(plan.quantity || 0)
  const executed = Number(plan.executed_quantity || 0)
  if (!planned) return 0
  return Math.min(100, Math.max(0, executed / planned * 100))
}

function executionProgressLabel(plan) {
  if (Number(plan.amount || 0) > 0) {
    return `已执行 ${moneyText(plan.executed_amount || 0, plan.asset_currency)} / ${moneyText(plan.amount, plan.asset_currency)}`
  }
  if (Number(plan.quantity || 0) > 0) {
    return `已执行 ${quantityText(plan.executed_quantity || 0)} / ${quantityText(plan.quantity)}`
  }
  if (Number(plan.executed_quantity || 0) > 0) {
    return `已执行 ${quantityText(plan.executed_quantity)}`
  }
  return '未执行'
}

function openExecuteForm(plan) {
  selectedPlanId.value = plan.id
  executeForm.price = ''
  executeForm.quantity = remainingQuantity(plan) ? String(remainingQuantity(plan)) : ''
  executeForm.partial = plan.status === 'partial'
  executeForm.currency = plan.asset_currency || 'CNY'
}

function closeExecuteForm() {
  selectedPlanId.value = null
  executeForm.price = ''
  executeForm.quantity = ''
  executeForm.partial = false
  executeForm.currency = 'CNY'
}

async function submitExecution() {
  if (!selectedPlan.value) return

  executeSubmitting.value = true
  try {
    const body = {
      price: Number(executeForm.price),
      partial: Boolean(executeForm.partial),
      currency: executeForm.currency,
    }
    if (executeForm.quantity !== '' && executeForm.quantity !== null) {
      body.quantity = Number(executeForm.quantity)
    }

    const res = await api(`/api/plans/${selectedPlan.value.id}/execute`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || '计划执行失败')
      return
    }

    toast.success('计划执行成功')
    closeExecuteForm()
    await loadData()
  } catch (error) {
    toast.error(error.message || '计划执行失败')
  } finally {
    executeSubmitting.value = false
  }
}

onMounted(async () => {
  const [assetRes, strategyRes] = await Promise.all([
    api('/api/assets'),
    api('/api/strategies'),
  ])
  const assetJson = await assetRes.json()
  const strategyJson = await strategyRes.json()
  assets.value = assetJson.data || []
  strategies.value = strategyJson.data || []
  await loadData()
})
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.filter-select {
  min-width: 140px;
  max-width: 200px;
}
.hide-mobile { display: table; }
.show-mobile { display: none !important; }
.plan-cards { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.plan-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.plan-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.plan-card-body { font-size: 13px; }
.plan-card-trigger { margin-bottom: 4px; }
.plan-card-meta { display: flex; flex-wrap: wrap; gap: 12px; color: var(--text-dim); font-size: 12px; }
.plan-card-strategy { font-size: 11px; color: var(--text-dim); margin-bottom: 4px; }
.plan-card-progress { margin-top: 8px; font-size: 12px; color: var(--text-dim); }
.plan-card-actions { margin-top: 12px; }
.plan-symbol { font-size: 11px; color: var(--text-muted); }
.plan-strategy { font-size: 12px; color: var(--text-dim); }
.plan-progress-text { font-size: 12px; color: var(--text-dim); margin-bottom: 4px; }
.plan-progress-fill { background: var(--gold); }
.plan-action-placeholder { color: var(--text-muted); }
.execute-card { overflow: visible; }
.execute-card-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.execute-summary { font-size: 13px; color: var(--text-dim); }
.execute-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.execute-item {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.execute-item span {
  font-size: 12px;
  color: var(--text-muted);
}
.execute-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: var(--text-dim);
  font-size: 14px;
}
.execute-actions {
  display: flex;
  gap: 12px;
}

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .filter-select { min-width: 0; flex: 1; }
  .execute-grid { grid-template-columns: 1fr; }
  .execute-card-header { flex-direction: column; align-items: stretch; }
  .execute-actions { flex-direction: column; }
}
</style>
