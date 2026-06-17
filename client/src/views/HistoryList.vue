<template>
  <PullRefreshView :onRefresh="loadData">
  <div>
    <div class="page-header page-header-mobile-empty">
      <h1 class="page-title">{{ t('history.title') }}</h1>
      <div class="page-header-right">
        <div class="page-header-actions">
          <button class="btn btn-primary" @click="showForm = true">+ {{ t('history.addRecord') }}</button>
        </div>
      </div>
    </div>

    <div class="card page-filter-card desktop-only">
      <div class="page-filter-grid">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('history.asset') }}</label>
            <select class="form-select" v-model="filters.asset_id">
              <option value="">{{ t('history.allAssets') }}</option>
              <option v-for="a in assets" :key="a.id" :value="String(a.id)">{{ a.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('history.type') }}</label>
            <select class="form-select" v-model="filters.type">
              <option value="">{{ t('history.allTypes') }}</option>
              <option value="buy">{{ t('history.buy') }}</option>
              <option value="sell">{{ t('history.sell') }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('history.status') }}</label>
            <select class="form-select" v-model="filters.status">
              <option value="">{{ t('history.allStatuses') }}</option>
              <option value="active">{{ t('history.effective') }}</option>
              <option value="reverted">{{ t('history.reverted') }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('history.currency') }}</label>
            <select class="form-select" v-model="filters.currency">
              <option value="">{{ t('history.allCurrencies') }}</option>
              <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('history.startDate') }}</label>
            <input class="form-input" type="date" v-model="filters.start_date" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('history.endDate') }}</label>
            <input class="form-input" type="date" v-model="filters.end_date" />
          </div>
        </div>
        <div class="page-filter-actions">
          <button class="btn btn-primary" @click="loadData">{{ t('common.apply') }}</button>
          <button class="btn" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>
      </div>
    </div>

    <div class="page-mobile-toolbar">
      <div class="page-mobile-toolbar-row">
        <div class="page-mobile-summary">{{ t('history.totalRecords', { count: totalCount }) }}</div>
      </div>
      <div v-if="activeFilterChips.length" class="page-filter-chips">
        <button v-for="chip in activeFilterChips" :key="chip.key" class="page-filter-chip" @click="removeFilter(chip.key)">
          <span>{{ chip.label }}</span>
          <span>×</span>
        </button>
      </div>
    </div>

    <div class="card" v-if="showForm" style="max-width:540px;margin-bottom:20px">
      <div class="section-title">{{ t('history.recordTrade') }}</div>
      <form @submit.prevent="addRecord">
        <div class="form-row">
          <div class="form-group">
              <label class="form-label">{{ t('history.asset') }}</label>
            <select class="form-select" v-model="form.asset_id" required>
                <option value="">{{ t('history.selectAsset') }}</option>
              <option v-for="a in assets" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="form-group">
              <label class="form-label">{{ t('history.type') }}</label>
            <select class="form-select" v-model="form.type" required>
                <option value="buy">{{ t('history.buy') }}</option>
                <option value="sell">{{ t('history.sell') }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('holdings.quantity') }}</label><input class="form-input" type="number" step="any" v-model="form.quantity" required /></div>
          <div class="form-group"><label class="form-label">{{ t('history.price') }}</label><input class="form-input" type="number" step="any" v-model="form.price" required /></div>
        </div>
        <div v-if="showCurrencyField" class="form-group">
          <label class="form-label">{{ t('history.currency') }}</label>
          <select class="form-select" v-model="form.currency">
            <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
          </select>
          <div class="currency-help">{{ t('history.currencyHelp') }}</div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('history.total') }}</label><input class="form-input" type="number" step="any" v-model="form.total" /></div>
          <div class="form-group"><label class="form-label">{{ t('history.date') }}</label><input class="form-input" type="date" v-model="form.executed_at" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('holdings.pnl') }}</label><input class="form-input" type="number" step="any" v-model="form.pnl" /></div>
          <div class="form-group"><label class="form-label">{{ t('history.pnlRate') }}</label><input class="form-input" type="number" step="any" v-model="form.pnl_pct" /></div>
        </div>
        <div class="form-group"><label class="form-label">{{ t('history.reason') }}</label><textarea class="form-textarea" v-model="form.reason" :placeholder="t('history.reasonPlaceholder')"></textarea></div>
        <div style="display:flex;gap:12px">
          <button type="submit" class="btn btn-primary" :disabled="submitting">{{ t('history.save') }}</button>
          <button type="button" class="btn" @click="showForm=false">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </div>

    <div class="card" v-if="history.length">
      <table class="hide-mobile">
        <thead><tr><th>{{ t('history.date') }}</th><th>{{ t('history.asset') }}</th><th>{{ t('history.type') }}</th><th>{{ t('holdings.quantity') }}</th><th>{{ t('history.price') }}</th><th>{{ t('history.total') }}</th><th>{{ t('holdings.pnl') }}</th><th>{{ t('common.confirm') }}</th></tr></thead>
        <tbody>
          <tr v-for="h in history" :key="h.id" class="history-row" :class="{ 'reverted-row': h.reverted }" @click="openDetail(h)">
            <td>{{ h.executed_at?.slice(0,10) }}</td>
            <td>{{ h.asset_name }}</td>
            <td>
              <div class="history-type-cell">
                <span class="badge" :class="h.type==='buy'?'badge-buy':'badge-sell'">{{ h.type==='buy'?t('history.buy'):t('history.sell') }}</span>
                <span v-if="h.reverted" class="badge badge-sell">{{ t('history.reverted') }}</span>
              </div>
            </td>
            <td>{{ h.quantity }}</td>
            <td>{{ moneyPrefix(h.currency) }}{{ fmt(h.price, 8) }}</td>
            <td>{{ moneyPrefix(h.currency) }}{{ fmt(h.total) }}</td>
            <td :class="(h.pnl||0)>=0?'pnl positive':'pnl negative'">{{ h.pnl ? (h.pnl>=0?'+':'') + moneyPrefix(h.currency) + fmt(Math.abs(h.pnl)) : '-' }}</td>
            <td>
              <div class="history-actions">
                 <button v-if="!h.reverted" class="btn btn-sm btn-danger" @click.stop="openUndoDialog(h)">{{ t('history.undo') }}</button>
                 <button v-else class="btn btn-sm btn-danger" @click.stop="confirmDelete(h)">{{ t('history.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="show-mobile history-cards">
        <SwipeActionItem v-for="h in history" :key="h.id" :actionWidth="72">
          <div class="history-card" :class="{ 'reverted-card': h.reverted }" @click="openDetail(h)">
            <div class="history-card-header">
              <div>
                <div class="history-card-title">
                  <span style="font-weight:600">{{ h.asset_name }}</span>
                  <span class="badge" :class="h.type==='buy'?'badge-buy':'badge-sell'">{{ h.type==='buy'?t('history.buy'):t('history.sell') }}</span>
                  <span v-if="h.reverted" class="badge badge-sell">{{ t('history.reverted') }}</span>
                </div>
                <div class="history-card-meta">{{ h.executed_at?.slice(0,10) }} · {{ h.quantity }} × {{ moneyPrefix(h.currency) }}{{ fmt(h.price, 8) }}</div>
              </div>
              <div class="history-card-total">{{ moneyPrefix(h.currency) }}{{ fmt(h.total) }}</div>
            </div>
            <div class="history-card-body">
              <span class="history-card-currency">{{ h.currency || 'CNY' }}</span>
              <span v-if="h.pnl" :class="(h.pnl||0)>=0?'pnl positive':'pnl negative'">{{ h.pnl>=0?'+':'' }}{{ moneyPrefix(h.currency) }}{{ fmt(Math.abs(h.pnl)) }}</span>
            </div>
            <div v-if="h.reason" class="history-card-reason">{{ h.reason }}</div>
          </div>
          <template #actions>
            <button v-if="!h.reverted" class="swipe-action-btn danger" @click="openUndoDialog(h)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               {{ t('history.undo') }}
            </button>
            <button v-else class="swipe-action-btn danger" @click="confirmDelete(h)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
               {{ t('history.delete') }}
            </button>
          </template>
        </SwipeActionItem>
      </div>
    </div>
    <div v-else-if="loading" class="card">
      <div class="skeleton-card" style="margin-bottom:8px" v-for="i in 3" :key="i">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="skeleton skeleton-badge"></div>
          <div class="skeleton skeleton-text" style="width:100px"></div>
          <div class="skeleton skeleton-text short" style="margin-left:auto"></div>
        </div>
      </div>
    </div>
    <div v-else class="card empty"><div class="empty-icon">📝</div><p>{{ t('history.empty') }}</p></div>

    <AppDrawer v-model="showDetailDrawer" :title="detailRecord ? `${detailRecord.asset_name} - ${detailRecord.type==='buy'?t('history.buy'):t('history.sell')}` : t('history.detailTitle')">
      <div v-if="detailRecord" class="detail-drawer-content">
        <div class="detail-section">
          <div class="detail-row"><span>{{ t('history.asset') }}</span><span style="font-weight:600">{{ detailRecord.asset_name }}</span></div>
          <div class="detail-row"><span>{{ t('history.type') }}</span><span class="badge" :class="detailRecord.type==='buy'?'badge-buy':'badge-sell'">{{ detailRecord.type==='buy'?t('history.buy'):t('history.sell') }}</span></div>
          <div class="detail-row"><span>{{ t('history.status') }}</span><span class="badge" :class="detailRecord.reverted ? 'badge-sell' : 'badge-executed'">{{ detailRecord.reverted ? t('history.reverted') : t('history.effective') }}</span></div>
          <div class="detail-row"><span>{{ t('history.date') }}</span><span>{{ formatDate(detailRecord.executed_at) }}</span></div>
        </div>
        <div class="detail-section">
          <div class="detail-section-title">{{ t('history.tradeData') }}</div>
          <div class="detail-row"><span>{{ t('holdings.quantity') }}</span><b>{{ detailRecord.quantity }}</b></div>
          <div class="detail-row"><span>{{ t('history.currency') }}</span><span>{{ detailRecord.currency || 'CNY' }}</span></div>
          <div class="detail-row"><span>{{ t('history.price') }}</span><span>{{ moneyPrefix(detailRecord.currency) }}{{ fmt(detailRecord.price, 8) }}</span></div>
          <div class="detail-row"><span>{{ t('history.total') }}</span><span>{{ moneyPrefix(detailRecord.currency) }}{{ fmt(detailRecord.total) }}</span></div>
          <div class="detail-row" v-if="detailRecord.reverted_at"><span>{{ t('history.revertedAt') }}</span><span>{{ formatDate(detailRecord.reverted_at) }}</span></div>
          <div class="detail-row" v-if="detailRecord.pnl"><span>{{ t('holdings.pnl') }}</span><span :class="(detailRecord.pnl||0)>=0?'pnl positive':'pnl negative'">{{ detailRecord.pnl>=0?'+':'' }}{{ moneyPrefix(detailRecord.currency) }}{{ fmt(Math.abs(detailRecord.pnl)) }}</span></div>
          <div class="detail-row" v-if="detailRecord.pnl_pct"><span>{{ t('history.pnlRate') }}</span><span :class="(detailRecord.pnl_pct||0)>=0?'pnl positive':'pnl negative'">{{ detailRecord.pnl_pct>=0?'+':'' }}{{ detailRecord.pnl_pct }}%</span></div>
        </div>
        <div v-if="detailRecord.reason" class="detail-section">
          <div class="detail-section-title">{{ t('history.reason') }}</div>
          <div style="padding:10px 14px;font-size:14px;color:var(--text-dim);line-height:1.5">{{ detailRecord.reason }}</div>
        </div>
      </div>
      <template #footer v-if="detailRecord?.reverted">
        <button class="btn btn-danger" style="width:100%" @click="confirmDelete(detailRecord)">{{ t('history.deleteRevertedRecord') }}</button>
      </template>
    </AppDrawer>

    <AppDrawer v-model="filterDrawerOpen" :title="t('common.filter')">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ t('history.asset') }}</label>
          <select class="form-select" v-model="draftFilters.asset_id">
            <option value="">{{ t('history.allAssets') }}</option>
            <option v-for="a in assets" :key="a.id" :value="String(a.id)">{{ a.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('history.type') }}</label>
          <select class="form-select" v-model="draftFilters.type">
            <option value="">{{ t('history.allTypes') }}</option>
            <option value="buy">{{ t('history.buy') }}</option>
            <option value="sell">{{ t('history.sell') }}</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ t('history.status') }}</label>
          <select class="form-select" v-model="draftFilters.status">
            <option value="">{{ t('history.allStatuses') }}</option>
            <option value="active">{{ t('history.effective') }}</option>
            <option value="reverted">{{ t('history.reverted') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('history.currency') }}</label>
          <select class="form-select" v-model="draftFilters.currency">
            <option value="">{{ t('history.allCurrencies') }}</option>
            <option v-for="currency in currencyOptions" :key="currency" :value="currency">{{ currency }}</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">{{ t('history.startDate') }}</label>
          <input class="form-input" type="date" v-model="draftFilters.start_date" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('history.endDate') }}</label>
          <input class="form-input" type="date" v-model="draftFilters.end_date" />
        </div>
      </div>
      <template #footer>
        <div class="history-drawer-actions">
          <button class="btn" @click="resetDraftFilters">{{ t('common.reset') }}</button>
          <button class="btn btn-primary" @click="applyMobileFilters">{{ t('common.apply') }}</button>
        </div>
      </template>
    </AppDrawer>

    <AppDrawer v-model="sortDrawerOpen" :title="t('history.sortTitle')">
      <div class="history-sort-options">
        <button
          v-for="option in sortOptions"
          :key="option.value"
          class="history-sort-option"
          :class="{ active: filters.sort === option.value }"
          @click="applySort(option.value)"
        >
          <span>{{ option.label }}</span>
          <span v-if="filters.sort === option.value">✓</span>
        </button>
      </div>
    </AppDrawer>

    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="undoDialog.open" class="dialog-overlay" @click.self="closeUndoDialog">
          <div class="dialog-box">
            <div class="dialog-header">
              <h3 class="dialog-title">{{ t('history.undoTitle') }}</h3>
            </div>
            <div class="dialog-body">
              <p>{{ t('history.undoMessage') }}</p>
              <label class="undo-checkbox">
                <input type="checkbox" v-model="undoDialog.rollbackHoldings" />
                <span>{{ t('history.rollbackHoldings') }}</span>
              </label>
            </div>
            <div class="dialog-actions">
              <button class="btn" @click="closeUndoDialog">{{ t('common.cancel') }}</button>
              <button class="btn btn-danger" @click="confirmUndo" :disabled="undoSubmitting">{{ undoSubmitting ? t('history.processing') : t('history.confirmUndo') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { useConfirm } from '../utils/confirm.js'
import { currencySymbol } from '../utils/currency.js'
import { formatDateTime, formatNumber } from '../utils/formatters.js'
import AppDrawer from '../components/AppDrawer.vue'
import PullRefreshView from '../components/PullRefreshView.vue'
import SwipeActionItem from '../components/SwipeActionItem.vue'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'

const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const history = ref([])
const assets = ref([])
const loading = ref(true)
const showForm = ref(false)
const submitting = ref(false)
const showDetailDrawer = ref(false)
const detailRecord = ref(null)
const undoSubmitting = ref(false)
const filterDrawerOpen = ref(false)
const sortDrawerOpen = ref(false)
const totalCount = ref(0)
const mobilePageActions = useMobilePageActions()
const currencyOptions = ['CNY', 'USD', 'USDT', 'BTC', 'ETH']
const sortOptions = computed(() => [
  { value: 'executed_desc', label: t('history.latestFirst') },
  { value: 'executed_asc', label: t('history.earliestFirst') },
  { value: 'total_desc', label: t('history.amountDesc') },
  { value: 'total_asc', label: t('history.amountAsc') },
])
const form = reactive({ asset_id: '', type: 'buy', quantity: '', price: '', currency: 'CNY', total: '', pnl: '', pnl_pct: '', executed_at: new Date().toISOString().slice(0,10), reason: '' })
const undoDialog = reactive({ open: false, record: null, rollbackHoldings: true })
const filters = reactive({ asset_id: '', type: '', status: '', currency: '', start_date: '', end_date: '', sort: 'executed_desc' })
const draftFilters = reactive({ asset_id: '', type: '', status: '', currency: '', start_date: '', end_date: '' })

const selectedAsset = computed(() => assets.value.find(asset => String(asset.id) === String(form.asset_id)) || null)
const showCurrencyField = computed(() => selectedAsset.value?.type === 'crypto')
const currentSortLabel = computed(() => sortOptions.value.find(option => option.value === filters.sort)?.label || t('history.sort'))
const activeFilterCount = computed(() => ['asset_id', 'type', 'status', 'currency', 'start_date', 'end_date'].filter(key => filters[key]).length)
const activeFilterChips = computed(() => {
  const assetName = assets.value.find(asset => String(asset.id) === filters.asset_id)?.name
  return [
    filters.asset_id ? { key: 'asset_id', label: assetName || t('history.asset') } : null,
    filters.type ? { key: 'type', label: filters.type === 'buy' ? t('history.buy') : t('history.sell') } : null,
    filters.status ? { key: 'status', label: filters.status === 'active' ? t('history.effective') : t('history.reverted') } : null,
    filters.currency ? { key: 'currency', label: filters.currency } : null,
    filters.start_date ? { key: 'start_date', label: `${t('history.startDate')} ${filters.start_date}` } : null,
    filters.end_date ? { key: 'end_date', label: `${t('history.endDate')} ${filters.end_date}` } : null,
  ].filter(Boolean)
})

watch(selectedAsset, (asset) => {
  if (showCurrencyField.value) {
    form.currency = currencyOptions.includes(asset?.currency) ? asset.currency : (currencyOptions.includes(form.currency) ? form.currency : 'USDT')
    return
  }
  form.currency = asset?.currency || 'CNY'
}, { immediate: true })

async function loadData() {
  try {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value)
    }
    const historyUrl = query.toString() ? `/api/history?${query.toString()}` : '/api/history'
    const [hres, ares] = await Promise.all([api(historyUrl), api('/api/assets')])
    const historyJson = await hres.json()
    history.value = historyJson.data || []
    totalCount.value = Number(historyJson.total || 0)
    assets.value = (await ares.json()).data || []
    if (detailRecord.value) {
      detailRecord.value = history.value.find(item => item.id === detailRecord.value.id) || detailRecord.value
    }
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.asset_id = ''
  form.type = 'buy'
  form.quantity = ''
  form.price = ''
  form.currency = 'CNY'
  form.total = ''
  form.pnl = ''
  form.pnl_pct = ''
  form.executed_at = new Date().toISOString().slice(0, 10)
  form.reason = ''
}

function resetFilters() {
  filters.asset_id = ''
  filters.type = ''
  filters.status = ''
  filters.currency = ''
  filters.start_date = ''
  filters.end_date = ''
  filters.sort = 'executed_desc'
  syncDraftFilters()
  loadData()
}

function syncDraftFilters() {
  draftFilters.asset_id = filters.asset_id
  draftFilters.type = filters.type
  draftFilters.status = filters.status
  draftFilters.currency = filters.currency
  draftFilters.start_date = filters.start_date
  draftFilters.end_date = filters.end_date
}

function resetDraftFilters() {
  draftFilters.asset_id = ''
  draftFilters.type = ''
  draftFilters.status = ''
  draftFilters.currency = ''
  draftFilters.start_date = ''
  draftFilters.end_date = ''
}

async function applyMobileFilters() {
  filters.asset_id = draftFilters.asset_id
  filters.type = draftFilters.type
  filters.status = draftFilters.status
  filters.currency = draftFilters.currency
  filters.start_date = draftFilters.start_date
  filters.end_date = draftFilters.end_date
  filterDrawerOpen.value = false
  await loadData()
}

async function applySort(value) {
  filters.sort = value
  sortDrawerOpen.value = false
  await loadData()
}

function removeFilter(key) {
  filters[key] = ''
  syncDraftFilters()
  loadData()
}

watchEffect(() => {
  mobilePageActions.setActions([
    {
      key: 'add-history-record',
      label: t('history.addRecord'),
      onSelect: () => { showForm.value = true },
    },
    {
      key: 'sort-history',
      label: currentSortLabel.value,
      onSelect: () => { sortDrawerOpen.value = true },
    },
    {
      key: 'filter-history',
      label: activeFilterCount.value ? `${t('common.filter')} (${activeFilterCount.value})` : t('common.filter'),
      onSelect: () => { filterDrawerOpen.value = true },
    },
    activeFilterCount.value ? {
      key: 'reset-history-filters',
      label: t('common.reset'),
      onSelect: resetFilters,
    } : null,
  ])
})

function openDetail(record) {
  detailRecord.value = record
  showDetailDrawer.value = true
}

function openUndoDialog(record) {
  undoDialog.open = true
  undoDialog.record = record
  undoDialog.rollbackHoldings = true
}

function closeUndoDialog(force = false) {
  if (undoSubmitting.value && !force) return
  undoDialog.open = false
  undoDialog.record = null
  undoDialog.rollbackHoldings = true
}

async function addRecord() {
  submitting.value = true
  try {
    const body = {
      asset_id: Number(form.asset_id),
      type: form.type,
      quantity: Number(form.quantity),
      price: Number(form.price),
      currency: form.currency || selectedAsset.value?.currency || 'CNY',
      total: Number(form.total) || Number(form.quantity) * Number(form.price),
      executed_at: form.executed_at,
      reason: form.reason,
      pnl: form.pnl ? Number(form.pnl) : null,
      pnl_pct: form.pnl_pct ? Number(form.pnl_pct) : null,
    }
    const res = await api('/api/history', { method: 'POST', body: JSON.stringify(body) })
    const json = await res.json()
    if (!json.success) {
      toast.error(t('history.saveFailed', { message: json.error || t('common.unknownError') }))
      return
    }
    showForm.value = false
    resetForm()
    await loadData()
    toast.success(t('history.saved'))
  } catch (error) {
    toast.error(t('history.saveFailed', { message: error.message }))
  } finally {
    submitting.value = false
  }
}

async function confirmUndo() {
  if (!undoDialog.record) return
  undoSubmitting.value = true
  try {
    const res = await api(`/api/history/${undoDialog.record.id}/undo`, {
      method: 'POST',
      body: JSON.stringify({ rollback_holdings: undoDialog.rollbackHoldings }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || t('history.undoFailed'))
      return
    }
    closeUndoDialog(true)
    await loadData()
    toast.success(t('history.undone'))
  } catch (error) {
    toast.error(error.message || t('history.undoFailed'))
  } finally {
    undoSubmitting.value = false
  }
}

async function confirmDelete(record) {
  const ok = await confirm({
    title: t('history.deleteTitle'),
    message: t('history.deleteMessage'),
    confirmText: t('history.delete'),
    cancelText: t('common.cancel'),
    danger: true,
    icon: 'delete',
  })
  if (!ok) return

  try {
    const res = await api(`/api/history/${record.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || t('history.deleteFailed'))
      return
    }
    if (detailRecord.value?.id === record.id) {
      showDetailDrawer.value = false
      detailRecord.value = null
    }
    await loadData()
    toast.success(t('history.deleted'))
  } catch (error) {
    toast.error(error.message || t('history.deleteFailed'))
  }
}

function fmt(n, maxFractionDigits = 2) {
  return formatNumber(n, { maximumFractionDigits: maxFractionDigits })
}

function moneyPrefix(currency = 'CNY') {
  const symbol = currencySymbol(currency)
  return symbol.length > 1 ? `${symbol} ` : symbol
}

function formatDate(value) {
  return formatDateTime(value, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

onMounted(loadData)

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
.currency-help { margin-top: 6px; font-size: 12px; color: var(--text-dim); }
.history-drawer-actions {
  display: flex;
  gap: 12px;
}
.history-drawer-actions .btn {
  flex: 1;
}
.history-sort-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-sort-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
}
.history-sort-option.active {
  border-color: var(--blue);
  color: var(--blue);
}
.history-row { cursor: pointer; }
.history-type-cell { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.history-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.reverted-row td { opacity: 0.5; text-decoration: line-through; }
.history-cards { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.history-card { border: 1px solid var(--border); border-radius: 10px; padding: 12px; cursor: pointer; transition: background 0.15s; }
.history-card:hover { background: var(--bg-hover); }
.history-card:active { background: var(--bg-hover); }
.reverted-card { opacity: 0.5; text-decoration: line-through; }
.history-card-header { display: flex; justify-content: space-between; gap: 12px; }
.history-card-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.history-card-meta { font-size: 12px; color: var(--text-dim); }
.history-card-total { font-weight: 600; white-space: nowrap; }
.history-card-body { display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 13px; }
.history-card-currency { font-size: 12px; color: var(--text-muted); }
.history-card-reason { margin-top: 8px; font-size: 12px; color: var(--text-dim); line-height: 1.5; }
.history-card-actions { margin-top: 12px; }

.detail-drawer-content { display: flex; flex-direction: column; gap: 16px; }
.detail-section { background: var(--bg); border-radius: 10px; padding: 4px 0; }
.detail-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); padding: 8px 14px 4px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 14px; gap: 12px; }

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dialog-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 420px;
  max-width: 100%;
}
.dialog-header { padding: 20px 20px 0; }
.dialog-title { font-size: 16px; font-weight: 600; }
.dialog-body { padding: 12px 20px 20px; color: var(--text-dim); font-size: 14px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 0 20px 20px; }
.undo-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  color: var(--text);
}
.dialog-enter-active,
.dialog-leave-active { transition: opacity 0.2s ease; }
.dialog-enter-active .dialog-box,
.dialog-leave-active .dialog-box { transition: transform 0.2s ease; }
.dialog-enter-from,
.dialog-leave-to { opacity: 0; }
.dialog-enter-from .dialog-box,
.dialog-leave-to .dialog-box { transform: scale(0.95); }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .history-card-header { align-items: flex-start; }
  .page-filter-actions .btn { flex: 1; }
  .dialog-box { width: 100%; margin: 16px; }
  .dialog-actions { flex-wrap: wrap; gap: 8px; }
  .dialog-actions .btn { flex: 1; min-width: 0; }
  .dialog-header { padding: 16px 16px 0; }
  .dialog-body { padding: 12px 16px 16px; }
  .dialog-actions { padding: 0 16px 16px; }
}

.swipe-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  border: none;
  border-left: 1px solid var(--swipe-action-divider);
  background: var(--swipe-action-bg);
  font-size: 11px;
  cursor: pointer;
  color: var(--swipe-action-text);
  font-family: inherit;
}
.swipe-action-btn.danger {
  background: var(--swipe-action-danger-bg);
  color: var(--swipe-action-danger-text);
}
</style>
