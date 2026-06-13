<template>
  <div>
    <div class="page-header"><h1 class="page-title">📋 操盘计划</h1></div>

    <div class="card" v-if="plans.length">
      <table>
        <thead><tr><th>#</th><th>资产</th><th>策略</th><th>触发</th><th>操作</th><th>数量</th><th>金额</th><th>补后均价</th><th>状态</th></tr></thead>
        <tbody>
          <tr v-for="p in plans" :key="p.id">
            <td>{{ p.seq }}</td>
            <td>{{ p.asset_name }} <span style="font-size:11px;color:var(--text-muted)">{{ p.symbol }}</span></td>
            <td style="font-size:12px;color:var(--text-dim)">ID:{{ p.strategy_id }}</td>
            <td>{{ triggerLabel(p.trigger_type) }} <b>{{ p.trigger_value }}</b></td>
            <td><span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'">{{ p.action==='buy'?'买入':'卖出' }}</span></td>
            <td>{{ p.quantity ? p.quantity.toFixed(4) : '-' }}</td>
            <td>{{ p.amount ? '¥'+Math.round(p.amount) : '-' }}</td>
            <td>{{ p.new_avg_cost ? '¥'+p.new_avg_cost : '-' }}</td>
            <td><span class="badge" :class="statusBadge(p.status)">{{ statusLabel(p.status) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="card empty"><div class="empty-icon">📋</div><p>暂无操盘计划，去创建一个策略并生成计划</p></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const plans = ref([])

async function loadData() {
  const res = await fetch('/api/plans')
  const json = await res.json()
  plans.value = json.data || []
}
function triggerLabel(t) { return { price_above:'≥', price_below:'≤', time:'时间' }[t] || t }
function statusLabel(s) { return { pending:'等待', triggered:'⚡触发中', executed:'已执行', cancelled:'取消' }[s] || s }
function statusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }
onMounted(loadData)
</script>
