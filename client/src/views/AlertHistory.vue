<template>
  <PullRefreshView :onRefresh="loadAlerts">
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('alertHistory.title') }}</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button v-if="hasUnreadAlerts" class="btn" @click="markAllAsRead" :disabled="bulkReading">{{ bulkReading ? t('alertHistory.markingAllRead') : t('alertHistory.markAllRead') }}</button>
        <button class="btn" @click="clearRead" :disabled="clearing">{{ clearing ? t('alertHistory.clearing') : t('alertHistory.clearRead') }}</button>
      </div>
    </div>

    <div class="filters">
      <select class="form-select filter-select" v-model="filters.type" @change="applyFilters">
        <option value="">{{ t('alertHistory.filters.allTypes') }}</option>
        <option value="plan_triggered">{{ t('alertHistory.types.planTriggered') }}</option>
        <option value="plan_approaching">{{ t('alertHistory.types.planApproaching') }}</option>
        <option value="stop_loss">{{ t('alertHistory.types.stopLoss') }}</option>
        <option value="price_swing">{{ t('alertHistory.types.priceSwing') }}</option>
        <option value="trade_executed">{{ t('alertHistory.types.tradeExecuted') }}</option>
      </select>
      <select class="form-select filter-select" v-model="filters.severity" @change="applyFilters">
        <option value="">{{ t('alertHistory.filters.allSeverities') }}</option>
        <option value="danger">{{ t('alertHistory.severity.high') }}</option>
        <option value="warning">{{ t('alertHistory.severity.medium') }}</option>
        <option value="info">{{ t('alertHistory.severity.low') }}</option>
      </select>
      <select class="form-select filter-select" v-model="filters.asset_id" @change="applyFilters">
        <option value="">{{ t('alertHistory.filters.allAssets') }}</option>
        <option v-for="asset in assets" :key="asset.id" :value="String(asset.id)">{{ asset.name }}</option>
      </select>
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
  </PullRefreshView>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '../stores/notifications.js'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { useConfirm } from '../utils/confirm.js'
import { formatDateTime } from '../utils/formatters.js'
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
const hasUnreadAlerts = computed(() => alerts.value.some((item) => item.status !== 'read'))

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

onMounted(async () => {
  try {
    await Promise.all([loadAssets(), loadAlerts()])
  } catch {
    loading.value = false
  }
})
</script>

<style scoped>
.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.filter-select {
  flex: 1 1 160px;
  max-width: 220px;
}
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

@media (max-width: 768px) {
  .filter-select {
    flex: 1 1 100%;
    max-width: none;
  }
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .pagination { justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .pagination .btn { min-height: 36px; padding: 8px 12px; }
}
</style>
