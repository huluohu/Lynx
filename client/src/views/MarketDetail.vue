<template>
  <PullRefreshView :onRefresh="refresh">
  <div>
    <div class="page-header">
      <h1 class="page-title page-title-inline"><span v-if="asset.icon">{{ asset.icon }}</span><AppIcon v-else name="market" size="20" /> {{ asset.name || t('marketDetail.title') }}</h1>
      <div class="page-header-right desktop-only">
        <div class="page-header-actions">
          <router-link to="/market" class="btn">{{ t('marketDetail.back') }}</router-link>
          <button class="btn btn-primary" @click="refresh" :disabled="loading">{{ loading ? t('marketView.refreshing') : t('marketView.refresh') }}</button>
        </div>
      </div>
    </div>

    <div class="grid-4 market-detail-stats" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-label">{{ t('marketDetail.currentPrice') }}</div>
        <div class="stat-value stat-value-wrap">{{ snapshot.price ? money(snapshot.price, snapshot.currency) : '-' }}</div>
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

    <div class="card">
      <div class="section-title">{{ t('marketDetail.snapshotInfo') }}</div>
      <div class="info-list">
        <div class="info-row"><span class="info-label">{{ t('history.currency') }}</span><span>{{ snapshot.currency || asset.currency || '-' }}</span></div>
        <div class="info-row"><span class="info-label">{{ t('marketDetail.cacheStatus') }}</span><span>{{ statusText }}</span></div>
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
const mobilePageActions = useMobilePageActions()
const asset = ref({})
const snapshot = ref({})
const loading = ref(false)
const priceTrendRange = ref('1m')
const priceTrend = ref({ points: [], summary: null })
const trendLoading = ref(false)

const statusText = computed(() => {
  if (snapshot.value.empty_cache) return t('marketView.noCache')
  if (snapshot.value.stale) return t('marketView.staleCache')
  if (snapshot.value.cached) return t('marketView.cached')
  return t('marketDetail.realtime')
})

async function refresh() {
  loading.value = true
  try {
    const res = await api(`/api/market/prices/${route.params.assetId}?cache=1`)
    const json = await res.json()
    if (json.success && json.data) {
      asset.value = json.data
      snapshot.value = json.data
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
  return { gold: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
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
      onSelect: refresh,
    },
  ])
})

onMounted(refresh)

onUnmounted(() => {
  mobilePageActions.clearActions()
})
</script>

<style scoped>
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); gap: 12px; }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }
.market-detail-stats .stat-value-wrap { font-size: 18px; }
@media (max-width: 768px) {
  .market-detail-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .info-row { flex-wrap: wrap; }
}
</style>

