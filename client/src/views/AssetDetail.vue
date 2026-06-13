<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ asset.icon }} {{ asset.name }}</h1>
      <router-link to="/assets" class="btn">← 返回</router-link>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="section-title">📋 基本信息</div>
        <div style="font-size:14px">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">代码</span><span style="color:var(--text-dim)">{{ asset.symbol }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">类型</span><span class="badge" :class="typeBadge(asset.type)">{{ asset.type }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">计价货币</span><span>{{ asset.currency }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0">
            <span class="form-label" style="margin:0">数据源</span><span style="color:var(--text-dim)">{{ asset.data_source || '自动' }}</span>
          </div>
        </div>
      </div>

      <div class="card" v-if="holding">
        <div class="section-title">📦 持仓信息</div>
        <div style="font-size:14px">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">持仓数量</span><span style="font-weight:600">{{ holding.quantity }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">成本价</span><span>¥{{ fmt(holding.avg_cost) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">总投入</span><span>¥{{ fmt(holding.total_invested) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <span class="form-label" style="margin:0">目标价</span><span>{{ holding.target_price ? '¥'+holding.target_price : '-' }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0">
            <span class="form-label" style="margin:0">止损线</span><span style="color:var(--red)">{{ holding.stop_loss ? '¥'+holding.stop_loss : '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 交易记录 -->
    <div class="card">
      <div class="section-title">📝 交易记录</div>
      <table v-if="transactions.length">
        <thead><tr><th>时间</th><th>类型</th><th>数量</th><th>价格</th><th>金额</th><th>手续费</th></tr></thead>
        <tbody>
          <tr v-for="t in transactions" :key="t.id">
            <td>{{ t.executed_at?.slice(0,10) }}</td>
            <td><span class="badge" :class="t.type==='buy'?'badge-buy':'badge-sell'">{{ t.type==='buy'?'买入':'卖出' }}</span></td>
            <td>{{ t.quantity }}</td>
            <td>¥{{ t.price }}</td>
            <td :class="t.type==='buy'?'pnl negative':'pnl positive'">¥{{ fmt(t.total) }}</td>
            <td>¥{{ fmt(t.fee) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty" style="padding:24px"><p>暂无交易记录</p></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../utils/api.js'

const route = useRoute()
const asset = ref({})
const holding = ref(null)
const transactions = ref([])

async function loadData() {
  const res = await api(`/api/assets/${route.params.id}`)
  const json = await res.json()
  if (json.data) {
    asset.value = json.data
    holding.value = json.data.quantity ? json.data : null
  }
  // transactions
  const tres = await api(`/api/transactions?asset_id=${route.params.id}`)
  const tjson = await tres.json()
  transactions.value = tjson.data || []
}

function typeBadge(type) {
  return { gold: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
}
function fmt(n) {
  if (!n && n !== 0) return '0'
  return Number(n).toLocaleString()
}

onMounted(loadData)
</script>
