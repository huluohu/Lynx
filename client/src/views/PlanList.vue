<template>
  <div>
    <div class="page-header"><h1 class="page-title">操盘计划</h1></div>

    <div class="card" v-if="plans.length">
      <table class="hide-mobile">
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

      <!-- Mobile cards -->
      <div class="show-mobile plan-cards">
        <div v-for="p in plans" :key="p.id" class="plan-card">
          <div class="plan-card-header">
            <span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'">{{ p.action==='buy'?'买入':'卖出' }}</span>
            <span style="font-weight:600">{{ p.asset_name }}</span>
            <span class="badge" :class="statusBadge(p.status)" style="margin-left:auto">{{ statusLabel(p.status) }}</span>
          </div>
          <div class="plan-card-body">
            <div class="plan-card-trigger">{{ triggerLabel(p.trigger_type) }} <b>{{ p.trigger_value }}</b></div>
            <div class="plan-card-meta">
              <span v-if="p.quantity">数量: {{ p.quantity.toFixed(4) }}</span>
              <span v-if="p.amount">金额: ¥{{ Math.round(p.amount) }}</span>
              <span v-if="p.new_avg_cost">均价→¥{{ p.new_avg_cost }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="card empty"><div class="empty-icon">📋</div><p>暂无操盘计划，去创建一个策略并生成计划</p></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api.js'

const plans = ref([])

async function loadData() {
  const res = await api('/api/plans')
  const json = await res.json()
  plans.value = json.data || []
}
function triggerLabel(t) { return { price_above:'≥', price_below:'≤', time:'时间' }[t] || t }
function statusLabel(s) { return { pending:'等待', triggered:'⚡触发中', executed:'已执行', cancelled:'取消' }[s] || s }
function statusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }
onMounted(loadData)
</script>

<style scoped>
.hide-mobile { display: table; }
.show-mobile { display: none !important; }
.plan-cards { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.plan-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.plan-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.plan-card-body { font-size: 13px; }
.plan-card-trigger { margin-bottom: 4px; }
.plan-card-meta { display: flex; gap: 12px; color: var(--text-dim); font-size: 12px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
