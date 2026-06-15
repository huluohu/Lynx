<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">实时行情</h1>
      <button class="btn" @click="refresh(true)" :disabled="loading">{{ loading ? '刷新中...' : '🔄 刷新' }}</button>
    </div>

    <!-- Skeleton state -->
    <div v-if="!initialized" class="grid-2">
      <div v-for="i in 3" :key="i" class="card skeleton-card">
        <div style="display:flex;justify-content:space-between">
          <div>
            <div class="skeleton skeleton-text short"></div>
            <div class="skeleton skeleton-price"></div>
            <div class="skeleton skeleton-text" style="width:50%"></div>
          </div>
          <div style="text-align:right">
            <div class="skeleton skeleton-text short" style="margin-left:auto"></div>
            <div class="skeleton skeleton-badge" style="margin-left:auto;margin-top:8px"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Data loaded -->
    <div v-else class="grid-2">
      <div v-for="p in prices" :key="p.asset_id" class="card market-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="market-asset-name">{{ p.name }}</div>
            <div class="market-price">
              <template v-if="p.price">{{ p.currency === 'USD' ? '$' : '¥' }}{{ fmt(p.price) }}</template>
              <template v-else><span style="color:var(--text-muted)">--</span></template>
            </div>
            <div v-if="p.details?.ch24" :class="p.details.ch24 >= 0 ? 'pnl positive' : 'pnl negative'" style="font-size:13px">
              {{ p.details.ch24 >= 0 ? '+' : '' }}{{ p.details.ch24.toFixed(1) }}% (24h)
            </div>
            <div v-if="p.stale" class="market-status warn">⚠️ 数据源暂不可用</div>
            <div v-else-if="p.cached && !p.stale" class="market-status">📦 缓存</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--text-muted)">{{ p.symbol }}</div>
            <span class="badge" :class="typeBadge(p.type)" style="margin-top:4px">{{ p.type }}</span>
            <div v-if="p.source" style="font-size:10px;color:var(--text-muted);margin-top:4px">{{ p.source }}</div>
          </div>
        </div>
      </div>
      <div v-if="!prices.length" class="card empty" style="grid-column:1/-1">
        <div class="empty-icon">📈</div><p>暂无资产，请先<router-link to="/assets">添加资产</router-link></p>
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
const initialized = ref(false)

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
  }
  loading.value = false
  initialized.value = true
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

<style scoped>
.market-card { transition: transform 0.15s; }
.market-card:hover { transform: translateY(-1px); }
.market-asset-name { font-size: 13px; color: var(--text-dim); }
.market-price { font-size: 32px; font-weight: 800; margin: 4px 0; }
.market-status { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
.market-status.warn { color: var(--red); opacity: 0.8; }
@media (max-width: 768px) {
  .market-price { font-size: 24px; }
}
</style>
