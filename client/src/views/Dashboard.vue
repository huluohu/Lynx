<template>
  <PullRefreshView :onRefresh="refresh">
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('dashboard.title') }}</h1>
      <div class="page-header-right">
        <div class="page-header-meta">
          <span v-if="lastUpdated" class="page-header-meta-item">{{ t('dashboard.updatedAt', { time: fmtUpdateTime(lastUpdated) }) }}</span>
          <span v-if="usdCny" class="rate-badge">USD/CNY {{ usdCny.toFixed(4) }}</span>
        </div>
        <div class="desktop-only">
          <div class="page-header-actions">
            <button class="btn btn-inline-icon" @click="refresh" :disabled="loading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              <span>{{ loading ? t('dashboard.refreshing') : t('dashboard.refresh') }}</span>
            </button>
          </div>
        </div>
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
        <div class="stat-value stat-value-wrap">{{ money(summary.total_invested, 'CNY') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.marketValue') }}</div>
        <div class="stat-value stat-value-wrap">{{ money(summary.total_market_value, 'CNY') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.totalPnl') }}</div>
        <div class="stat-value stat-value-wrap" :class="summary.total_pl >= 0 ? 'pnl positive' : 'pnl negative'">
          {{ signedMoney(summary.total_pl, 'CNY') }}
        </div>
        <div class="stat-sub" :class="summary.total_pl_pct >= 0 ? 'pnl positive' : 'pnl negative'">
          {{ summary.total_pl_pct >= 0 ? '+' : '' }}{{ fmtPct(summary.total_pl_pct) }}%
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('dashboard.assetCount') }}</div>
        <div class="stat-value">{{ allocation.length }}</div>
        <div class="stat-sub">{{ t('dashboard.activeStrategies', { count: summary.active_strategy_count || 0 }) }}</div>
      </div>
    </div>

    <TrendChart
      v-model="trendRange"
      :title="t('dashboard.profitTrendTitle')"
      :subtitle="t('dashboard.profitTrendSubtitle')"
      :points="trendData.points"
      :summary="trendData.summary"
      :loading="trendLoading"
      :empty-text="t('trend.emptyProfit')"
      :value-formatter="baseMoney"
      :percent-formatter="formatTrendPercent"
    />

    <div v-if="alerts.length" class="alert-section">
      <div class="alert-digest-card">
        <div class="alert-digest-main">
          <div class="alert-digest-title">🔔 {{ t('dashboard.alertsSummary') }}</div>
          <div class="alert-digest-subtitle">{{ t('dashboard.alertsTitle', { count: alerts.length }) }}</div>
        </div>
        <div class="alert-digest-stats">
          <span v-if="alertCounts.danger" class="alert-count-pill danger">{{ t('dashboard.priority.dangerShort') }} {{ alertCounts.danger }}</span>
          <span v-if="alertCounts.warning" class="alert-count-pill warning">{{ t('dashboard.priority.warningShort') }} {{ alertCounts.warning }}</span>
          <span v-if="alertCounts.info" class="alert-count-pill info">{{ t('dashboard.priority.infoShort') }} {{ alertCounts.info }}</span>
        </div>
        <router-link to="/alerts" class="alert-digest-link">{{ t('dashboard.viewAllAlerts', { count: alerts.length }) }}</router-link>
      </div>

      <div v-if="primaryAlert" class="alert-primary-card" :class="`alert-primary-${primaryAlert.level}`">
        <div class="alert-primary-head">
          <div class="alert-primary-tags">
            <span class="alert-priority-badge" :class="primaryAlert.level">{{ priorityLabel(primaryAlert.level) }}</span>
            <span class="alert-type-badge">{{ alertTypeLabel(primaryAlert.type) }}</span>
            <span v-if="primaryAlert.symbol" class="alert-asset-tag">{{ primaryAlert.symbol }}</span>
          </div>
          <span class="alert-primary-icon">{{ alertIcon(primaryAlert.type) }}</span>
        </div>
        <div class="alert-primary-message">{{ primaryAlert.message }}</div>
        <div class="alert-primary-footer">
          <span v-if="remainingAlertsCount > 0" class="alert-primary-more">{{ t('dashboard.moreAlerts', { count: remainingAlertsCount }) }}</span>
          <div class="alert-primary-actions">
            <router-link v-if="primaryAlert.strategy_id" :to="`/strategies/${primaryAlert.strategy_id}`" class="btn btn-sm">{{ t('dashboard.view') }}</router-link>
            <button v-else-if="primaryAlert.type === 'plan_triggered'" class="btn btn-sm btn-primary" @click="markDone(primaryAlert.id)">{{ t('dashboard.complete') }}</button>
            <router-link v-else to="/alerts" class="btn btn-sm">{{ t('dashboard.view') }}</router-link>
          </div>
        </div>
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
                {{ signedMoney(a.pl, a.currency) }} ({{ a.pl_pct >= 0 ? '+' : '' }}{{ fmtPct(a.pl_pct) }}%)
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
            <td>{{ money(trade.price, trade.currency) }}</td>
            <td :class="trade.type === 'buy' ? 'pnl negative' : 'pnl positive'">{{ tradeSignedTotal(trade) }}</td>
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
            <span :class="trade.type === 'buy' ? 'pnl negative' : 'pnl positive'">{{ tradeSignedTotal(trade) }}</span>
          </div>
        </div>
      </div>
      <div v-if="!recentTrades.length" class="empty" style="padding:24px"><p>{{ t('dashboard.emptyTrades') }}</p></div>
    </div>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '../stores/notifications.js'
import { useRuntimeSettingsStore } from '../stores/runtime-settings.js'
import { api } from '../utils/api.js'
import { currencySymbol, formatCurrencyAmount, formatSignedCurrencyAmount } from '../utils/currency.js'
import { formatDate, formatNumber, formatTime } from '../utils/formatters.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import PullRefreshView from '../components/PullRefreshView.vue'
import TrendChart from '../components/TrendChart.vue'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
const runtimeSettingsStore = useRuntimeSettingsStore()
const summary = ref({ total_invested: 0, total_market_value: 0, total_pl: 0, total_pl_pct: 0, active_strategy_count: 0 })
const allocation = ref([])
const activePlans = ref([])
const recentTrades = ref([])
const latestSignals = ref([])
const alerts = ref([])
const trendRange = ref('1m')
const trendData = ref({ points: [], summary: null })
const trendLoading = ref(false)
const loading = ref(false)
const initialized = ref(false)
const usdCny = ref(null)
const lastUpdated = ref(null)
const mobilePageActions = useMobilePageActions()
let refreshTimer = null

const alertCounts = computed(() => {
  const c = { danger: 0, warning: 0, info: 0 }
  alerts.value.forEach(a => { if (c[a.level] !== undefined) c[a.level]++ })
  return c
})
const prioritizedAlerts = computed(() => [...alerts.value].sort((left, right) => {
  const levelOrder = { danger: 0, warning: 1, info: 2 }
  const typeOrder = { stop_loss: 0, plan_triggered: 1, plan_approaching: 2, price_swing: 3, trade_executed: 4 }
  const levelDiff = (levelOrder[left.level] ?? 9) - (levelOrder[right.level] ?? 9)
  if (levelDiff !== 0) return levelDiff
  const typeDiff = (typeOrder[left.type] ?? 9) - (typeOrder[right.type] ?? 9)
  if (typeDiff !== 0) return typeDiff
  return Number(right.id || 0) - Number(left.id || 0)
}))
const primaryAlert = computed(() => prioritizedAlerts.value[0] || null)
const remainingAlertsCount = computed(() => Math.max(alerts.value.length - 1, 0))
const heldSignals = computed(() => {
  const ids = new Set(allocation.value.map(item => item.asset_id))
  return latestSignals.value.filter(item => ids.has(item.asset_id))
})

async function refresh() {
  loading.value = true
  try {
    const res = await api('/api/dashboard/overview')
    const json = await res.json()
    if (json.data) {
      summary.value = json.data.summary || summary.value
      allocation.value = json.data.allocation || []
      activePlans.value = json.data.active_plans || []
      recentTrades.value = json.data.recent_trades || []
      alerts.value = json.data.alerts || []
      latestSignals.value = json.data.latest_signals || []
      usdCny.value = json.data.usd_cny || null
    }
    lastUpdated.value = new Date()
  } catch (e) { console.error(e) }
  loading.value = false
  initialized.value = true
  fetchTrend().catch(() => {})
}

async function fetchTrend() {
  trendLoading.value = true
  try {
    const res = await api(`/api/dashboard/profit-trend?range=${encodeURIComponent(trendRange.value)}`)
    const json = await res.json()
    if (json.success && json.data) trendData.value = json.data
  } catch (e) { console.error(e) }
  trendLoading.value = false
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
function cs(a) { return currencySymbol(a?.currency) }
function money(value, currency) {
  return formatCurrencyAmount(value, currency, { maximumFractionDigits: 2 })
}
function signedMoney(value, currency) {
  return formatSignedCurrencyAmount(value, currency, { maximumFractionDigits: 2 })
}
function baseMoney(value) {
  return formatCurrencyAmount(value, 'CNY', { maximumFractionDigits: 2 })
}
function formatTrendPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}
function tradeSignedTotal(trade) {
  if (!trade) return '-'
  const prefix = trade.type === 'buy' ? '-' : '+'
  return `${prefix}${money(trade.total, trade.currency)}`
}
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
function alertIcon(type) {
  return { plan_triggered: '📌', plan_approaching: '⏳', stop_loss: '🛑', price_swing: '📊', trade_executed: '💱' }[type] || '🔔'
}
function alertTypeLabel(type) {
  return {
    plan_triggered: t('alertHistory.types.planTriggered'),
    plan_approaching: t('alertHistory.types.planApproaching'),
    stop_loss: t('alertHistory.types.stopLoss'),
    price_swing: t('alertHistory.types.priceSwing'),
    trade_executed: t('alertHistory.types.tradeExecuted'),
  }[type] || t('dashboard.alertsSummary')
}
function priorityLabel(level) {
  return {
    danger: t('dashboard.priority.danger'),
    warning: t('dashboard.priority.warning'),
    info: t('dashboard.priority.info'),
  }[level] || t('dashboard.priority.info')
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

watch(trendRange, () => {
  fetchTrend().catch(() => {})
})

watchEffect(() => {
  mobilePageActions.setActions([
    {
      key: 'refresh-dashboard',
      label: loading.value ? t('dashboard.refreshing') : t('dashboard.refresh'),
      disabled: loading.value,
      onSelect: refresh,
    },
  ])
})

onMounted(async () => {
  await ensureRuntimeSettings()
  await refresh()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
  mobilePageActions.clearActions()
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}
.alert-digest-card,
.alert-primary-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 14px 16px;
}
.alert-digest-card {
  display: flex;
  align-items: center;
  gap: 12px;
}
.alert-digest-main {
  min-width: 0;
}
.alert-digest-title {
  font-size: 14px;
  font-weight: 600;
}
.alert-digest-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-dim);
}
.alert-digest-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}
.alert-count-pill,
.alert-priority-badge,
.alert-type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
}
.alert-count-pill.danger,
.alert-priority-badge.danger {
  background: var(--danger-soft);
  color: var(--red);
}
.alert-count-pill.warning,
.alert-priority-badge.warning {
  background: var(--warning-soft);
  color: var(--warning);
}
.alert-count-pill.info,
.alert-priority-badge.info {
  background: var(--info-soft);
  color: var(--blue);
}
.alert-type-badge {
  background: var(--bg-hover);
  color: var(--text-dim);
}
.alert-digest-link {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--primary);
}
.alert-primary-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.alert-primary-danger {
  border-color: var(--danger-border);
}
.alert-primary-warning {
  border-color: rgba(245, 158, 11, 0.3);
}
.alert-primary-head,
.alert-primary-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.alert-primary-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.alert-primary-icon {
  font-size: 20px;
  line-height: 1;
}
.alert-primary-message {
  font-size: 14px;
  line-height: 1.6;
}
.alert-asset-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-dim);
  font-size: 11px;
}
.alert-primary-more {
  font-size: 12px;
  color: var(--text-dim);
}
.alert-primary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
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
  .hide-on-mobile {
    display: none !important;
  }
  .stat-value-wrap {
    font-size: 16px;
  }
  .signals-head {
    align-items: flex-start;
  }
  .signal-compact-grid {
    grid-template-columns: 1fr;
  }
  .alert-digest-card,
  .alert-primary-card {
    padding: 12px;
  }
  .alert-digest-card,
  .alert-primary-head,
  .alert-primary-footer {
    align-items: flex-start;
    flex-direction: column;
  }
  .alert-digest-stats,
  .alert-primary-actions {
    margin-left: 0;
  }
}
</style>
