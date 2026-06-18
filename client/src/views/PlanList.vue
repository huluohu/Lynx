<template>
  <PullRefreshView :onRefresh="refreshPage">
  <div>
    <div class="page-header page-header-mobile-empty"><h1 class="page-title">{{ t('plans.title') }}</h1></div>

    <div class="card page-filter-card desktop-only">
      <div class="page-filter-grid">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('history.asset') }}</label>
            <select class="form-select" v-model="draftFilters.assetId">
              <option value="">{{ t('plans.allAssets') }}</option>
              <option v-for="a in assets" :key="a.id" :value="String(a.id)">{{ a.icon }} {{ a.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('nav.strategies') }}</label>
            <select class="form-select" v-model="draftFilters.strategyId">
              <option value="">{{ t('plans.allStrategies') }}</option>
              <option v-for="s in strategies" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('history.status') }}</label>
            <select class="form-select" v-model="draftFilters.status">
              <option value="">{{ t('plans.allStatuses') }}</option>
              <option value="pending">{{ t('plans.pending') }}</option>
              <option value="triggered">{{ t('plans.triggered') }}</option>
              <option value="partial">{{ t('plans.partial') }}</option>
              <option value="executed">{{ t('plans.executed') }}</option>
              <option value="cancelled">{{ t('plans.cancelled') }}</option>
            </select>
          </div>
        </div>
        <div class="page-filter-actions">
          <button class="btn btn-primary" @click="applyFilters">{{ t('common.apply') }}</button>
          <button class="btn" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>
      </div>
    </div>

    <div class="page-mobile-toolbar">
      <div class="page-mobile-toolbar-row">
        <div class="page-mobile-summary">{{ t('history.totalRecords', { count: filteredPlans.length }) }}</div>
      </div>
      <div v-if="activeFilterChips.length" class="page-filter-chips">
        <button v-for="chip in activeFilterChips" :key="chip.key" class="page-filter-chip" @click="removeFilter(chip.key)">
          <span>{{ chip.label }}</span>
          <span>×</span>
        </button>
      </div>
    </div>

    <div v-if="selectedPlan" class="card execute-card">
      <div class="execute-card-header">
        <div>
          <div class="section-title" style="margin-bottom:8px">{{ t('plans.executePlan') }} #{{ selectedPlan.seq || selectedPlan.id }}</div>
          <div class="execute-summary">{{ selectedPlan.asset_name }} · {{ triggerLabel(selectedPlan.trigger_type) }} {{ selectedPlan.trigger_value }}</div>
        </div>
        <button class="btn btn-sm" @click="closeExecuteForm">{{ t('plans.close') }}</button>
      </div>

      <div class="execute-grid">
        <div class="execute-item"><span>{{ t('plans.direction') }}</span><b>{{ selectedPlan.action === 'buy' ? t('plans.buy') : t('plans.sell') }}</b></div>
        <div class="execute-item"><span>{{ t('plans.plannedQuantity') }}</span><b>{{ quantityText(selectedPlan.quantity) }}</b></div>
        <div class="execute-item"><span>{{ t('plans.plannedAmount') }}</span><b>{{ moneyText(selectedPlan.amount, selectedPlan.asset_currency) }}</b></div>
        <div class="execute-item"><span>{{ t('plans.progress') }}</span><b>{{ executionProgressLabel(selectedPlan) }}</b></div>
        <div class="execute-item"><span>{{ t('plans.remainingQuantity') }}</span><b>{{ quantityText(remainingQuantity(selectedPlan)) }}</b></div>
        <div class="execute-item"><span>{{ t('plans.remainingAmount') }}</span><b>{{ moneyText(remainingAmount(selectedPlan), selectedPlan.asset_currency) }}</b></div>
      </div>

      <form @submit.prevent="submitExecution">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('plans.actualPrice') }}</label>
            <input class="form-input" type="number" step="any" min="0" v-model="executeForm.price" required />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('plans.actualQuantity') }}</label>
            <input class="form-input" type="number" step="any" min="0" v-model="executeForm.quantity" :placeholder="remainingQuantity(selectedPlan) ? String(remainingQuantity(selectedPlan)) : t('plans.actualQuantityPlaceholder')" />
          </div>
        </div>
        <label class="execute-checkbox">
          <input type="checkbox" v-model="executeForm.partial" />
          <span>{{ t('plans.partialExecute') }}</span>
        </label>
        <MobileActionBar>
          <button type="submit" class="btn btn-primary" :disabled="executeSubmitting">{{ executeSubmitting ? t('plans.executing') : t('plans.confirmExecute') }}</button>
          <button type="button" class="btn" @click="closeExecuteForm">{{ t('common.cancel') }}</button>
        </MobileActionBar>
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
        <thead><tr><th>#</th><th>{{ t('history.asset') }}</th><th>{{ t('nav.strategies') }}</th><th>{{ t('plans.triggered') }}</th><th>{{ t('plans.direction') }}</th><th>{{ t('plans.quantityLabel') }}</th><th>{{ t('plans.amountLabel') }}</th><th>{{ t('assetList.avgCost') }}</th><th>{{ t('plans.progress') }}</th><th>{{ t('history.status') }}</th><th>{{ t('common.confirm') }}</th></tr></thead>
        <tbody>
          <tr v-for="p in filteredPlans" :key="p.id">
            <td>{{ p.seq }}</td>
            <td><span class="icon-text">{{ p.asset_name }}</span> <span class="plan-symbol">{{ p.symbol }}</span></td>
            <td class="plan-strategy">{{ strategyName(p.strategy_id) }}</td>
            <td>{{ triggerLabel(p.trigger_type) }} <b>{{ p.trigger_value }}</b></td>
             <td><span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'">{{ p.action==='buy'?t('plans.buy'):t('plans.sell') }}</span></td>
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
               <button v-if="canExecute(p)" class="btn btn-sm btn-primary" @click="openExecuteForm(p)">{{ t('plans.execute') }}</button>
              <span v-else class="plan-action-placeholder">-</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="show-mobile plan-cards">
        <div v-for="p in filteredPlans" :key="p.id" class="plan-card">
          <div class="plan-card-header">
             <span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'">{{ p.action==='buy'?t('plans.buy'):t('plans.sell') }}</span>
            <span style="font-weight:600">{{ p.asset_name }}</span>
            <span class="badge" :class="statusBadge(p.status)" style="margin-left:auto">{{ statusLabel(p.status) }}</span>
          </div>
          <div class="plan-card-body">
            <div class="plan-card-strategy">{{ strategyName(p.strategy_id) }}</div>
            <div class="plan-card-trigger">{{ triggerLabel(p.trigger_type) }} <b>{{ p.trigger_value }}</b></div>
            <div class="plan-card-meta">
               <span v-if="p.quantity">{{ t('plans.quantityLabel') }}: {{ quantityText(p.quantity) }}</span>
               <span v-if="p.amount">{{ t('plans.amountLabel') }}: {{ moneyText(p.amount, p.asset_currency) }}</span>
               <span v-if="p.new_avg_cost">{{ t('plans.avgCostArrow') }}{{ moneyText(p.new_avg_cost, p.asset_currency) }}</span>
            </div>
            <div class="plan-card-progress">{{ executionProgressLabel(p) }}</div>
            <div v-if="Number(p.quantity || 0) > 0" class="progress-bar">
              <div class="progress-fill plan-progress-fill" :style="{ width: `${executionRatio(p)}%` }"></div>
            </div>
            <div v-if="canExecute(p)" class="plan-card-actions">
               <button class="btn btn-sm btn-primary" @click="openExecuteForm(p)">{{ t('plans.execute') }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="card empty"><div class="empty-icon"><AppIcon name="plans" size="34" /></div><p>{{ t('plans.noPlans') }}</p></div>

    <AppDrawer v-model="filterDrawerOpen" :title="t('common.filter')">
      <div class="form-group">
        <label class="form-label">{{ t('history.asset') }}</label>
        <select class="form-select" v-model="draftFilters.assetId">
          <option value="">{{ t('plans.allAssets') }}</option>
          <option v-for="a in assets" :key="a.id" :value="String(a.id)">{{ a.icon }} {{ a.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('nav.strategies') }}</label>
        <select class="form-select" v-model="draftFilters.strategyId">
          <option value="">{{ t('plans.allStrategies') }}</option>
          <option v-for="s in strategies" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('history.status') }}</label>
        <select class="form-select" v-model="draftFilters.status">
          <option value="">{{ t('plans.allStatuses') }}</option>
          <option value="pending">{{ t('plans.pending') }}</option>
          <option value="triggered">{{ t('plans.triggered') }}</option>
          <option value="partial">{{ t('plans.partial') }}</option>
          <option value="executed">{{ t('plans.executed') }}</option>
          <option value="cancelled">{{ t('plans.cancelled') }}</option>
        </select>
      </div>
      <template #footer>
        <div class="plan-filter-actions">
          <button class="btn" @click="resetDraftFilters">{{ t('common.reset') }}</button>
          <button class="btn btn-primary" @click="applyFilters">{{ t('common.apply') }}</button>
        </div>
      </template>
    </AppDrawer>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { currencySymbol } from '../utils/currency.js'
import { formatNumber } from '../utils/formatters.js'
import MobileActionBar from '../components/MobileActionBar.vue'
import AppDrawer from '../components/AppDrawer.vue'
import PullRefreshView from '../components/PullRefreshView.vue'
import AppIcon from '../components/AppIcon.vue'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'

const toast = useToast()
const { t } = useI18n()
const plans = ref([])
const assets = ref([])
const strategies = ref([])
const loading = ref(true)
const filterDrawerOpen = ref(false)
const filters = reactive({ assetId: '', strategyId: '', status: '' })
const draftFilters = reactive({ assetId: '', strategyId: '', status: '' })
const selectedPlanId = ref(null)
const executeSubmitting = ref(false)
const executeForm = reactive({ price: '', quantity: '', partial: false, currency: 'CNY' })
const mobilePageActions = useMobilePageActions()

const filteredPlans = computed(() => {
  let result = plans.value
  if (filters.status) {
    result = result.filter(p => p.status === filters.status)
  }
  return result
})
const activeFilterCount = computed(() => ['assetId', 'strategyId', 'status'].filter((key) => filters[key]).length)
const activeFilterChips = computed(() => ([
  filters.assetId ? { key: 'assetId', label: assets.value.find((asset) => String(asset.id) === filters.assetId)?.name || filters.assetId } : null,
  filters.strategyId ? { key: 'strategyId', label: strategies.value.find((strategy) => String(strategy.id) === filters.strategyId)?.name || filters.strategyId } : null,
  filters.status ? { key: 'status', label: statusLabel(filters.status) } : null,
].filter(Boolean)))

const selectedPlan = computed(() => plans.value.find(p => String(p.id) === String(selectedPlanId.value)) || null)

async function loadData() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.assetId) params.set('asset_id', filters.assetId)
    if (filters.strategyId) params.set('strategy_id', filters.strategyId)
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

async function refreshPage() {
  const [assetRes, strategyRes] = await Promise.all([
    api('/api/assets'),
    api('/api/strategies'),
  ])
  const assetJson = await assetRes.json()
  const strategyJson = await strategyRes.json()
  assets.value = assetJson.data || []
  strategies.value = strategyJson.data || []
  await loadData()
}

function syncDraftFilters() {
  draftFilters.assetId = filters.assetId
  draftFilters.strategyId = filters.strategyId
  draftFilters.status = filters.status
}

function resetDraftFilters() {
  draftFilters.assetId = ''
  draftFilters.strategyId = ''
  draftFilters.status = ''
}

async function applyFilters() {
  filters.assetId = draftFilters.assetId
  filters.strategyId = draftFilters.strategyId
  filters.status = draftFilters.status
  filterDrawerOpen.value = false
  await loadData()
}

async function resetFilters() {
  filters.assetId = ''
  filters.strategyId = ''
  filters.status = ''
  syncDraftFilters()
  filterDrawerOpen.value = false
  await loadData()
}

async function removeFilter(key) {
  filters[key] = ''
  syncDraftFilters()
  await loadData()
}

watchEffect(() => {
  mobilePageActions.setActions([
    {
      key: 'filter-plans',
      label: activeFilterCount.value ? `${t('common.filter')} (${activeFilterCount.value})` : t('common.filter'),
      onSelect: () => { filterDrawerOpen.value = true },
    },
    activeFilterCount.value ? {
      key: 'reset-plan-filters',
      label: t('common.reset'),
      onSelect: resetFilters,
    } : null,
  ])
})

function strategyName(id) {
  const s = strategies.value.find(strategy => strategy.id === id)
  return s ? s.name : t('plans.strategyFallback', { id })
}

function triggerLabel(type) {
  return { price_above: '≥', price_below: '≤', time: t('plans.timeTrigger') }[type] || type
}

function statusLabel(status) {
  return { pending: t('plans.pending'), triggered: t('plans.triggered'), partial: t('plans.partial'), executed: t('plans.executed'), cancelled: t('plans.cancelled') }[status] || status
}

function statusBadge(status) {
  return { pending: 'badge-pending', triggered: 'badge-triggered', partial: 'badge-partial', executed: 'badge-executed', cancelled: 'badge-sell' }[status] || ''
}

function canExecute(plan) {
  const planSetExecutable = !plan.plan_set_id || plan.plan_set_status === 'active'
  return planSetExecutable && ['pending', 'triggered', 'partial'].includes(plan.status)
}

function quantityText(value) {
  if (value === null || value === undefined || value === '') return '-'
  return formatNumber(value, { maximumFractionDigits: 4 })
}

function moneyText(value, currency = 'CNY') {
  if (value === null || value === undefined || value === '') return '-'
  const symbol = currencySymbol(currency)
  const prefix = symbol.length > 1 ? `${symbol} ` : symbol
  return `${prefix}${formatNumber(value, { maximumFractionDigits: 2 })}`
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
    return t('plans.executedProgressAmount', { done: moneyText(plan.executed_amount || 0, plan.asset_currency), total: moneyText(plan.amount, plan.asset_currency) })
  }
  if (Number(plan.quantity || 0) > 0) {
    return t('plans.executedProgressQuantity', { done: quantityText(plan.executed_quantity || 0), total: quantityText(plan.quantity) })
  }
  if (Number(plan.executed_quantity || 0) > 0) {
    return t('plans.executedQuantityOnly', { done: quantityText(plan.executed_quantity) })
  }
  return t('plans.notExecuted')
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
      toast.error(json.error || t('plans.executeFailed'))
      return
    }

    toast.success(t('plans.executeSuccess'))
    closeExecuteForm()
    await loadData()
  } catch (error) {
    toast.error(error.message || t('plans.executeFailed'))
  } finally {
    executeSubmitting.value = false
  }
}

onMounted(async () => {
  syncDraftFilters()
  await refreshPage()
})
onUnmounted(() => {
  mobilePageActions.clearActions()
})
watch(filterDrawerOpen, (open) => {
  if (open) syncDraftFilters()
})
</script>

<style scoped>
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
.plan-filter-actions {
  display: flex;
  gap: 12px;
}
.plan-filter-actions .btn {
  flex: 1;
}

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .execute-card { margin-bottom: 120px; }
  .execute-grid { grid-template-columns: 1fr; }
  .execute-card-header { flex-direction: column; align-items: stretch; }
}
</style>
