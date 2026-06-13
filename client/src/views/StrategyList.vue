<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">🎯 策略管理</h1>
      <router-link to="/strategies/create" class="btn btn-primary">+ 创建策略</router-link>
    </div>

    <div class="card" v-if="strategies.length">
      <table>
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
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">🎯</div><p>还没有策略，<router-link to="/strategies/create">创建一个</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const strategies = ref([])

async function loadData() {
  const res = await fetch('/api/strategies')
  const json = await res.json()
  strategies.value = json.data || []
}
function typeLabel(t) { return { dca:'定投', grid:'网格', value_avg:'价值平均', recovery:'扭亏' }[t] || t }
function statusLabel(s) { return { draft:'草稿', active:'活跃', paused:'暂停', closed:'关闭' }[s] || s }
function statusBadge(s) { return { draft:'badge-pending', active:'badge-buy', paused:'badge-pending', closed:'badge-sell' }[s] || '' }
onMounted(loadData)
</script>
