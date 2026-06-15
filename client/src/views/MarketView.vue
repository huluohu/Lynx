<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">实时行情</h1>
      <button class="btn" @click="refresh(true)" :disabled="loading">{{ loading ? '加载中...' : '🔄 刷新' }}</button>
    </div>

    <div class="grid-2">
      <div v-for="p in prices" :key="p.asset_id" class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:13px;color:var(--text-dim)">{{ p.name }}</div>
            <div style="font-size:32px;font-weight:800;margin:4px 0">
              {{ p.price ? (p.currency === 'USD' ? '$' : '¥') + fmt(p.price) : '暂无数据' }}
            </div>
            <div v-if="p.details?.ch24" :class="p.details.ch24 >= 0 ? 'pnl positive' : 'pnl negative'" style="font-size:13px">
              {{ p.details.ch24 >= 0 ? '+' : '' }}{{ p.details.ch24.toFixed(1) }}% (24h)
            </div>
            <div v-if="p.stale" style="font-size:11px;color:var(--text-muted);margin-top:4px">⚠️ 数据源暂不可用，显示历史缓存</div>
            <div v-else-if="p.cached && !p.stale" style="font-size:11px;color:var(--text-muted);margin-top:4px">📦 缓存 (5分钟内)</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--text-muted)">{{ p.symbol }}</div>
            <span class="badge" :class="typeBadge(p.type)" style="margin-top:4px">{{ p.type }}</span>
            <div v-if="p.source" style="font-size:10px;color:var(--text-muted);margin-top:4px">via {{ p.source }}</div>
          </div>
        </div>
      </div>
      <div v-if="!prices.length && !loading" class="card empty" style="grid-column:1/-1">
        <div class="empty-icon">📈</div><p>暂无资产，请先添加资产</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const toast = useToast()
const prices = ref([])
const loading = ref(false)

async function refresh(force = false) {
  loading.value = true
  try {
    const url = force ? '/api/market/prices?force=1' : '/api/market/prices'
    const res = await api(url)
    const json = await res.json()
    prices.value = json.data || []
    if (force) {
      const fresh = prices.value.filter(p => !p.cached && !p.stale).length
      toast.success(`已刷新 ${fresh} 个资产行情`)
    }
  } catch (e) {
    toast.error('获取行情失败')
    console.error(e)
  }
  loading.value = false
}
function fmt(n) {
  if (!n && n !== 0) return '-'
  return Number(n).toLocaleString()
}
function typeBadge(t) {
  return { gold:'badge-gold', crypto:'badge-crypto', stock:'badge-stock' }[t] || 'badge-pending'
}
onMounted(() => refresh(false))
</script>
