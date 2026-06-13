<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">📊 仪表盘</h1>
      <button class="btn" @click="refresh" :disabled="loading">{{ loading ? '刷新中...' : '🔄 刷新' }}</button>
    </div>

    <!-- ===== 提醒模块 ===== -->
    <div v-if="alerts.length" class="alert-section" style="margin-bottom:20px">
      <div class="alert-section-header">
        <span>🔔 提醒 ({{ alerts.length }})</span>
        <span style="font-size:12px;color:var(--text-muted)">danger {{ alertCounts.danger }} · warning {{ alertCounts.warning }} · info {{ alertCounts.info }}</span>
      </div>
      <div
        v-for="a in alerts"
        :key="a.id"
        :class="['alert-item', `alert-${a.level}`]"
      >
        <div class="alert-type">
          <span v-if="a.type === 'plan_triggered'">📌</span>
          <span v-else-if="a.type === 'plan_approaching'">⏳</span>
          <span v-else-if="a.type === 'stop_loss'">🛑</span>
          <span v-else-if="a.type === 'price_swing'">📊</span>
        </div>
        <div class="alert-body">
          <div class="alert-message">{{ a.message }}</div>
          <div class="alert-meta">
            <span v-if="a.type === 'plan_approaching' && a.diff_pct" class="alert-gauge">
              <span class="gauge-bar"><span class="gauge-fill" :style="{width: Math.min(100 - a.diff_pct * 20, 100) + '%'}" :class="a.diff_pct <= 2 ? 'red' : a.diff_pct <= 5 ? 'orange' : ''"></span></span>
              <span class="gauge-label">{{ a.diff_pct.toFixed(1) }}%</span>
            </span>
            <span v-if="a.asset_icon">{{ a.asset_icon }} {{ a.symbol }}</span>
            <span v-if="a.change_pct" :class="a.change_pct >= 0 ? 'pnl positive' : 'pnl negative'">{{ a.change_pct >= 0 ? '+' : '' }}{{ a.change_pct.toFixed(1) }}%</span>
          </div>
        </div>
        <div class="alert-action" v-if="a.type === 'plan_triggered'">
          <router-link :to="`/strategies/${a.plan_id?.toString().split('-')[0] || ''}`" class="btn btn-sm" v-if="a.plan_id">查看</router-link>
          <button v-else class="btn btn-sm btn-primary" @click="markDone(a.id)">✓</button>
        </div>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid-4" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-label">总投入</div>
        <div class="stat-value">¥{{ fmt(summary.total_invested) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">当前市值</div>
        <div class="stat-value">¥{{ fmt(summary.total_market_value) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总盈亏</div>
        <div class="stat-value" :class="summary.total_pl >= 0 ? 'pnl positive' : 'pnl negative'">
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
      <!-- Asset allocation -->
      <div class="card">
        <div class="section-title">📊 资产配置</div>
        <div v-if="allocation.length" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div v-for="a in allocation" :key="a.asset_id" style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                <span>{{ a.icon }} {{ a.name }}</span>
                <span :class="a.pl >= 0 ? 'pnl positive' : 'pnl negative'">
                  {{ a.pl >= 0 ? '+' : '' }}¥{{ fmt(Math.abs(a.pl)) }}
                </span>
              </div>
              <div class="progress-bar"><div class="progress-fill green" :style="{width: Math.max(a.weight || 0, 2)+'%'}"></div></div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text-dim)">
            <div v-for="a in allocation" :key="a.asset_id" style="margin-bottom:4px">
              {{ a.icon }} {{ a.name }}: {{ fmtPct(a.weight) }}%
            </div>
          </div>
        </div>
        <div v-else class="empty"><div class="empty-icon">📭</div><p>暂无资产</p></div>
      </div>

      <!-- Active plans -->
      <div class="card">
        <div class="section-title">📋 活跃计划</div>
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

    <!-- Recent trades -->
    <div class="card">
      <div class="section-title">📝 最近交易</div>
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

const summary = ref({ total_invested: 0, total_market_value: 0, total_pl: 0, total_pl_pct: 0 })
const allocation = ref([])
const activePlans = ref([])
const recentTrades = ref([])
const alerts = ref([])
const loading = ref(false)

const alertCounts = computed(() => {
  const c = { danger: 0, warning: 0, info: 0 }
  alerts.value.forEach(a => { if (c[a.level] !== undefined) c[a.level]++ })
  return c
})

async function refresh() {
  loading.value = true
  try {
    const [summaryRes, alertsRes] = await Promise.all([
      fetch('/api/dashboard/summary'),
      fetch('/api/dashboard/alerts')
    ])
    const sJson = await summaryRes.json()
    const aJson = await alertsRes.json()

    if (sJson.data) {
      summary.value = sJson.data.summary
      allocation.value = sJson.data.allocation || []
      activePlans.value = sJson.data.active_plans || []
      recentTrades.value = sJson.data.recent_trades || []
    }
    if (aJson.data) {
      alerts.value = aJson.data
    }
  } catch (e) { console.error(e) }
  loading.value = false
}

function markDone(id) {
  alerts.value = alerts.value.filter(a => a.id !== id)
}

function fmt(n) {
  if (!n && n !== 0) return '-'
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(2) + '万'
  return Math.round(n).toLocaleString()
}
function fmtPct(n) {
  if (!n && n !== 0) return '0.0'
  return Number(n).toFixed(1)
}

onMounted(refresh)
</script>
