<template>
  <PullRefreshView :onRefresh="refresh">
  <div>
    <div class="page-header">
      <h1 class="page-title page-title-inline"><span v-if="asset.icon">{{ asset.icon }}</span><AppIcon v-else name="market" size="20" /> {{ asset.name || t('marketDetail.title') }}</h1>
      <div class="page-header-right desktop-only">
        <div class="page-header-actions">
          <router-link to="/market" class="btn">{{ t('marketDetail.back') }}</router-link>
          <button class="btn btn-primary" @click="refresh(true)" :disabled="loading">{{ loading ? t('marketView.refreshing') : t('marketView.refresh') }}</button>
        </div>
      </div>
    </div>

    <div class="grid-4 market-detail-stats" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-label">{{ t('marketDetail.currentPrice') }}</div>
        <div class="stat-value stat-value-wrap">{{ snapshot.price ? money(snapshot.price, snapshot.currency) : '-' }}<span v-if="snapshot.price && snapshot.unit" class="price-unit">/ {{ snapshot.unit }}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('assets.fields.symbol') }}</div>
        <div class="stat-value stat-value-wrap">{{ asset.symbol || '-' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('assets.fields.type') }}</div>
        <div><span class="badge" :class="typeBadge(asset.type)">{{ assetTypeLabel(asset.type) }}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ t('assetDetail.dataSource') }}</div>
        <div class="stat-value stat-value-wrap">{{ snapshot.source || asset.data_source || t('assetDetail.auto') }}</div>
      </div>
    </div>

    <TrendChart
      v-model="priceTrendRange"
      :title="t('marketDetail.priceTrendTitle')"
      :subtitle="t('marketDetail.priceTrendSubtitle')"
      :points="priceTrend.points"
      :summary="priceTrend.summary"
      :loading="trendLoading"
      :empty-text="t('trend.emptyPrice')"
      :value-formatter="priceMoney"
      :percent-formatter="formatTrendPercent"
    />

    <div class="card snapshot-card">
      <div class="snapshot-card-header">
        <div class="section-title">{{ t('marketDetail.snapshotInfo') }}</div>
        <button class="btn btn-sm btn-inline-icon" type="button" :disabled="loading" @click="refresh(true)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          <span>{{ loading ? t('marketView.refreshing') : t('marketView.refresh') }}</span>
        </button>
      </div>
      <div class="info-list">
        <div class="info-row"><span class="info-label">{{ t('history.currency') }}</span><span>{{ snapshot.currency || asset.currency || '-' }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('assets.unitLabel') }}</span><span>{{ snapshot.unit || asset.unit || '-' }}</span></div>
        <div class="info-row">
          <span class="info-label">{{ t('marketDetail.cacheStatus') }}</span>
          <span class="cache-status-value" :class="{ warn: snapshot.empty_cache || snapshot.stale }">
            {{ statusText }}
            <button v-if="snapshot.empty_cache" class="inline-refresh-link" type="button" :disabled="loading" @click="refresh(true)">{{ t('marketDetail.fetchNow') }}</button>
          </span>
        </div>
        <div class="info-row"><span class="info-label">{{ t('marketDetail.updatedAt') }}</span><span>{{ snapshot.fetched_at ? formatDateTime(snapshot.fetched_at) : '-' }}</span></div>
      </div>
    </div>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { formatCurrencyAmount } from '../utils/currency.js'
import { formatDateTimeSeconds } from '../utils/formatters.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import { useSwipeBack } from '../composables/useSwipeBack.js'
import PullRefreshView from '../components/PullRefreshView.vue'
import TrendChart from '../components/TrendChart.vue'
import AppIcon from '../components/AppIcon.vue'

useSwipeBack()

const route = useRoute()
const { t } = useI18n()
const toast = useToast()
const mobilePageActions = useMobilePageActions()
const asset = ref({})
const snapshot = ref({})
const loading = ref(false)
const priceTrendRange = ref('1m')
const priceTrend = ref({ points: [], summary: null })
const trendLoading = ref(false)

const statusText = computed(() => {
  if (snapshot.value.empty_cache) return t('marketView.noCache')
  if (snapshot.value.cached) return t('marketView.cached')
  return t('marketDetail.realtime')
})

async function refresh(force = true) {
  loading.value = true
  try {
    const res = await api(`/api/market/prices/${route.params.assetId}${force ? '?force=1' : '?cache=1'}`)
    const json = await res.json()
    if (json.success && json.data) {
      asset.value = json.data
      snapshot.value = json.data
      if (force) {
        if (!json.data.cached && !json.data.empty_cache) {
          toast.success(t('marketDetail.refreshSuccess'))
        } else if (json.data.cached && !json.data.empty_cache) {
          toast.info(t('marketView.refreshFallback'))
        } else {
          toast.error(t('marketView.refreshNoData'))
        }
      }
    }
    await fetchPriceTrend()
  } catch (e) { console.error(e) }
  loading.value = false
}

async function fetchPriceTrend() {
  trendLoading.value = true
  try {
    const res = await api(`/api/market/prices/${route.params.assetId}/trend?range=${encodeURIComponent(priceTrendRange.value)}`)
    const json = await res.json()
    if (json.success && json.data) priceTrend.value = json.data
  } catch (e) { console.error(e) }
  trendLoading.value = false
}

function money(value, currency) {
  return formatCurrencyAmount(value, currency || asset.value?.currency, { maximumFractionDigits: 3 })
}
function priceMoney(value) {
  return money(value, priceTrend.value.currency || snapshot.value.currency || asset.value.currency)
}
function formatTrendPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}
function typeBadge(type) {
  return { gold: 'badge-gold', precious_metal: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
}
function assetTypeLabel(type) {
  return type ? t(`assets.types.${type}`, type) : '-'
}
function formatDateTime(value) {
  return formatDateTimeSeconds(value)
}

watch(priceTrendRange, () => {
  fetchPriceTrend().catch(() => {})
})

watchEffect(() => {
  mobilePageActions.setActions([
    {
      key: 'back-market',
      label: t('marketDetail.back'),
      to: '/market',
    },
    {
      key: 'refresh-market-detail',
      label: loading.value ? t('marketView.refreshing') : t('marketView.refresh'),
      disabled: loading.value,
      onSelect: () => refresh(true),
    },
  ])
})

onMounted(() => refresh(false))

onUnmounted(() => {
  mobilePageActions.clearActions()
})
</script>

<style scoped>
.info-list { font-size: 14px; }
.price-unit { margin-left: 6px; color: var(--text-muted); font-size: 13px; font-weight: 600; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); gap: 12px; }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }
.snapshot-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.snapshot-card-header .section-title { margin-bottom: 0; }
.snapshot-card-header .btn { flex-shrink: 0; min-height: 30px; padding: 5px 10px; }
.btn-inline-icon svg { width: 14px; height: 14px; }
.cache-status-value { display: inline-flex; align-items: center; justify-content: flex-end; gap: 10px; color: var(--text); text-align: right; }
.cache-status-value.warn { color: var(--warning); }
.inline-refresh-link { border: none; background: transparent; color: var(--blue); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; padding: 0; white-space: nowrap; }
.inline-refresh-link:disabled { opacity: .55; cursor: not-allowed; }
.market-detail-stats .stat-value-wrap { font-size: 18px; }
@media (max-width: 768px) {
  .market-detail-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .info-row { flex-wrap: wrap; }
  .snapshot-card-header { flex-direction: row; align-items: center; }
  .snapshot-card-header .btn { width: auto; }
  .cache-status-value { width: 100%; justify-content: space-between; text-align: left; }
}
</style>

