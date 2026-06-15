<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">策略管理</h1>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" @click="showAI = true">🤖 AI 生成</button>
        <router-link to="/strategies/create" class="btn btn-primary">+ 创建策略</router-link>
      </div>
    </div>

    <div class="card" v-if="strategies.length">
      <table class="hide-mobile">
        <thead><tr><th>名称</th><th>关联资产</th><th>类型</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="s in strategies" :key="s.id">
            <td style="font-weight:600">{{ s.name }}</td>
            <td>{{ assetDisplay(s) }}</td>
            <td><span class="badge badge-buy">{{ typeLabel(s.type) }}</span></td>
            <td><span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span></td>
            <td style="color:var(--text-muted)">{{ s.created_at?.slice(0,10) }}</td>
            <td>
              <router-link :to="`/strategies/${s.id}`" class="btn btn-sm">详情</router-link>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile strategy-cards">
        <div v-for="s in strategies" :key="s.id" class="strategy-card" @click="openDetail(s)">
          <div class="strategy-card-header">
            <span style="font-weight:600">{{ s.name }}</span>
            <span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span>
          </div>
          <div class="strategy-card-body">
            <span>{{ assetDisplay(s) }}</span>
            <span class="badge badge-buy">{{ typeLabel(s.type) }}</span>
            <span style="color:var(--text-muted);font-size:12px">{{ s.created_at?.slice(0,10) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">🎯</div><p>还没有策略，<router-link to="/strategies/create">创建一个</router-link> 或使用 <a href="#" @click.prevent="showAI = true">🤖 AI 生成</a></p>
    </div>

    <!-- AI Drawer -->
    <AppDrawer v-model="showAI" title="🤖 AI 生成策略">
      <AIStrategyGenerator @done="onAIDone" />
    </AppDrawer>

    <!-- Mobile Detail Drawer -->
    <AppDrawer v-model="showDetailDrawer" :title="detailStrategy?.name || ''">
      <div v-if="detailStrategy" class="detail-drawer-content">
        <div class="detail-section">
          <div class="detail-row"><span>类型</span><span class="badge badge-buy">{{ typeLabel(detailStrategy.type) }}</span></div>
          <div class="detail-row"><span>关联资产</span><span>{{ assetDisplay(detailStrategy) }}</span></div>
          <div class="detail-row"><span>状态</span><span class="badge" :class="statusBadge(detailStrategy.status)">{{ statusLabel(detailStrategy.status) }}</span></div>
          <div class="detail-row"><span>创建时间</span><span style="color:var(--text-dim)">{{ detailStrategy.created_at?.slice(0,10) }}</span></div>
        </div>

        <div v-if="detailPlans.length" class="detail-section">
          <div class="detail-section-title">操盘计划 ({{ detailPlans.length }} 步)</div>
          <div v-for="p in detailPlans" :key="p.id" class="plan-mini">
            <span class="badge" :class="p.action==='buy'?'badge-buy':'badge-sell'" style="font-size:11px">{{ p.action==='buy'?'买':'卖' }}</span>
            <span>{{ triggerLabel(p.trigger_type) }} {{ p.trigger_value }}</span>
            <span v-if="p.amount" style="color:var(--text-dim)">¥{{ Math.round(p.amount) }}</span>
          </div>
        </div>

        <div class="detail-actions">
          <router-link :to="`/strategies/${detailStrategy.id}`" class="btn btn-primary" style="flex:1;text-align:center" @click="showDetailDrawer = false">查看完整详情</router-link>
          <router-link :to="`/strategies/${detailStrategy.id}/edit`" class="btn" style="flex:1;text-align:center" @click="showDetailDrawer = false">✏️ 编辑</router-link>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api.js'
import AppDrawer from '../components/AppDrawer.vue'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'

const strategies = ref([])
const showAI = ref(false)
const showDetailDrawer = ref(false)
const detailStrategy = ref(null)
const detailPlans = ref([])

async function loadData() {
  const res = await api('/api/strategies')
  const json = await res.json()
  strategies.value = json.data || []
}

async function openDetail(s) {
  detailStrategy.value = s
  detailPlans.value = []
  showDetailDrawer.value = true
  // Load plans
  try {
    const res = await api(`/api/plans?strategy_id=${s.id}`)
    const json = await res.json()
    detailPlans.value = (json.data || []).slice(0, 5)
  } catch {}
}

function onAIDone() { showAI.value = false; loadData() }
function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏', trend:'趋势', rebalance:'再平衡' }[t] || t }
function statusLabel(s) { return { draft:'草稿', active:'活跃', paused:'暂停', closed:'关闭' }[s] || s }
function statusBadge(s) { return { draft:'badge-pending', active:'badge-buy', paused:'badge-pending', closed:'badge-sell' }[s] || '' }
function triggerLabel(t) { return { price_above:'≥', price_below:'≤', time:'时间' }[t] || t }
function assetDisplay(s) {
  if (s.assets && s.assets.length > 1) {
    return s.assets.map(a => a.name).join('、')
  }
  return s.asset_name || '-'
}
onMounted(loadData)
</script>

<style scoped>
.hide-mobile { display: table; }
.show-mobile { display: none !important; }
.strategy-cards { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.strategy-card { display: block; border: 1px solid var(--border); border-radius: 8px; padding: 12px; cursor: pointer; color: var(--text); transition: background 0.15s; }
.strategy-card:active { background: var(--bg-hover); }
.strategy-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.strategy-card-body { display: flex; align-items: center; gap: 10px; font-size: 13px; }

.detail-drawer-content { display: flex; flex-direction: column; gap: 16px; }
.detail-section { background: var(--bg); border-radius: 10px; padding: 4px 0; }
.detail-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); padding: 8px 14px 4px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 14px; }
.plan-mini { display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; }
.detail-actions { display: flex; gap: 10px; margin-top: 8px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
