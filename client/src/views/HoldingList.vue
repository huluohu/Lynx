<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">📦 持仓管理</h1>
    </div>

    <div class="card" v-if="holdings.length">
      <table>
        <thead><tr><th>资产</th><th>数量</th><th>成本价</th><th>总投入</th><th>目标价</th><th>止损</th><th>状态</th></tr></thead>
        <tbody>
          <tr v-for="h in holdings" :key="h.id">
            <td>{{ h.icon }} {{ h.name }} <span style="color:var(--text-dim);font-size:12px">{{ h.symbol }}</span></td>
            <td style="font-weight:600">{{ h.quantity }}</td>
            <td>¥{{ fmt(h.avg_cost) }}</td>
            <td>¥{{ fmt(h.total_invested) }}</td>
            <td>{{ h.target_price ? '¥'+h.target_price : '-' }}</td>
            <td style="color:var(--red)">{{ h.stop_loss ? '¥'+h.stop_loss : '-' }}</td>
            <td><span class="badge" :class="h.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ h.status === 'active' ? '持仓中' : '已清仓' }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">📦</div><p>暂无持仓</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const holdings = ref([])

async function loadData() {
  const res = await fetch('/api/holdings')
  const json = await res.json()
  holdings.value = json.data || []
}
function fmt(n) {
  if (!n && n !== 0) return '0'
  return Math.round(n).toLocaleString()
}
onMounted(loadData)
</script>
