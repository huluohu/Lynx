<template>
  <PullRefreshView :onRefresh="refresh">
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('dashboard.title') }}</h1>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span v-if="lastUpdated" class="update-time">{{ t('dashboard.updatedAt', { time: fmtUpdateTime(lastUpdated) }) }}</span>
        <span v-if="usdCny" class="rate-badge">USD/CNY {{ usdCny.toFixed(4) }}</span>
        <button class="btn btn-inline-icon" @click="refresh" :disabled="loading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>{{ loading ? t('dashboard.refreshing') : t('dashboard.refresh') }}</span>
        </button>
      </div>
    </div>

    <div v-if="alerts.length" class="alert-section">
      <div class="alert-section-header">
        <div class="alert-section-title">
          <span>🔔 {{ t('dashboard.alertsTitle', { count: alerts.length }) }}</span>
          <span style="font-size:12px;color:var(--text-muted)">
            <template v-if="alertCounts.danger">🔴 {{ alertCounts.danger }}</template>
            <template v-if="alertCounts.warning"> 🟡 {{ alertCounts.warning }}</template>
            <template v-if="alertCounts.info"> 🔵 {{ alertCounts.info }}</template>
          </span>
        </div>
      </div>
      <div
        v-for="a in alerts.slice(0, 2)"
        :key="a.id"
        :class="['alert-item', `alert-${a.level}`]"
      >
        <div class="alert-type">
          <span v-if="a.type === 'plan_triggered'">📌</span>
          <span v-else-if="a.type === 'plan_approaching'">⏳</span>
          <span v-else-if="a.type === 'stop_loss'">🛑</span>
          <span v-else-if="a.type === 'price_swing'">📊</span>
          <span v-else>🔔</span>
        </div>
        <div class="alert-body">
          <div class="alert-message">{{ a.message }}</div>
          <div class="alert-meta">
            <span v-if="a.symbol" class="alert-asset-tag">{{ a.symbol }}</span>
          </div>
        </div>
        <div class="alert-action">
          <router-link v-if="a.strategy_id" :to="`/strategies/${a.strategy_id}`" class="btn btn-sm">{{ t('dashboard.view') }}</router-link>
          <button v-else-if="a.type === 'plan_triggered'" class="btn btn-sm btn-primary" @click="markDone(a.id)">{{ t('dashboard.complete') }}</button>
        </div>
      </div>
      <div v-if="alerts.length > 2" class="alert-section-footer">
        <router-link to="/alerts" class="alert-view-all">{{ t('dashboard.viewAllAlerts', { count: alerts.length }) }}</router-link>
      </div>
    </div>

    <div v-if="!initialized" class="grid-4" style="margin-bottom:20px">
      <div class="stat-card" v-for="i in 4" :key="i">
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-price" style="height:24px;width:80px"></div>
      </div>
    </div>
    <div v-else class="grid-4" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.totalInvested') }}</div>
        <div class="stat-value stat-value-wrap">¥{{ fmt(summary.total_invested) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.marketValue') }}</div>
        <div class="stat-value stat-value-wrap">¥{{ fmt(summary.total_market_value) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.totalPnl') }}</div>
        <div class="stat-value stat-value-wrap" :class="summary.total_pl >= 0 ? 'pnl positive' : 'pnl negative'">
          {{ summary.total_pl >= 0 ? '+' : '' }}¥{{ fmt(Math.abs(summary.total_pl)) }}
        </div>
        <div class="stat-sub" :class="summary.total_pl_pct >= 0 ? 'pnl positive' : 'pnl negative'">
          {{ summary.total_pl_pct >= 0 ? '+' : '' }}{{ fmtPct(summary.total_pl_pct) }}%
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.assetCount') }}</div>
        <div class="stat-value">{{ allocation.length }}</div>
        <div class="stat-sub">{{ t('dashboard.activeStrategies', { count: activePlans.length }) }}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="section-title">{{ t('dashboard.allocationTitle') }}</div>
        <div v-if="allocation.length">
          <div v-for="a in allocation" :key="a.asset_id" class="alloc-item">
            <div class="alloc-header">
              <span class="alloc-name icon-text"><span class="icon">{{ a.icon }}</span> {{ a.name }}</span>
              <span class="alloc-weight">{{ fmtPct(a.weight) }}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill green" :style="{width: Math.max(a.weight || 0, 2)+'%'}"></div></div>
            <div class="alloc-footer">
              <span style="color:var(--text-muted)">{{ t('dashboard.invested', { symbol: cs(a), value: fmt(a.total_invested) }) }}</span>
              <span v-if="a.has_real_price" :class="a.pl >= 0 ? 'pnl positive' : 'pnl negative'">
                {{ a.pl >= 0 ? '+' : '' }}{{ fmtPl(a.pl) }} ({{ a.pl_pct >= 0 ? '+' : '' }}{{ fmtPct(a.pl_pct) }}%)
              </span>
              <span v-else class="no-price-hint">{{ t('dashboard.noPrice') }}</span>
            </div>
          </div>
        </div>
        <div v-else class="empty"><div class="empty-icon">📭</div><p>{{ t('dashboard.emptyAssets') }}</p></div>
      </div>

      <div class="card">
        <div class="section-title">{{ t('dashboard.activePlansTitle') }}</div>
        <div v-if="activePlans.length">
          <table class="hide-mobile">
            <thead><tr><th>{{ t('history.asset') }}</th><th>{{ t('dashboard.trigger') }}</th><th>{{ t('dashboard.action') }}</th><th>{{ t('holdings.status') }}</th></tr></thead>
            <tbody>
              <tr v-for="p in activePlans" :key="p.id">
                <td>{{ p.asset_name }}</td>
                <td>{{ p.trigger_type === 'price_above' ? '≥' : '≤' }} {{ p.trigger_value }}</td>
                <td><span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? t('history.buy') : t('history.sell') }}</span></td>
                <td><span class="badge" :class="p.status === 'triggered' ? 'badge-triggered' : 'badge-pending'">{{ p.status === 'triggered' ? t('dashboard.status.triggered') : t('dashboard.status.pending') }}</span></td>
              </tr>
            </tbody>
          </table>
          <div class="show-mobile mini-cards">
            <div v-for="p in activePlans" :key="p.id" class="mini-card">
              <div class="mini-card-row">
                <span style="font-weight:600">{{ p.asset_name }}</span>
                <span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? t('history.buy') : t('history.sell') }}</span>
              </div>
              <div class="mini-card-row">
                <span class="text-muted">{{ p.trigger_type === 'price_above' ? '≥' : '≤' }} {{ p.trigger_value }}</span>
                <span class="badge" :class="p.status === 'triggered' ? 'badge-triggered' : 'badge-pending'">{{ p.status === 'triggered' ? t('dashboard.status.triggered') : t('dashboard.status.pending') }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty" style="padding:24px"><p>{{ t('dashboard.emptyActivePlans') }}</p></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="signals-head">
        <div class="section-title" style="margin:0">{{ t('signals.title') }}</div>
        <router-link to="/signals" class="btn btn-sm">{{ t('common.viewAll') }}</router-link>
      </div>
      <div v-if="heldSignals.length" class="signal-compact-grid">
        <router-link v-for="signal in heldSignals" :key="signal.id" to="/signals" class="signal-compact-card">
          <div class="signal-compact-top">
            <span class="signal-compact-name">{{ signal.icon }} {{ signal.asset_name }}</span>
            <span class="badge" :class="signalBadgeClass(signal.signal_type)">{{ signalLabel(signal.signal_type) }}</span>
          </div>
          <div class="signal-compact-summary">{{ signal.summary }}</div>
        </router-link>
      </div>
      <div v-else class="empty" style="padding:24px">
        <p>{{ t('dashboard.emptySignalsBeforeLink') }} <router-link to="/signals">{{ t('signals.title') }}</router-link> {{ t('dashboard.emptySignalsAfterLink') }}</p>
      </div>
    </div>

    <div class="card">
      <div class="section-title">{{ t('dashboard.recentTradesTitle') }}</div>
      <table v-if="recentTrades.length" class="hide-mobile">
        <thead><tr><th>{{ t('history.date') }}</th><th>{{ t('history.asset') }}</th><th>{{ t('history.type') }}</th><th>{{ t('history.quantity') }}</th><th>{{ t('history.price') }}</th><th>{{ t('history.total') }}</th></tr></thead>
        <tbody>
          <tr v-for="trade in recentTrades" :key="trade.id">
            <td>{{ fmtDate(trade.executed_at) }}</td>
            <td>{{ trade.name }}</td>
            <td><span class="badge" :class="trade.type === 'buy' ? 'badge-buy' : 'badge-sell'">{{ trade.type === 'buy' ? t('history.buy') : t('history.sell') }}</span></td>
            <td>{{ trade.quantity }}</td>
            <td>¥{{ fmt(trade.price) }}</td>
            <td :class="trade.type === 'buy' ? 'pnl negative' : 'pnl positive'">{{ trade.type === 'buy' ? '-' : '+' }}¥{{ fmt(trade.total) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="recentTrades.length" class="show-mobile mini-cards">
        <div v-for="trade in recentTrades" :key="trade.id" class="mini-card">
          <div class="mini-card-row">
            <span style="font-weight:600">{{ trade.name }}</span>
            <span class="badge" :class="trade.type === 'buy' ? 'badge-buy' : 'badge-sell'">{{ trade.type === 'buy' ? t('history.buy') : t('history.sell') }}</span>
          </div>
          <div class="mini-card-row">
            <span class="text-muted">{{ t('dashboard.tradeMeta', { date: fmtDate(trade.executed_at), quantity: trade.quantity }) }}</span>
            <span :class="trade.type === 'buy' ? 'pnl negative' : 'pnl positive'">{{ trade.type === 'buy' ? '-' : '+' }}¥{{ fmt(trade.total) }}</span>
          </div>
        </div>
      </div>
      <div v-if="!recentTrades.length" class="empty" style="padding:24px"><p>{{ t('dashboard.emptyTrades') }}</p></div>
    </div>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '../stores/notifications.js'
import { useRuntimeSettingsStore } from '../stores/runtime-settings.js'
import { api } from '../utils/api.js'
import { currencySymbol } from '../utils/currency.js'
import { formatDate, formatNumber, formatTime } from '../utils/formatters.js'
import PullRefreshView from '../components/PullRefreshView.vue'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const runtimeSettingsStore = useRuntimeSettingsStore()
const summary = ref({ total_invested: 0, total_market_value: 0, total_pl: 0, total_pl_pct: 0 })
const allocation = ref([])
const activePlans = ref([])
const recentTrades = ref([])
const latestSignals = ref([])
const alerts = ref([])
const loading = ref(false)
const initialized = ref(false)
const usdCny = ref(null)
const lastUpdated = ref(null)
let refreshTimer = null

const alertCounts = computed(() => {
  const c = { danger: 0, warning: 0, info: 0 }
  alerts.value.forEach(a => { if (c[a.level] !== undefined) c[a.level]++ })
  return c
})
const heldSignals = computed(() => {
  const ids = new Set(allocation.value.map(item => item.asset_id))
  return latestSignals.value.filter(item => ids.has(item.asset_id))
})

async function refresh() {
  loading.value = true
  try {
    const [summaryRes, rateRes, signalsRes] = await Promise.all([
      api('/api/dashboard/summary'),
      api('/api/market/rate'),
      api('/api/signals/latest'),
    ])
    const sJson = await summaryRes.json()
    const rJson = await rateRes.json()
    const sigJson = await signalsRes.json()

    if (sJson.data) {
      summary.value = sJson.data.summary
      allocation.value = sJson.data.allocation || []
      activePlans.value = sJson.data.active_plans || []
      recentTrades.value = sJson.data.recent_trades || []
    }
    await refreshAlerts()
    if (rJson.data) usdCny.value = rJson.data.usd_cny
    latestSignals.value = sigJson.data || []
    lastUpdated.value = new Date()
  } catch (e) { console.error(e) }
  loading.value = false
  initialized.value = true
}

async function refreshAlerts() {
  const res = await api('/api/dashboard/alerts')
  const json = await res.json()
  if (json.data) alerts.value = json.data
}

async function markDone(id) {
  try {
    await api(`/api/notifications/${id}/read`, { method: 'PUT' })
    await notificationsStore.notifyChanged()
  } catch { /* ignore */ }
  alerts.value = alerts.value.filter(a => a.id !== id)
}

async function ensureRuntimeSettings() {
  if (Object.keys(runtimeSettingsStore.values || {}).length > 0) return
  try {
    await runtimeSettingsStore.syncFromServer()
  } catch {}
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  const seconds = Math.max(0, Math.trunc(runtimeSettingsStore.getNumber('refresh_interval', 60)))
  if (seconds > 0) {
    refreshTimer = setInterval(() => {
      refresh().catch(() => {})
    }, seconds * 1000)
  }
}

function fmt(n) {
  return formatNumber(n, { maximumFractionDigits: 2 })
}
function fmtPl(n) {
  if (n === null || n === undefined || n === '') return '-'
  const num = Number(n)
  if (!Number.isFinite(num)) return '-'
  if (num === 0) return '0'
  const sign = num >= 0 ? '+' : '-'
  return `${sign}${fmt(Math.abs(num))}`
}
function cs(a) { return currencySymbol(a?.currency) }
function fmtPct(n) {
  if (!n && n !== 0) return '0.0'
  return Number(n).toFixed(1)
}
function signalLabel(type) {
  return {
    bullish: t('signals.bullish'),
    bearish: t('signals.bearish'),
    neutral: t('signals.neutral'),
  }[type] || t('signals.neutral')
}
function signalBadgeClass(type) {
  return { bullish: 'badge-market-up', bearish: 'badge-market-down', neutral: 'badge-pending' }[type] || 'badge-pending'
}
function fmtDate(value) {
  return formatDate(value)
}
function fmtUpdateTime(d) {
  return formatTime(d)
}

watch(() => notificationsStore.changeToken, () => {
  if (!initialized.value) return
  refreshAlerts().catch(() => {})
})

watch(() => runtimeSettingsStore.values.refresh_interval, (nextValue, prevValue) => {
  if (!initialized.value || nextValue === prevValue) return
  startAutoRefresh()
})

onMounted(async () => {
  await ensureRuntimeSettings()
  await refresh()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.rate-badge {
  font-size: 11px;
  color: var(--text-dim);
  background: var(--bg-dim, #f5f5f5);
  padding: 2px 8px;
  border-radius: 4px;
}
.update-time {
  font-size: 11px;
  color: var(--text-muted);
}
.btn-inline-icon {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-inline-icon svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.alert-section {
  margin-bottom: 20px;
}
.alert-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.alert-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 8px;
}
.alert-type {
  font-size: 14px;
  line-height: 1.4;
}
.alert-body {
  flex: 1;
  min-width: 0;
}
.alert-message {
  font-size: 13px;
  line-height: 1.5;
}
.alert-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 12px;
}
.alert-action {
  display: flex;
  align-items: center;
}
.alert-section-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
.alert-view-all {
  font-size: 13px;
  color: var(--primary);
  text-decoration: none;
}
.alert-view-all:hover {
  text-decoration: underline;
}
.stat-value-wrap {
  white-space: normal;
  word-break: break-all;
  overflow: visible;
}
.alloc-item {
  margin-bottom: 14px;
}
.alloc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 4px;
}
.alloc-name {
  font-weight: 500;
}
.alloc-weight {
  color: var(--text-dim);
  font-size: 12px;
}
.alloc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  margin-top: 4px;
}
.no-price-hint {
  color: var(--text-muted);
  font-size: 11px;
  font-style: italic;
}
.signals-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.signal-compact-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.signal-compact-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  text-decoration: none;
  color: inherit;
}
.signal-compact-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.signal-compact-name {
  font-size: 13px;
  font-weight: 600;
}
.signal-compact-summary {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mini-cards {
  flex-direction: column;
  gap: 8px;
}
.mini-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}
.mini-card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.mini-card-row + .mini-card-row {
  margin-top: 4px;
}
.text-muted {
  color: var(--text-muted);
  font-size: 12px;
}

@media (max-width: 768px) {
  .stat-value-wrap {
    font-size: 16px;
  }
  .signals-head {
    align-items: flex-start;
  }
  .signal-compact-grid {
    grid-template-columns: 1fr;
  }
  .alert-item {
    padding: 8px 10px;
  }
  .alert-action {
    align-self: center;
  }
}
</style>
