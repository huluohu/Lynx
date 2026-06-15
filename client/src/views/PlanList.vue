<template>
  <div>
    <div class="page-header"><h1 class="page-title">操盘计划</h1></div>

    <!-- Filters -->
    <div class="filter-bar">
      <select class="form-select filter-select" v-model="filterAsset" @change="loadData">
        <option value="">全部资产</option>
        <option v-for="a in assets" :key="a.id" :value="a.id">{{ a.icon }} {{ a.name }}</option>
      </select>
      <select class="form-select filter-select" v-model="filterStrategy" @change="loadData">
        <option value="">全部策略</option>
        <option v-for="s in strategies" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <select class="form-select filter-select" v-model="filterStatus" @change="loadData">
        <option value="">全部状态</option>
        <option value="pending">等待</option>
        <option value="triggered">触发中</option>
        <option value="executed">已执行</option>
        <option value="cancelled">已取消</option>
      </select>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="card">
      <div v-for="i in 4" :key="i" style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="skeleton" style="width:32px;height:16px;border-radius:4px"></div>
        <div class="skeleton skeleton-text" style="width:80px"></div>
        <div class="skeleton skeleton-text" style="width:60px"></div>
        <div class="skeleton skeleton-text" style="width:50px;margin-left:auto"></div>
      </div>
    </div>

    <div class="card" v-else-if="filteredPlans.length">
      <table class="hide-mobile">
        <thead><tr><th>#</th><th>资产</th><th>策略</th><th>触发</th><th>操作</th><th>数量</th><th>金额</th><th>补后均价</th><th>状态</th></tr></thead>
        <tbody>
          <tr v-for="p in filteredPlans" :key="p.id">
            <td>{{ p.seq }}</td>
            <td><span class="icon-text">{{ p.asset_name }}</span> <span style="font-size:11px;color:var(--text-muted)">{{ p.symbol }}</span></td>
            <td style="font-size:12px;color:var(--text-dim)">{{ strategyName(p.strategy_id) }}</td>
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
        <div v-for="p in filteredPlans" :key="p.id" class="plan-card">
          <div class="plan-card-header">
            <span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'">{{ p.action==='buy'?'买入':'卖出' }}</span>
            <span style="font-weight:600">{{ p.asset_name }}</span>
            <span class="badge" :class="statusBadge(p.status)" style="margin-left:auto">{{ statusLabel(p.status) }}</span>
          </div>
          <div class="plan-card-body">
            <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">{{ strategyName(p.strategy_id) }}</div>
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
import { ref, computed, onMounted } from 'vue'
import { api } from '../utils/api.js'

const plans = ref([])
const assets = ref([])
const strategies = ref([])
const loading = ref(true)
const filterAsset = ref('')
const filterStrategy = ref('')
const filterStatus = ref('')

const filteredPlans = computed(() => {
  let result = plans.value
  if (filterStatus.value) {
    result = result.filter(p => p.status === filterStatus.value)
  }
  return result
})

async function loadData() {
  loading.value = true
  const params = new URLSearchParams()
  if (filterAsset.value) params.set('asset_id', filterAsset.value)
  if (filterStrategy.value) params.set('strategy_id', filterStrategy.value)
  const res = await api(`/api/plans?${params.toString()}`)
  const json = await res.json()
  plans.value = json.data || []
  loading.value = false
}

function strategyName(id) {
  const s = strategies.value.find(s => s.id === id)
  return s ? s.name : `策略#${id}`
}

function triggerLabel(t) { return { price_above:'≥', price_below:'≤', time:'时间' }[t] || t }
function statusLabel(s) { return { pending:'等待', triggered:'⚡触发中', executed:'已执行', cancelled:'取消' }[s] || s }
function statusBadge(s) { return { pending:'badge-pending', triggered:'badge-triggered', executed:'badge-executed', cancelled:'badge-sell' }[s] || '' }

onMounted(async () => {
  const [aRes, sRes] = await Promise.all([
    api('/api/assets'),
    api('/api/strategies'),
  ])
  const aJson = await aRes.json()
  const sJson = await sRes.json()
  assets.value = aJson.data || []
  strategies.value = sJson.data || []
  await loadData()
})
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.filter-select {
  min-width: 140px;
  max-width: 200px;
}
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
  .filter-select { min-width: 0; flex: 1; }
}
</style>
