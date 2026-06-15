<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">实时行情</h1>
      <button class="btn" @click="refresh" :disabled="loading">{{ loading ? '加载中...' : '🔄 刷新' }}</button>
    </div>

    <div class="grid-2">
      <div v-for="p in prices" :key="p.asset_id" class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:13px;color:var(--text-dim)">{{ p.name }}</div>
            <div style="font-size:32px;font-weight:800;margin:4px 0">
              {{ p.price ? (p.currency === 'USD' ? '$' : '¥') + fmt(p.price) : '加载中...' }}
            </div>
            <div v-if="p.details?.ch24" :class="p.details.ch24 >= 0 ? 'pnl positive' : 'pnl negative'" style="font-size:13px">
              {{ p.details.ch24 >= 0 ? '+' : '' }}{{ p.details.ch24.toFixed(1) }}% (24h)
            </div>
            <div v-if="p.cached" style="font-size:11px;color:var(--text-muted);margin-top:4px">📦 缓存数据（休市）</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--text-muted)">{{ p.symbol }}</div>
            <span class="badge" :class="typeBadge(p.type)" style="margin-top:4px">{{ p.type }}</span>
          </div>
        </div>
      </div>
      <div v-if="!prices.length" class="card empty" style="grid-column:1/-1">
        <div class="empty-icon">📈</div><p>暂无资产</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api.js'

const prices = ref([])
const loading = ref(false)

async function refresh() {
  loading.value = true
  try {
    const res = await api('/api/market/prices')
    const json = await res.json()
    prices.value = json.data || []
  } catch (e) { console.error(e) }
  loading.value = false
}
function fmt(n) {
  if (!n && n !== 0) return '-'
  return Number(n).toLocaleString()
}
function typeBadge(t) {
  return { gold:'badge-gold', crypto:'badge-crypto', stock:'badge-stock' }[t] || 'badge-pending'
}
onMounted(refresh)
</script>
