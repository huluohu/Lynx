<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">💰 资产管理</h1>
      <router-link to="/assets/add" class="btn btn-primary">+ 添加资产</router-link>
    </div>

    <div class="card" v-if="assets.length">
      <table>
        <thead><tr><th>图标</th><th>名称</th><th>代码</th><th>类型</th><th>持仓量</th><th>成本价</th><th>总投入</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="a in assets" :key="a.id">
            <td style="font-size:20px">{{ a.icon || '💰' }}</td>
            <td>
              <router-link :to="`/assets/${a.id}`" style="font-weight:600">{{ a.name }}</router-link>
            </td>
            <td style="color:var(--text-dim)">{{ a.symbol }}</td>
            <td><span class="badge" :class="typeBadge(a.type)">{{ a.type }}</span></td>
            <td>{{ a.quantity ? a.quantity.toFixed(4) : '-' }}</td>
            <td>¥{{ fmt(a.avg_cost) }}</td>
            <td>¥{{ fmt(a.total_invested) }}</td>
            <td>
              <router-link :to="`/assets/${a.id}`" class="btn btn-sm">详情</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">📭</div>
      <p>还没有资产，<router-link to="/assets/add">添加一个</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const assets = ref([])

async function fetch() {
  const res = await fetch('/api/assets')
  const json = await res.json()
  assets.value = json.data || []
}

function typeBadge(type) {
  return { gold: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
}
function fmt(n) {
  if (!n && n !== 0) return '-'
  return Math.round(n).toLocaleString()
}

onMounted(fetch)
</script>
