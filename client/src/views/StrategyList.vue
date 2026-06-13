<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">🎯 策略管理</h1>
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
            <td>{{ s.asset_name || '-' }} <span style="font-size:11px;color:var(--text-muted)">{{ s.symbol }}</span></td>
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
        <router-link v-for="s in strategies" :key="s.id" :to="`/strategies/${s.id}`" class="strategy-card">
          <div class="strategy-card-header">
            <span style="font-weight:600">{{ s.name }}</span>
            <span class="badge" :class="statusBadge(s.status)">{{ statusLabel(s.status) }}</span>
          </div>
          <div class="strategy-card-body">
            <span>{{ s.asset_name || '-' }}</span>
            <span class="badge badge-buy">{{ typeLabel(s.type) }}</span>
            <span style="color:var(--text-muted);font-size:12px">{{ s.created_at?.slice(0,10) }}</span>
          </div>
        </router-link>
      </div>
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">🎯</div><p>还没有策略，<router-link to="/strategies/create">创建一个</router-link> 或使用 <a href="#" @click.prevent="showAI = true">🤖 AI 生成</a></p>
    </div>

    <AppDrawer v-model="showAI" title="🤖 AI 生成策略">
      <AIStrategyGenerator @done="onAIDone" />
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

async function loadData() {
  const res = await api('/api/strategies')
  const json = await res.json()
  strategies.value = json.data || []
}
function onAIDone() { showAI.value = false; loadData() }
function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏' }[t] || t }
function statusLabel(s) { return { draft:'草稿', active:'活跃', paused:'暂停', closed:'关闭' }[s] || s }
function statusBadge(s) { return { draft:'badge-pending', active:'badge-buy', paused:'badge-pending', closed:'badge-sell' }[s] || '' }
onMounted(loadData)
</script>

<style scoped>
.hide-mobile { display: table; }
.show-mobile { display: none !important; }
.strategy-cards { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.strategy-card { display: block; border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-decoration: none; color: var(--text); transition: background 0.15s; }
.strategy-card:hover { background: var(--bg-hover); }
.strategy-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.strategy-card-body { display: flex; align-items: center; gap: 10px; font-size: 13px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
