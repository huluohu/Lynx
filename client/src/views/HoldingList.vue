<template>
  <PullRefreshView :onRefresh="loadData">
  <div>
    <div class="page-header page-header-mobile-empty">
      <h1 class="page-title">{{ t('holdings.title') }}</h1>
    </div>

    <div class="card page-filter-card desktop-only">
      <div class="page-filter-grid">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('common.search') }}</label>
            <input class="form-input" v-model="draftFilters.keyword" :placeholder="t('common.search')" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('history.type') }}</label>
            <select class="form-select" v-model="draftFilters.type">
              <option value="">{{ t('history.allTypes') }}</option>
              <option value="precious_metal">{{ t('assets.types.precious_metal') }}</option>
              <option value="crypto">{{ t('assets.types.crypto') }}</option>
              <option value="stock">{{ t('assets.types.stock') }}</option>
              <option value="forex">{{ t('assets.types.forex') }}</option>
              <option value="commodity">{{ t('assets.types.commodity') }}</option>
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
        <div class="page-mobile-summary">{{ t('history.totalRecords', { count: filteredHoldings.length }) }}</div>
      </div>
      <div v-if="activeFilterChips.length" class="page-filter-chips">
        <button v-for="chip in activeFilterChips" :key="chip.key" class="page-filter-chip" @click="removeFilter(chip.key)">
          <span>{{ chip.label }}</span>
          <span>×</span>
        </button>
      </div>
    </div>

    <div class="card" v-if="filteredHoldings.length">
      <!-- Desktop table -->
      <table class="hide-mobile">
        <thead><tr><th>{{ t('holdings.asset') }}</th><th>{{ t('holdings.quantity') }}</th><th>{{ t('holdings.avgCost') }}</th><th>{{ t('holdings.totalInvested') }}</th><th>{{ t('holdings.currentPrice') }}</th><th>{{ t('holdings.marketValue') }}</th><th>{{ t('holdings.pnl') }}</th><th>{{ t('holdings.status') }}</th></tr></thead>
        <tbody>
          <tr v-for="h in filteredHoldings" :key="h.id" style="cursor:pointer" @click="openDetail(h)">
            <td><span class="icon-text"><span class="icon">{{ h.icon }}</span> {{ h.name }}</span> <span style="color:var(--text-dim);font-size:12px">{{ h.symbol }}</span></td>
            <td style="font-weight:600">{{ h.quantity }}</td>
            <td>{{ money(h.avg_cost, h.currency) }}</td>
            <td>{{ money(h.total_invested, h.currency) }}</td>
            <td>{{ h.current_price ? money(h.current_price, h.currency) : '-' }}</td>
            <td>{{ h.current_price ? money(h.quantity * h.current_price, h.currency) : '-' }}</td>
            <td :style="{ color: pnlColor(h), fontWeight: 600 }">{{ pnlText(h) }}</td>
             <td><span class="badge" :class="h.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ h.status === 'active' ? t('holdings.statusActive') : t('holdings.statusClosed') }}</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile holding-cards">
        <SwipeActionItem v-for="h in filteredHoldings" :key="h.id" :actionWidth="148">
          <div class="holding-card" @click="openDetail(h)">
            <div class="holding-card-top">
              <span class="icon-text" style="font-weight:600"><span class="icon">{{ h.icon }}</span> {{ h.name }}</span>
              <span :style="{ color: pnlColor(h), fontWeight: 600, fontSize: '13px' }">{{ pnlText(h) }}</span>
            </div>
            <div class="holding-card-body">
               <div><span class="meta-label">{{ t('holdings.quantity') }}</span> {{ h.quantity }}</div>
               <div><span class="meta-label">{{ t('holdings.avgCost') }}</span> {{ money(h.avg_cost, h.currency) }}</div>
               <div><span class="meta-label">{{ t('holdings.currentPrice') }}</span> {{ h.current_price ? money(h.current_price, h.currency) : '-' }}</div>
               <div><span class="meta-label">{{ t('holdings.marketValue') }}</span> {{ h.current_price ? money(h.quantity * h.current_price, h.currency) : '-' }}</div>
            </div>
          </div>
          <template #actions>
            <button class="swipe-action-btn" @click="openEdit(h)">{{ t('holdings.editShort') }}</button>
            <button class="swipe-action-btn primary" @click="openTx(h)">{{ t('holdings.tradeShort') }}</button>
          </template>
        </SwipeActionItem>
      </div>
    </div>
    <div v-else-if="!loading" class="card empty">
      <div class="empty-icon"><AppIcon name="holdings" size="34" /></div><p>{{ t('holdings.empty') }}</p>
    </div>
    <div v-else class="card">
      <div class="skeleton-card" style="margin-bottom:8px" v-for="i in 3" :key="i">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="skeleton" style="width:24px;height:24px;border-radius:50%"></div>
          <div class="skeleton skeleton-text" style="width:100px"></div>
          <div class="skeleton skeleton-text short" style="margin-left:auto"></div>
        </div>
      </div>
    </div>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetail" :title="currentHolding?.name || t('holdings.detailTitle')" mobileHeight="fixed">
      <div v-if="currentHolding" class="info-list">
        <div class="info-row"><span class="info-label">{{ t('holdings.asset') }}</span><span class="icon-text"><span class="icon">{{ currentHolding.icon }}</span> {{ currentHolding.name }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.quantity') }}</span><span style="font-weight:600">{{ currentHolding.quantity }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.avgCost') }}</span><span>{{ money(currentHolding.avg_cost, currentHolding.currency) }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.totalInvested') }}</span><span>{{ money(currentHolding.total_invested, currentHolding.currency) }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.currentPrice') }}</span><span>{{ currentHolding.current_price ? money(currentHolding.current_price, currentHolding.currency) : t('holdings.unavailable') }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.marketValue') }}</span><span>{{ currentHolding.current_price ? money(currentHolding.quantity * currentHolding.current_price, currentHolding.currency) : '-' }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.pnl') }}</span><span :style="{ color: pnlColor(currentHolding), fontWeight: 600 }">{{ pnlText(currentHolding) }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.targetPrice') }}</span><span>{{ currentHolding.target_price ? money(currentHolding.target_price, currentHolding.currency) : '-' }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('holdings.stopLoss') }}</span><span style="color:var(--red)">{{ currentHolding.stop_loss ? money(currentHolding.stop_loss, currentHolding.currency) : '-' }}</span></div>
      </div>
    </AppDrawer>

    <AppDrawer v-model="showEditDrawer" :title="currentHolding?.name || t('holdings.editSectionTitle')" mobileHeight="fixed">
      <form id="holding-edit-form" @submit.prevent="saveHolding">
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('holdings.quantity') }}</label><input class="form-input" type="number" step="any" v-model="editHolding.quantity" /></div>
          <div class="form-group"><label class="form-label">{{ t('holdings.avgCost') }}</label><input class="form-input" type="number" step="any" v-model="editHolding.avg_cost" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('holdings.totalInvested') }}</label><input class="form-input" type="number" step="any" v-model="editHolding.total_invested" /></div>
          <div class="form-group">
            <label class="form-label">{{ t('history.currency') }}</label>
            <select class="form-select" v-model="editHolding.currency">
              <option value="CNY">{{ t('assets.currencyCny') }}</option>
              <option value="USD">{{ t('assets.currencyUsd') }}</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('holdings.targetPrice') }}</label><input class="form-input" type="number" step="any" v-model="editHolding.target_price" /></div>
          <div class="form-group"><label class="form-label">{{ t('holdings.stopLoss') }}</label><input class="form-input" type="number" step="any" v-model="editHolding.stop_loss" /></div>
        </div>
      </form>
      <template #footer>
        <div class="holding-edit-footer-actions">
          <button type="button" class="btn" @click="showEditDrawer = false">{{ t('common.cancel') }}</button>
          <button type="submit" form="holding-edit-form" class="btn btn-primary" :disabled="savingHolding">{{ t('holdings.save') }}</button>
        </div>
      </template>
    </AppDrawer>

    <AppDrawer v-model="showTxDrawer" :title="`+ ${t('holdings.quickRecord')}`" mobileHeight="fixed">
      <TransactionForm v-if="currentHolding" :asset-id="currentHolding.asset_id" @success="onTxSuccess" @cancel="showTxDrawer = false" />
    </AppDrawer>

    <AppDrawer v-model="filterDrawerOpen" :title="t('common.filter')">
      <div class="form-group">
        <label class="form-label">{{ t('common.search') }}</label>
        <input class="form-input" v-model="draftFilters.keyword" :placeholder="t('common.search')" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('history.type') }}</label>
        <select class="form-select" v-model="draftFilters.type">
          <option value="">{{ t('history.allTypes') }}</option>
          <option value="precious_metal">{{ t('assets.types.precious_metal') }}</option>
          <option value="crypto">{{ t('assets.types.crypto') }}</option>
          <option value="stock">{{ t('assets.types.stock') }}</option>
          <option value="forex">{{ t('assets.types.forex') }}</option>
          <option value="commodity">{{ t('assets.types.commodity') }}</option>
        </select>
      </div>
      <template #footer>
        <div class="holding-filter-actions">
          <button class="btn" @click="resetDraftFilters">{{ t('common.reset') }}</button>
          <button class="btn btn-primary" @click="applyFilters">{{ t('common.apply') }}</button>
        </div>
      </template>
    </AppDrawer>

  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, reactive, watch, watchEffect, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { formatCurrencyAmount, formatSignedCurrencyAmount } from '../utils/currency.js'
import AppDrawer from '../components/AppDrawer.vue'
import SwipeActionItem from '../components/SwipeActionItem.vue'
import TransactionForm from '../components/TransactionForm.vue'
import PullRefreshView from '../components/PullRefreshView.vue'
import AppIcon from '../components/AppIcon.vue'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'

const toast = useToast()
const { t } = useI18n()
const holdings = ref([])
const loading = ref(true)
const showDetail = ref(false)
const showEditDrawer = ref(false)
const showTxDrawer = ref(false)
const filterDrawerOpen = ref(false)
const currentHolding = ref(null)
const editHolding = reactive({ quantity: '', avg_cost: '', total_invested: '', currency: '', target_price: '', stop_loss: '' })
const savingHolding = ref(false)
const filters = reactive({ keyword: '', type: '' })
const draftFilters = reactive({ keyword: '', type: '' })
const mobilePageActions = useMobilePageActions()

const filteredHoldings = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return holdings.value.filter((holding) => {
    const matchesKeyword = !keyword || [holding.name, holding.symbol].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
    const matchesType = !filters.type || holding.type === filters.type || (filters.type === 'precious_metal' && holding.type === 'gold')
    return matchesKeyword && matchesType
  })
})

const activeFilterCount = computed(() => ['keyword', 'type'].filter((key) => filters[key]).length)
const activeFilterChips = computed(() => ([
  filters.keyword ? { key: 'keyword', label: filters.keyword } : null,
  filters.type ? { key: 'type', label: t(`assets.types.${filters.type}`) } : null,
].filter(Boolean)))

watch([() => editHolding.quantity, () => editHolding.avg_cost], ([qty, cost]) => {
  if (qty && cost) {
    editHolding.total_invested = (Number(qty) * Number(cost)).toFixed(2)
  }
})

async function loadData() {
  try {
    const res = await api('/api/holdings')
    const json = await res.json()
    holdings.value = json.data || []
  } finally { loading.value = false }
}

function syncDraftFilters() {
  draftFilters.keyword = filters.keyword
  draftFilters.type = filters.type
}

function resetDraftFilters() {
  draftFilters.keyword = ''
  draftFilters.type = ''
}

function applyFilters() {
  filters.keyword = draftFilters.keyword
  filters.type = draftFilters.type
  filterDrawerOpen.value = false
}

function resetFilters() {
  filters.keyword = ''
  filters.type = ''
  syncDraftFilters()
  filterDrawerOpen.value = false
}

function removeFilter(key) {
  filters[key] = ''
  syncDraftFilters()
}

watchEffect(() => {
  mobilePageActions.setActions([
    {
      key: 'filter-holdings',
      label: activeFilterCount.value ? `${t('common.filter')} (${activeFilterCount.value})` : t('common.filter'),
      onSelect: () => { filterDrawerOpen.value = true },
    },
    activeFilterCount.value ? {
      key: 'reset-holding-filters',
      label: t('common.reset'),
      onSelect: resetFilters,
    } : null,
  ])
})

function openDetail(h) {
  currentHolding.value = h
  hydrateEditHolding(h)
  showDetail.value = true
}

function openEdit(h) {
  currentHolding.value = h
  hydrateEditHolding(h)
  showEditDrawer.value = true
}

function openTx(h) {
  currentHolding.value = h
  hydrateEditHolding(h)
  showTxDrawer.value = true
}

function hydrateEditHolding(h) {
  editHolding.quantity = h.quantity || ''
  editHolding.avg_cost = h.avg_cost || ''
  editHolding.total_invested = h.total_invested || ''
  editHolding.currency = h.currency || 'CNY'
  editHolding.target_price = h.target_price || ''
  editHolding.stop_loss = h.stop_loss || ''
}

function onTxSuccess() {
  showTxDrawer.value = false
  toast.success(t('holdings.tradeRecorded'))
  loadData()
}

async function saveHolding() {
  savingHolding.value = true
  try {
    const payload = {
      quantity: editHolding.quantity ? Number(editHolding.quantity) : undefined,
      avg_cost: editHolding.avg_cost ? Number(editHolding.avg_cost) : undefined,
      total_invested: editHolding.total_invested ? Number(editHolding.total_invested) : undefined,
      target_price: editHolding.target_price ? Number(editHolding.target_price) : null,
      stop_loss: editHolding.stop_loss ? Number(editHolding.stop_loss) : null,
      currency: editHolding.currency || undefined,
    }
    const res = await api(`/api/holdings/${currentHolding.value.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    if (json.success) { toast.success(t('holdings.saved')); showEditDrawer.value = false; loadData() }
    else toast.error(json.error || t('common.saveFailed'))
  } catch (e) { toast.error(e.message) }
  savingHolding.value = false
}

function money(value, currency) {
  return formatCurrencyAmount(value, currency, { maximumFractionDigits: 2 })
}
function pnl(h) {
  if (!h.current_price || !h.total_invested) return null
  return h.quantity * h.current_price - h.total_invested
}
function pnlPct(h) {
  if (!h.current_price || !h.total_invested) return null
  return ((h.quantity * h.current_price - h.total_invested) / h.total_invested) * 100
}
function pnlColor(h) {
  const v = pnl(h)
  if (v === null) return 'var(--text-dim)'
  return v >= 0 ? 'var(--market-positive)' : 'var(--market-negative)'
}
function pnlText(h) {
  const v = pnl(h)
  if (v === null) return '-'
  const pct = pnlPct(h)
  const sign = v >= 0 ? '+' : ''
  return `${formatSignedCurrencyAmount(v, h?.currency, { maximumFractionDigits: 2 })} (${sign}${pct.toFixed(1)}%)`
}
onMounted(() => {
  syncDraftFilters()
  loadData()
})
onUnmounted(() => {
  mobilePageActions.clearActions()
})
watch(filterDrawerOpen, (open) => {
  if (open) syncDraftFilters()
})
</script>

<style scoped>
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }
.hide-mobile { display: table; }
.show-mobile { display: none !important; }

.holding-cards { flex-direction: column; gap: 8px; }
.holding-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; cursor: pointer; transition: background 0.15s; }
.holding-card:active { background: var(--bg-hover); }
.holding-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.holding-card-body { display: flex; gap: 16px; font-size: 13px; flex-wrap: wrap; }
.meta-label { color: var(--text-muted); font-size: 11px; }
.swipe-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 0 74px;
  min-width: 74px;
  height: 100%;
  padding: 0 8px;
  border: none;
  border-left: 1px solid var(--swipe-action-divider);
  background: var(--swipe-action-bg);
  color: var(--swipe-action-text);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
}
.swipe-action-btn.primary {
  background: var(--swipe-action-primary-bg);
  color: var(--swipe-action-primary-text);
}
.holding-edit-footer-actions,
.holding-filter-actions {
  display: flex;
  gap: 12px;
}
.holding-edit-footer-actions .btn,
.holding-filter-actions .btn {
  flex: 1;
}

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .holding-card-body { gap: 8px; }
}
</style>
