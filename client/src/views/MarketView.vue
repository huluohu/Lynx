<template>
  <PullRefreshView :onRefresh="() => refresh(true)">
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('marketView.title') }}</h1>
      <div class="page-header-right">
        <div class="page-header-meta">
          <span v-if="lastUpdated" class="page-header-meta-item">{{ t('marketView.updatedAt', { time: fmtTime(lastUpdated) }) }}</span>
        </div>
        <div class="desktop-only">
          <div class="page-header-actions">
            <button class="btn btn-inline-icon" @click="refresh(true)" :disabled="loading">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              <span>{{ loading ? t('marketView.refreshing') : t('marketView.refresh') }}</span>
            </button>
          </div>
        </div>
      </div>
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
            <div v-if="p.empty_cache" class="market-status warn">{{ t('marketView.noCache') }}</div>
            <div v-else-if="p.stale" class="market-status warn">{{ t('marketView.staleCache') }}</div>
            <div v-else-if="p.cached && !p.stale" class="market-status">{{ t('marketView.cached') }}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--text-muted)">{{ p.symbol }}</div>
            <span class="badge" :class="typeBadge(p.type)" style="margin-top:4px">{{ p.type }}</span>
            <div v-if="p.source" style="font-size:10px;color:var(--text-muted);margin-top:4px">{{ p.source }}</div>
          </div>
        </div>
      </div>
      <div v-if="!prices.length" class="card empty" style="grid-column:1/-1">
        <div class="empty-icon">📈</div><p>{{ t('marketView.empty') }}</p>
      </div>
    </div>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRuntimeSettingsStore } from '../stores/runtime-settings.js'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { formatNumber, formatTime, parseDateTime } from '../utils/formatters.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import PullRefreshView from '../components/PullRefreshView.vue'

const toast = useToast()
const { t } = useI18n()
const runtimeSettingsStore = useRuntimeSettingsStore()
const prices = ref([])
const loading = ref(false)
const initialized = ref(false)
const lastUpdated = ref(null)
const mobilePageActions = useMobilePageActions()
let refreshTimer = null

async function refresh(force = false) {
  loading.value = true
  try {
    const url = force ? '/api/market/prices?force=1' : '/api/market/prices'
    const res = await api(url)
    const json = await res.json()
    prices.value = json.data || []
    lastUpdated.value = resolveLastUpdated(prices.value)
    if (force) {
      const fresh = prices.value.filter(p => !p.cached && !p.stale).length
      toast.success(t('marketView.refreshed', { count: fresh }))
    }
  } catch (e) {
    toast.error(t('marketView.refreshFailed'))
  }
  loading.value = false
  initialized.value = true
}
function fmt(n) {
  return formatNumber(n, { maximumFractionDigits: 2 })
}
function resolveLastUpdated(items) {
  const dates = items
    .map((item) => item.fetched_at)
    .filter(Boolean)
    .map((value) => parseDateTime(value))
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())
  return dates[0] || null
}
function typeBadge(t) {
  return { gold:'badge-gold', crypto:'badge-crypto', stock:'badge-stock' }[t] || 'badge-pending'
}
function fmtTime(d) {
  return formatTime(d, { second: '2-digit' })
}

async function ensureRuntimeSettings() {
  if (Object.keys(runtimeSettingsStore.values || {}).length > 0) return
  try {
    await runtimeSettingsStore.syncFromServer()
  } catch {}
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  const minutes = Math.max(0, runtimeSettingsStore.getNumber('market_refresh_interval', 5))
  if (minutes > 0) {
    refreshTimer = setInterval(() => {
      refresh(true).catch(() => {})
    }, minutes * 60 * 1000)
  }
}

watch(() => runtimeSettingsStore.values.market_refresh_interval, (nextValue, prevValue) => {
  if (!initialized.value || nextValue === prevValue) return
  startAutoRefresh()
})

watchEffect(() => {
  mobilePageActions.setActions([
    {
      key: 'refresh-market',
      label: loading.value ? t('marketView.refreshing') : t('marketView.refresh'),
      disabled: loading.value,
      onSelect: () => refresh(true),
    },
  ])
})

onMounted(async () => {
  await ensureRuntimeSettings()
  await refresh(false)
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
  mobilePageActions.clearActions()
})
</script>

<style scoped>
.btn-inline-icon { display: inline-flex; align-items: center; gap: 6px; }
.btn-inline-icon svg { width: 14px; height: 14px; flex-shrink: 0; }
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
