<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">仪表盘</h1>
      <div style="display:flex;align-items:center;gap:12px">
        <span v-if="usdCny" class="rate-badge">USD/CNY {{ usdCny.toFixed(4) }}</span>
        <button class="btn btn-inline-icon" @click="refresh" :disabled="loading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>{{ loading ? '刷新中...' : '刷新' }}</span>
        </button>
      </div>
    </div>

    <div v-if="alerts.length" class="alert-section">
      <div class="alert-section-header">
        <div class="alert-section-title">
          <span>🔔 提醒 ({{ alerts.length }})</span>
          <span style="font-size:12px;color:var(--text-muted)">
            <template v-if="alertCounts.danger">🔴 {{ alertCounts.danger }}</template>
            <template v-if="alertCounts.warning"> 🟡 {{ alertCounts.warning }}</template>
            <template v-if="alertCounts.info"> 🔵 {{ alertCounts.info }}</template>
          </span>
        </div>
      </div>
      <div
        v-for="a in alerts.slice(0, 3)"
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
            <span v-if="a.type === 'plan_approaching' && a.diff_pct" class="alert-gauge">
              <span class="gauge-bar"><span class="gauge-fill" :style="{width: Math.min(100 - a.diff_pct * 20, 100) + '%'}" :class="a.diff_pct <= 2 ? 'red' : a.diff_pct <= 5 ? 'orange' : ''"></span></span>
              <span class="gauge-label">差{{ a.diff_pct.toFixed(1) }}%</span>
            </span>
            <span v-if="a.symbol" class="alert-asset-tag">{{ a.symbol }}</span>
            <span v-if="a.change_pct" :class="a.change_pct >= 0 ? 'pnl positive' : 'pnl negative'">{{ a.change_pct >= 0 ? '+' : '' }}{{ a.change_pct.toFixed(1) }}%</span>
          </div>
        </div>
        <div class="alert-action">
          <router-link v-if="a.strategy_id" :to="`/strategies/${a.strategy_id}`" class="btn btn-sm">查看</router-link>
          <button v-else-if="a.type === 'plan_triggered'" class="btn btn-sm btn-primary" @click="markDone(a.id)">完成</button>
        </div>
      </div>
      <div v-if="alerts.length > 3" class="alert-section-footer">
        <router-link to="/alerts" class="alert-view-all">查看全部 →</router-link>
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
        <div class="stat-label">总投入</div>
        <div class="stat-value stat-value-wrap">¥{{ fmt(summary.total_invested) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">当前市值</div>
        <div class="stat-value stat-value-wrap">¥{{ fmt(summary.total_market_value) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总盈亏</div>
        <div class="stat-value stat-value-wrap" :class="summary.total_pl >= 0 ? 'pnl positive' : 'pnl negative'">
          {{ summary.total_pl >= 0 ? '+' : '' }}¥{{ fmt(Math.abs(summary.total_pl)) }}
        </div>
        <div class="stat-sub" :class="summary.total_pl_pct >= 0 ? 'pnl positive' : 'pnl negative'">
          {{ summary.total_pl_pct >= 0 ? '+' : '' }}{{ fmtPct(summary.total_pl_pct) }}%
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">资产数量</div>
        <div class="stat-value">{{ allocation.length }}</div>
        <div class="stat-sub">活跃策略 {{ activePlans.length }}</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="section-title">资产配置</div>
        <div v-if="allocation.length">
          <div v-for="a in allocation" :key="a.asset_id" class="alloc-item">
            <div class="alloc-header">
              <span class="alloc-name icon-text"><span class="icon">{{ a.icon }}</span> {{ a.name }}</span>
              <span class="alloc-weight">{{ fmtPct(a.weight) }}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill green" :style="{width: Math.max(a.weight || 0, 2)+'%'}"></div></div>
            <div class="alloc-footer">
              <span style="color:var(--text-muted)">投入 {{ cs(a) }}{{ fmt(a.total_invested) }}</span>
              <span v-if="a.has_real_price" :class="a.pl >= 0 ? 'pnl positive' : 'pnl negative'">
                {{ a.pl >= 0 ? '+' : '' }}{{ fmtPl(a.pl) }} ({{ a.pl_pct >= 0 ? '+' : '' }}{{ fmtPct(a.pl_pct) }}%)
              </span>
              <span v-else class="no-price-hint">暂无行情</span>
            </div>
          </div>
        </div>
        <div v-else class="empty"><div class="empty-icon">📭</div><p>暂无资产</p></div>
      </div>

      <div class="card">
        <div class="section-title">活跃计划</div>
        <div v-if="activePlans.length">
          <table>
            <thead><tr><th>资产</th><th>触发</th><th>操作</th><th>数量</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="p in activePlans" :key="p.id">
                <td>{{ p.asset_name }}</td>
                <td>{{ p.trigger_type === 'price_above' ? '≥' : '≤' }} {{ p.trigger_value }}</td>
                <td><span class="badge" :class="p.action === 'buy' ? 'badge-buy' : 'badge-sell'">{{ p.action === 'buy' ? '买入' : '卖出' }}</span></td>
                <td>{{ p.quantity ? p.quantity.toFixed(4) : '-' }}</td>
                <td><span class="badge" :class="p.status === 'triggered' ? 'badge-triggered' : 'badge-pending'">{{ p.status === 'triggered' ? '⚡触发' : '等待' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty" style="padding:24px"><p>暂无活跃计划，去创建策略吧 👉</p></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="signals-head">
        <div class="section-title" style="margin:0">市场信号</div>
        <router-link to="/signals" class="btn btn-sm">查看全部</router-link>
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
        <p>暂无持仓资产的市场信号，前往 <router-link to="/signals">/signals</router-link> 生成分析。</p>
      </div>
    </div>

    <div class="card">
      <div class="section-title">最近交易</div>
      <table v-if="recentTrades.length">
        <thead><tr><th>时间</th><th>资产</th><th>类型</th><th>数量</th><th>价格</th><th>金额</th></tr></thead>
        <tbody>
          <tr v-for="t in recentTrades" :key="t.id">
            <td>{{ t.executed_at?.slice(0,10) }}</td>
            <td>{{ t.name }}</td>
            <td><span class="badge" :class="t.type === 'buy' ? 'badge-buy' : 'badge-sell'">{{ t.type === 'buy' ? '买入' : '卖出' }}</span></td>
            <td>{{ t.quantity }}</td>
            <td>¥{{ t.price }}</td>
            <td :class="t.type === 'buy' ? 'pnl negative' : 'pnl positive'">{{ t.type === 'buy' ? '-' : '+' }}¥{{ fmt(t.total) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty" style="padding:24px"><p>暂无交易记录</p></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { currencySymbol } from '../utils/currency.js'

const summary = ref({ total_invested: 0, total_market_value: 0, total_pl: 0, total_pl_pct: 0 })
const allocation = ref([])
const activePlans = ref([])
const recentTrades = ref([])
const latestSignals = ref([])
const alerts = ref([])
const loading = ref(false)
const initialized = ref(false)
const usdCny = ref(null)

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
    const [summaryRes, alertsRes, rateRes, signalsRes] = await Promise.all([
      api('/api/dashboard/summary'),
      api('/api/dashboard/alerts'),
      api('/api/market/rate'),
      api('/api/signals/latest'),
    ])
    const sJson = await summaryRes.json()
    const aJson = await alertsRes.json()
    const rJson = await rateRes.json()
    const sigJson = await signalsRes.json()

    if (sJson.data) {
      summary.value = sJson.data.summary
      allocation.value = sJson.data.allocation || []
      activePlans.value = sJson.data.active_plans || []
      recentTrades.value = sJson.data.recent_trades || []
    }
    if (aJson.data) alerts.value = aJson.data
    if (rJson.data) usdCny.value = rJson.data.usd_cny
    latestSignals.value = sigJson.data || []
  } catch (e) { console.error(e) }
  loading.value = false
  initialized.value = true
}

function markDone(id) {
  alerts.value = alerts.value.filter(a => a.id !== id)
}

function fmt(n) {
  if (!n && n !== 0) return '-'
  const abs = Math.abs(n)
  if (abs >= 100000000) return (n / 100000000).toFixed(2) + '亿'
  if (abs >= 10000) return (n / 10000).toFixed(1) + '万'
  if (abs < 1) return Number(n).toFixed(2)
  return Math.round(n).toLocaleString()
}
function fmtPl(n) {
  if (n === null || n === undefined) return '-'
  if (Math.abs(n) < 1) return '±0'
  const sign = n >= 0 ? '+' : '-'
  return `${sign}${fmt(Math.abs(n))}`
}
function cs(a) { return currencySymbol(a?.currency) }
function fmtPct(n) {
  if (!n && n !== 0) return '0.0'
  return Number(n).toFixed(1)
}
function signalLabel(type) { return { bullish: '看涨', bearish: '看跌', neutral: '中性' }[type] || '中性' }
function signalBadgeClass(type) {
  return { bullish: 'badge-buy', bearish: 'badge-sell', neutral: 'badge-pending' }[type] || 'badge-pending'
}

onMounted(refresh)
</script>

<style scoped>
.rate-badge {
  font-size: 11px;
  color: var(--text-dim);
  background: var(--bg-dim, #f5f5f5);
  padding: 2px 8px;
  border-radius: 4px;
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
