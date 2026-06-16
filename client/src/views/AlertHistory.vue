<template>
  <PullRefreshView :onRefresh="loadAlerts">
  <div>
    <div class="page-header page-header-mobile-empty">
      <h1 class="page-title">{{ t('alertHistory.title') }}</h1>
      <div class="page-header-right">
        <div class="page-header-actions">
          <button v-if="hasUnreadAlerts" class="btn" @click="markAllAsRead" :disabled="bulkReading">{{ bulkReading ? t('alertHistory.markingAllRead') : t('alertHistory.markAllRead') }}</button>
          <button class="btn" @click="clearRead" :disabled="clearing">{{ clearing ? t('alertHistory.clearing') : t('alertHistory.clearRead') }}</button>
        </div>
      </div>
    </div>

    <div class="card page-filter-card desktop-only">
      <div class="page-filter-grid">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('alertHistory.columns.content') }}</label>
            <select class="form-select" v-model="filters.type">
              <option value="">{{ t('alertHistory.filters.allTypes') }}</option>
              <option value="plan_triggered">{{ t('alertHistory.types.planTriggered') }}</option>
              <option value="plan_approaching">{{ t('alertHistory.types.planApproaching') }}</option>
              <option value="stop_loss">{{ t('alertHistory.types.stopLoss') }}</option>
              <option value="price_swing">{{ t('alertHistory.types.priceSwing') }}</option>
              <option value="trade_executed">{{ t('alertHistory.types.tradeExecuted') }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('alertHistory.filters.severity') }}</label>
            <select class="form-select" v-model="filters.severity">
              <option value="">{{ t('alertHistory.filters.allSeverities') }}</option>
              <option value="danger">{{ t('alertHistory.severity.high') }}</option>
              <option value="warning">{{ t('alertHistory.severity.medium') }}</option>
              <option value="info">{{ t('alertHistory.severity.low') }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('alertHistory.columns.asset') }}</label>
            <select class="form-select" v-model="filters.asset_id">
              <option value="">{{ t('alertHistory.filters.allAssets') }}</option>
              <option v-for="asset in assets" :key="asset.id" :value="String(asset.id)">{{ asset.name }}</option>
            </select>
          </div>
        </div>
        <div class="page-filter-actions">
          <button class="btn btn-primary" @click="applyFilters">{{ t('common.apply') }}</button>
          <button class="btn" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>
      </div>
    </div>

    <div class="mobile-only page-mobile-toolbar">
      <div class="page-mobile-toolbar-row">
        <div class="page-mobile-summary">{{ t('alertHistory.totalRecords', { count: pagination.total || alerts.length }) }}</div>
        <div class="page-mobile-toolbar-actions">
          <button class="btn btn-inline-icon" @click="filterDrawerOpen = true">
            <span>{{ t('common.filter') }}</span>
            <span v-if="activeFilterCount" class="page-filter-badge">{{ activeFilterCount }}</span>
          </button>
          <button v-if="activeFilterCount" class="btn btn-inline-icon" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>
      </div>
      <div v-if="activeFilterChips.length" class="page-filter-chips">
        <button v-for="chip in activeFilterChips" :key="chip.key" class="page-filter-chip" @click="removeFilter(chip.key)">
          <span>{{ chip.label }}</span>
          <span>×</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="card">
      <div class="skeleton-card" style="margin-bottom:8px" v-for="i in 5" :key="i">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="skeleton skeleton-badge"></div>
          <div class="skeleton skeleton-text" style="width:120px"></div>
          <div class="skeleton skeleton-text short" style="margin-left:auto"></div>
        </div>
      </div>
    </div>

    <div v-else-if="alerts.length" class="card">
      <table class="hide-mobile">
        <thead>
          <tr>
            <th>{{ t('alertHistory.columns.time') }}</th>
            <th>{{ t('alertHistory.columns.content') }}</th>
            <th>{{ t('alertHistory.columns.asset') }}</th>
            <th>{{ t('alertHistory.columns.status') }}</th>
            <th>{{ t('alertHistory.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in alerts" :key="item.id">
            <td>{{ fmtDateTime(item.created_at) }}</td>
            <td>
              <div class="content-cell">
                <div class="content-head">
                  <span class="icon-text content-type"><span class="icon">{{ typeIcon(item.type) }}</span>{{ typeLabel(item.type) }}</span>
                  <span class="content-title">{{ item.title }}</span>
                </div>
                <div v-if="item.strategy_name" class="content-sub">{{ item.strategy_name }}</div>
                <div class="content-message">{{ item.message }}</div>
              </div>
            </td>
            <td>{{ item.asset_name || t('alertHistory.unlinkedAsset') }}</td>
            <td>
              <div class="status-cell">
                <span class="badge" :class="severityBadge(item.severity)">{{ severityLabel(item.severity) }}</span>
                <span class="badge" :class="item.status === 'read' ? 'badge-pending' : 'badge-buy'">{{ item.status === 'read' ? t('alertHistory.status.read') : t('alertHistory.status.unread') }}</span>
              </div>
            </td>
            <td>
              <div class="actions-cell">
                <button v-if="item.status !== 'read'" class="btn btn-sm" @click="markAsRead(item)">{{ t('alertHistory.markRead') }}</button>
                <button class="btn btn-sm btn-danger" @click="deleteAlert(item)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="show-mobile alert-cards">
        <div v-for="item in alerts" :key="item.id" class="alert-card">
          <div class="alert-card-top">
            <span class="icon-text content-type"><span class="icon">{{ typeIcon(item.type) }}</span>{{ typeLabel(item.type) }}</span>
            <span class="badge" :class="severityBadge(item.severity)">{{ severityLabel(item.severity) }}</span>
          </div>
          <div class="alert-card-title">{{ item.title }}</div>
          <div class="alert-card-message">{{ item.message }}</div>
          <div v-if="item.strategy_name" class="alert-card-strategy">{{ item.strategy_name }}</div>
          <div class="alert-card-meta">
            <span>{{ fmtDateTime(item.created_at) }}</span>
            <span>{{ item.asset_name || t('alertHistory.unlinkedAsset') }}</span>
            <span class="badge" :class="item.status === 'read' ? 'badge-pending' : 'badge-buy'">{{ item.status === 'read' ? t('alertHistory.status.read') : t('alertHistory.status.unread') }}</span>
          </div>
          <div class="alert-card-actions">
            <button v-if="item.status !== 'read'" class="btn btn-sm" @click="markAsRead(item)">{{ t('alertHistory.markRead') }}</button>
            <button class="btn btn-sm btn-danger" @click="deleteAlert(item)">{{ t('common.delete') }}</button>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="pagination.total_pages > 1">
        <button class="btn btn-sm" @click="changePage(pagination.page - 1)" :disabled="pagination.page <= 1">{{ t('alertHistory.pagination.prev') }}</button>
        <span>{{ t('alertHistory.pagination.summary', { page: pagination.page, total: pagination.total_pages }) }}</span>
        <button class="btn btn-sm" @click="changePage(pagination.page + 1)" :disabled="pagination.page >= pagination.total_pages">{{ t('alertHistory.pagination.next') }}</button>
      </div>
    </div>

    <div v-else class="card empty">
      <div class="empty-icon">🔔</div>
      <p>{{ t('alertHistory.empty') }}</p>
    </div>
  </div>
  <AppDrawer v-model="filterDrawerOpen" :title="t('common.filter')">
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">{{ t('alertHistory.columns.content') }}</label>
        <select class="form-select" v-model="draftFilters.type">
          <option value="">{{ t('alertHistory.filters.allTypes') }}</option>
          <option value="plan_triggered">{{ t('alertHistory.types.planTriggered') }}</option>
          <option value="plan_approaching">{{ t('alertHistory.types.planApproaching') }}</option>
          <option value="stop_loss">{{ t('alertHistory.types.stopLoss') }}</option>
          <option value="price_swing">{{ t('alertHistory.types.priceSwing') }}</option>
          <option value="trade_executed">{{ t('alertHistory.types.tradeExecuted') }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('alertHistory.filters.severity') }}</label>
        <select class="form-select" v-model="draftFilters.severity">
          <option value="">{{ t('alertHistory.filters.allSeverities') }}</option>
          <option value="danger">{{ t('alertHistory.severity.high') }}</option>
          <option value="warning">{{ t('alertHistory.severity.medium') }}</option>
          <option value="info">{{ t('alertHistory.severity.low') }}</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">{{ t('alertHistory.columns.asset') }}</label>
        <select class="form-select" v-model="draftFilters.asset_id">
          <option value="">{{ t('alertHistory.filters.allAssets') }}</option>
          <option v-for="asset in assets" :key="asset.id" :value="String(asset.id)">{{ asset.name }}</option>
        </select>
      </div>
    </div>
    <template #footer>
      <div class="history-drawer-actions">
        <button class="btn" @click="resetDraftFilters">{{ t('common.reset') }}</button>
        <button class="btn btn-primary" @click="applyMobileFilters">{{ t('common.apply') }}</button>
      </div>
    </template>
  </AppDrawer>
  </PullRefreshView>
</template>

<script setup>
import { computed, reactive, ref, watch, onMounted, onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '../stores/notifications.js'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { useConfirm } from '../utils/confirm.js'
import { formatDateTime } from '../utils/formatters.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import AppDrawer from '../components/AppDrawer.vue'
import PullRefreshView from '../components/PullRefreshView.vue'

const toast = useToast()
const confirm = useConfirm()
const notificationsStore = useNotificationsStore()
const { t } = useI18n()
const loading = ref(true)
const clearing = ref(false)
const bulkReading = ref(false)
const assets = ref([])
const alerts = ref([])
const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 1 })
const filters = reactive({ type: '', severity: '', asset_id: '', page: 1, page_size: 20 })
const draftFilters = reactive({ type: '', severity: '', asset_id: '' })
const filterDrawerOpen = ref(false)
const mobilePageActions = useMobilePageActions()
const hasUnreadAlerts = computed(() => alerts.value.some((item) => item.status !== 'read'))
const activeFilterCount = computed(() => ['type', 'severity', 'asset_id'].filter(key => filters[key]).length)
const activeFilterChips = computed(() => {
  const assetName = assets.value.find(asset => String(asset.id) === filters.asset_id)?.name
  return [
    filters.type ? { key: 'type', label: typeLabel(filters.type) } : null,
    filters.severity ? { key: 'severity', label: severityLabel(filters.severity) } : null,
    filters.asset_id ? { key: 'asset_id', label: assetName || t('alertHistory.columns.asset') } : null,
  ].filter(Boolean)
})

async function loadAssets() {
  const res = await api('/api/assets')
  const json = await res.json()
  assets.value = json.data || []
}

async function loadAlerts() {
  loading.value = true
  try {
    const query = new URLSearchParams()
    if (filters.type) query.set('type', filters.type)
    if (filters.severity) query.set('severity', filters.severity)
    if (filters.asset_id) query.set('asset_id', filters.asset_id)
    query.set('page', String(filters.page))
    query.set('page_size', String(filters.page_size))

    const res = await api(`/api/notifications/history?${query.toString()}`)
    const json = await res.json()
    if (json.success) {
      alerts.value = json.data.items || []
      pagination.value = json.data.pagination || pagination.value
    } else {
      toast.error(json.error || t('alertHistory.loadFailed'))
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  filters.page = 1
  syncDraftFilters()
  loadAlerts()
}

function resetFilters() {
  filters.type = ''
  filters.severity = ''
  filters.asset_id = ''
  filters.page = 1
  syncDraftFilters()
  loadAlerts()
}

function syncDraftFilters() {
  draftFilters.type = filters.type
  draftFilters.severity = filters.severity
  draftFilters.asset_id = filters.asset_id
}

function resetDraftFilters() {
  draftFilters.type = ''
  draftFilters.severity = ''
  draftFilters.asset_id = ''
}

async function applyMobileFilters() {
  filters.type = draftFilters.type
  filters.severity = draftFilters.severity
  filters.asset_id = draftFilters.asset_id
  filters.page = 1
  filterDrawerOpen.value = false
  await loadAlerts()
}

function removeFilter(key) {
  filters[key] = ''
  filters.page = 1
  syncDraftFilters()
  loadAlerts()
}

function changePage(page) {
  filters.page = page
  loadAlerts()
}

async function markAsRead(item) {
  try {
    const res = await api(`/api/notifications/${item.id}/read`, { method: 'PUT' })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || t('alertHistory.actionFailed'))
    item.status = 'read'
    await notificationsStore.notifyChanged()
    toast.success(t('alertHistory.markReadSuccess'))
  } catch (e) {
    toast.error(e.message)
  }
}

async function markAllAsRead() {
  bulkReading.value = true
  try {
    const res = await api('/api/notifications/read-all', { method: 'PUT' })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || t('alertHistory.actionFailed'))
    await loadAlerts()
    await notificationsStore.notifyChanged()
    toast.success(t('alertHistory.markAllReadSuccess'))
  } catch (e) {
    toast.error(e.message)
  } finally {
    bulkReading.value = false
  }
}

async function deleteAlert(item) {
  const ok = await confirm({
    title: t('alertHistory.deleteTitle'),
    message: t('alertHistory.deleteMessage', { title: item.title }),
    confirmText: t('common.delete'),
    icon: 'delete',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await api(`/api/notifications/${item.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || t('alertHistory.deleteFailed'))
    alerts.value = alerts.value.filter(alert => alert.id !== item.id)
    toast.success(t('alertHistory.deleteSuccess'))
    if (!alerts.value.length && pagination.value.page > 1) {
      filters.page = pagination.value.page - 1
    }
    await loadAlerts()
    await notificationsStore.notifyChanged()
  } catch (e) {
    toast.error(e.message)
  }
}

async function clearRead() {
  const ok = await confirm({
    title: t('alertHistory.clearReadTitle'),
    message: t('alertHistory.clearReadMessage'),
    confirmText: t('alertHistory.clearRead'),
    icon: 'delete',
    danger: true,
  })
  if (!ok) return
  clearing.value = true
  try {
    const res = await api('/api/notifications/clear-all', { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || t('alertHistory.clearFailed'))
    toast.success(t('alertHistory.clearReadSuccess'))
    await loadAlerts()
    await notificationsStore.notifyChanged()
  } catch (e) {
    toast.error(e.message)
  } finally {
    clearing.value = false
  }
}

function typeIcon(type) {
  return { plan_triggered: '📌', plan_approaching: '⏳', stop_loss: '🛑', price_swing: '📊', trade_executed: '💱' }[type] || '🔔'
}
function typeLabel(type) {
  return {
    plan_triggered: t('alertHistory.types.planTriggered'),
    plan_approaching: t('alertHistory.types.planApproaching'),
    stop_loss: t('alertHistory.types.stopLoss'),
    price_swing: t('alertHistory.types.priceSwing'),
    trade_executed: t('alertHistory.types.tradeExecuted'),
  }[type] || type
}
function severityLabel(level) {
  return {
    danger: t('alertHistory.severity.highShort'),
    warning: t('alertHistory.severity.mediumShort'),
    info: t('alertHistory.severity.lowShort'),
  }[level] || t('alertHistory.severity.lowShort')
}
function severityBadge(level) {
  return { danger: 'severity-danger', warning: 'severity-warning', info: 'severity-info' }[level] || 'severity-info'
}
function fmtDateTime(value) {
  return value ? formatDateTime(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }) : '-'
}

watchEffect(() => {
  mobilePageActions.setActions([
    hasUnreadAlerts.value ? {
      key: 'mark-all-read',
      label: bulkReading.value ? t('alertHistory.markingAllRead') : t('alertHistory.markAllRead'),
      disabled: bulkReading.value,
      onSelect: markAllAsRead,
    } : null,
    {
      key: 'clear-read',
      label: clearing.value ? t('alertHistory.clearing') : t('alertHistory.clearRead'),
      disabled: clearing.value,
      danger: true,
      onSelect: clearRead,
    },
  ])
})

onMounted(async () => {
  try {
    await Promise.all([loadAssets(), loadAlerts()])
    syncDraftFilters()
  } catch {
    loading.value = false
  }
})

watch(filterDrawerOpen, (open) => {
  if (open) syncDraftFilters()
})

onUnmounted(() => {
  mobilePageActions.clearActions()
})
</script>

<style scoped>
.hide-mobile { display: table; }
.show-mobile { display: none !important; }
.actions-cell {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.status-cell {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.content-cell {
  max-width: 420px;
}
.content-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.content-type {
  font-size: 12px;
  color: var(--text-muted);
}
.content-title {
  font-weight: 600;
}
.content-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.content-message {
  color: var(--text-dim);
  line-height: 1.5;
}
.severity-danger { background: rgba(239,68,68,0.15); color: var(--red); }
.severity-warning { background: rgba(240,192,64,0.18); color: var(--gold); }
.severity-info { background: rgba(59,130,246,0.15); color: var(--blue); }
.alert-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.alert-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
}
.alert-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.alert-card-title {
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 4px;
}
.alert-card-message {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.5;
}
.alert-card-strategy {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.alert-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}
.alert-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-muted);
}
.history-drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .pagination { justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .pagination .btn { min-height: 36px; padding: 8px 12px; }
  .history-drawer-actions {
    justify-content: space-between;
  }
}
</style>
