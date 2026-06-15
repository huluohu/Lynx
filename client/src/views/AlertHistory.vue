<template>
  <PullRefreshView :onRefresh="loadAlerts">
  <div>
    <div class="page-header">
      <h1 class="page-title">提醒历史</h1>
      <button class="btn" @click="clearRead" :disabled="clearing">{{ clearing ? '清理中...' : '清空已读' }}</button>
    </div>

    <div class="filters">
      <select class="form-select filter-select" v-model="filters.type" @change="applyFilters">
        <option value="">全部类型</option>
        <option value="plan_triggered">计划触发</option>
        <option value="plan_approaching">接近触发</option>
        <option value="stop_loss">止损</option>
        <option value="price_swing">价格波动</option>
        <option value="trade_executed">交易执行</option>
      </select>
      <select class="form-select filter-select" v-model="filters.severity" @change="applyFilters">
        <option value="">全部级别</option>
        <option value="danger">高优先级</option>
        <option value="warning">中优先级</option>
        <option value="info">低优先级</option>
      </select>
      <select class="form-select filter-select" v-model="filters.asset_id" @change="applyFilters">
        <option value="">全部资产</option>
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
            <th>时间</th>
            <th>提醒内容</th>
            <th>资产</th>
            <th>状态</th>
            <th>操作</th>
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
            <td>{{ item.asset_name || '-' }}</td>
            <td>
              <div class="status-cell">
                <span class="badge" :class="severityBadge(item.severity)">{{ severityLabel(item.severity) }}</span>
                <span class="badge" :class="item.status === 'read' ? 'badge-pending' : 'badge-buy'">{{ item.status === 'read' ? '已读' : '未读' }}</span>
              </div>
            </td>
            <td>
              <div class="actions-cell">
                <button v-if="item.status !== 'read'" class="btn btn-sm" @click="markAsRead(item)">标已读</button>
                <button class="btn btn-sm btn-danger" @click="deleteAlert(item)">删除</button>
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
            <span>{{ item.asset_name || '未关联资产' }}</span>
            <span class="badge" :class="item.status === 'read' ? 'badge-pending' : 'badge-buy'">{{ item.status === 'read' ? '已读' : '未读' }}</span>
          </div>
          <div class="alert-card-actions">
            <button v-if="item.status !== 'read'" class="btn btn-sm" @click="markAsRead(item)">标已读</button>
            <button class="btn btn-sm btn-danger" @click="deleteAlert(item)">删除</button>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="pagination.total_pages > 1">
        <button class="btn btn-sm" @click="changePage(pagination.page - 1)" :disabled="pagination.page <= 1">上一页</button>
        <span>第 {{ pagination.page }} / {{ pagination.total_pages }} 页</span>
        <button class="btn btn-sm" @click="changePage(pagination.page + 1)" :disabled="pagination.page >= pagination.total_pages">下一页</button>
      </div>
    </div>

    <div v-else class="card empty">
      <div class="empty-icon">🔔</div>
      <p>暂无提醒历史</p>
    </div>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { useConfirm } from '../utils/confirm.js'
import PullRefreshView from '../components/PullRefreshView.vue'

const toast = useToast()
const confirm = useConfirm()
const loading = ref(true)
const clearing = ref(false)
const assets = ref([])
const alerts = ref([])
const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 1 })
const filters = reactive({ type: '', severity: '', asset_id: '', page: 1, page_size: 20 })

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
      toast.error(json.error || '加载失败')
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
    if (!json.success) return toast.error(json.error || '操作失败')
    item.status = 'read'
    toast.success('已标记为已读')
  } catch (e) {
    toast.error(e.message)
  }
}

async function deleteAlert(item) {
  const ok = await confirm({
    title: '删除提醒',
    message: `确定删除提醒「${item.title}」？`,
    confirmText: '删除',
    icon: 'delete',
    danger: true,
  })
  if (!ok) return
  try {
    const res = await api(`/api/notifications/${item.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || '删除失败')
    alerts.value = alerts.value.filter(alert => alert.id !== item.id)
    toast.success('提醒已删除')
    if (!alerts.value.length && pagination.value.page > 1) {
      filters.page = pagination.value.page - 1
    }
    await loadAlerts()
  } catch (e) {
    toast.error(e.message)
  }
}

async function clearRead() {
  const ok = await confirm({
    title: '清空已读',
    message: '确定清空所有已读提醒？此操作不可恢复。',
    confirmText: '清空',
    icon: 'delete',
    danger: true,
  })
  if (!ok) return
  clearing.value = true
  try {
    const res = await api('/api/notifications/clear-all', { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) return toast.error(json.error || '清理失败')
    toast.success('已清空已读提醒')
    await loadAlerts()
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
  return { plan_triggered: '计划触发', plan_approaching: '接近触发', stop_loss: '止损', price_swing: '价格波动', trade_executed: '交易执行' }[type] || type
}
function severityLabel(level) {
  return { danger: '高', warning: '中', info: '低' }[level] || '低'
}
function severityBadge(level) {
  return { danger: 'severity-danger', warning: 'severity-warning', info: 'severity-info' }[level] || 'severity-info'
}
function fmtDateTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '-'
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
