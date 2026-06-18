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
    <div v-else class="grid-2 market-grid">
      <SwipeActionItem v-for="p in prices" :key="p.asset_id" class="market-swipe-item" :actionWidth="88">
        <div class="card market-card" role="button" tabindex="0" @click="openMarketDetail(p)" @keyup.enter="openMarketDetail(p)">
          <div class="market-card-main">
            <div>
              <div class="market-asset-name">{{ p.name }}</div>
              <div class="market-price">
                <template v-if="p.price">{{ money(p.price, p.currency) }}</template>
                <template v-else><span style="color:var(--text-muted)">--</span></template>
                <span v-if="p.price && p.unit" class="market-price-unit">/ {{ p.unit }}</span>
              </div>
              <div v-if="p.details?.ch24" :class="p.details.ch24 >= 0 ? 'pnl positive' : 'pnl negative'" style="font-size:13px">
                {{ p.details.ch24 >= 0 ? '+' : '' }}{{ p.details.ch24.toFixed(1) }}% (24h)
              </div>
              <div v-if="p.empty_cache" class="market-status warn">{{ t('marketView.noCache') }}</div>
              <div v-else-if="p.stale" class="market-status warn">{{ t('marketView.staleCache') }}</div>
              <div v-else-if="p.cached && !p.stale" class="market-status">{{ t('marketView.cached') }}</div>
              <div v-if="p.fetched_at" class="market-updated-at">{{ t('marketView.quoteUpdatedAt', { time: fmtDateTime(p.fetched_at) }) }}</div>
            </div>
            <div class="market-card-side">
              <div style="font-size:12px;color:var(--text-muted)">{{ p.symbol }}</div>
              <span class="badge" :class="typeBadge(p.type)" style="margin-top:4px">{{ p.type }}</span>
              <div v-if="p.source" style="font-size:10px;color:var(--text-muted);margin-top:4px">{{ p.source }}</div>
              <button class="btn market-card-action desktop-only" type="button" @click.stop="openManualPriceDrawer(p)">
                {{ t('marketView.manualUpdateShort') }}
              </button>
            </div>
          </div>
        </div>
        <template #actions>
          <button class="market-swipe-action" type="button" @click="openManualPriceDrawer(p)">
            {{ t('marketView.manualUpdateShort') }}
          </button>
        </template>
      </SwipeActionItem>
      <div v-if="!prices.length" class="card empty" style="grid-column:1/-1">
        <div class="empty-icon"><AppIcon name="market" size="34" /></div><p>{{ t('marketView.empty') }}</p>
      </div>
    </div>

    <AppDrawer v-model="manualDrawerOpen" :title="t('marketView.manualUpdate')" mobileHeight="fixed">
      <form id="market-manual-price-form" @submit.prevent="saveManualPrice" class="manual-price-form">
        <div class="form-group">
          <label class="form-label">{{ t('marketView.manualAsset') }}</label>
          <div class="manual-asset-summary">
            <span class="manual-asset-name">{{ selectedManualAsset?.name || '-' }}</span>
            <span class="manual-asset-symbol">{{ selectedManualAsset?.symbol || '-' }}</span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('marketView.manualPrice') }}</label>
            <input class="form-input" type="number" step="any" min="0" v-model="manualForm.price" required />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('history.currency') }}</label>
            <select class="form-select" v-model="manualForm.currency" required>
              <option v-for="currency in manualCurrencies" :key="currency" :value="currency">{{ currency }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('marketView.manualTime') }}</label>
          <input class="form-input" type="datetime-local" v-model="manualForm.fetched_at" />
          <div class="form-help">{{ t('marketView.manualTimeHint') }}</div>
        </div>
        <div v-if="selectedManualAsset" class="manual-price-preview">
          <span>{{ t('marketView.currentSnapshot') }}</span>
          <strong>{{ selectedManualAsset.price ? money(selectedManualAsset.price, selectedManualAsset.currency) : t('holdings.unavailable') }}</strong>
        </div>
      </form>
      <template #footer>
        <div class="drawer-footer-actions">
          <button class="btn" type="button" @click="manualDrawerOpen = false">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" type="submit" form="market-manual-price-form" :disabled="manualSaving">
            {{ manualSaving ? t('marketView.manualSaving') : t('marketView.manualSave') }}
          </button>
        </div>
      </template>
    </AppDrawer>
  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useRuntimeSettingsStore } from '../stores/runtime-settings.js'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { formatCurrencyAmount } from '../utils/currency.js'
import { formatDateTimeSeconds, formatTime, parseDateTime } from '../utils/formatters.js'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import AppDrawer from '../components/AppDrawer.vue'
import PullRefreshView from '../components/PullRefreshView.vue'
import SwipeActionItem from '../components/SwipeActionItem.vue'
import AppIcon from '../components/AppIcon.vue'

const toast = useToast()
const { t } = useI18n()
const router = useRouter()
const runtimeSettingsStore = useRuntimeSettingsStore()
const prices = ref([])
const loading = ref(false)
const initialized = ref(false)
const lastUpdated = ref(null)
const manualDrawerOpen = ref(false)
const manualSaving = ref(false)
const manualCurrencies = ['CNY', 'USD', 'USDT', 'EUR', 'GBP', 'JPY']
const manualForm = reactive({ asset_id: '', price: '', currency: 'CNY', fetched_at: '' })
const mobilePageActions = useMobilePageActions()
let refreshTimer = null

const selectedManualAsset = computed(() => prices.value.find((item) => String(item.asset_id) === String(manualForm.asset_id)) || null)

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
function money(value, currency) {
  return formatCurrencyAmount(value, currency, { maximumFractionDigits: 2 })
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
  return { gold:'badge-gold', precious_metal: 'badge-gold', crypto:'badge-crypto', stock:'badge-stock' }[t] || 'badge-pending'
}
function fmtTime(d) {
  return formatTime(d, { second: '2-digit' })
}
function fmtDateTime(value) {
  return formatDateTimeSeconds(value)
}

function nowDatetimeLocal() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function datetimeLocalToIso(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function openManualPriceDrawer(asset = null) {
  const target = asset || selectedManualAsset.value
  if (!target) return
  manualForm.asset_id = target.asset_id
  manualForm.price = target.price ?? ''
  manualForm.currency = target.currency || 'CNY'
  manualForm.fetched_at = nowDatetimeLocal()
  manualDrawerOpen.value = true
}

function openMarketDetail(asset) {
  if (!asset?.asset_id) return
  router.push(`/market/${asset.asset_id}`)
}

async function saveManualPrice() {
  if (!manualForm.asset_id || !manualForm.price) return
  manualSaving.value = true
  try {
    const res = await api(`/api/market/prices/${manualForm.asset_id}/manual`, {
      method: 'POST',
      body: JSON.stringify({
        price: Number(manualForm.price),
        currency: manualForm.currency,
        fetched_at: datetimeLocalToIso(manualForm.fetched_at),
      }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error || t('common.saveFailed'))
      return
    }
    toast.success(t('marketView.manualSaved'))
    manualDrawerOpen.value = false
    await refresh(false)
  } catch (e) {
    toast.error(e.message || t('common.saveFailed'))
  } finally {
    manualSaving.value = false
  }
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
.market-swipe-item { border-radius: 12px; height: 100%; }
.market-swipe-item :deep(.swipe-action-content) { height: 100%; }
.market-card { height: 100%; margin-bottom: 0; transition: transform 0.15s; cursor: pointer; }
.market-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.market-card:hover { transform: translateY(-1px); }
.market-card-main { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.market-card-side { text-align: right; }
.market-card-action { margin-top: 10px; padding: 6px 10px; font-size: 12px; }
.market-asset-name { font-size: 13px; color: var(--text-dim); }
.market-price { font-size: 32px; font-weight: 800; margin: 4px 0; }
.market-price-unit { margin-left: 6px; color: var(--text-muted); font-size: 13px; font-weight: 600; }
.market-status { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
.market-status.warn { color: var(--red); opacity: 0.8; }
.market-updated-at { margin-top: 4px; color: var(--text-muted); font-size: 11px; line-height: 1.4; }
.manual-price-form { display: flex; flex-direction: column; gap: 14px; }
.manual-asset-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-dim);
}
.manual-asset-name { font-weight: 700; }
.manual-asset-symbol { color: var(--text-dim); font-size: 12px; }
.manual-price-preview {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text-dim);
  background: var(--bg-dim);
}
.manual-price-preview strong { color: var(--text); }
.drawer-footer-actions { display: flex; gap: 12px; }
.drawer-footer-actions .btn { flex: 1; }
.market-swipe-action {
  width: 100%;
  border: none;
  border-left: 1px solid var(--swipe-action-divider);
  background: var(--swipe-action-primary-bg);
  color: var(--swipe-action-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
}
@media (min-width: 769px) {
  .market-swipe-item :deep(.swipe-action-content) { transform: none !important; }
  .market-swipe-item :deep(.swipe-action-actions) { display: none; }
}
@media (max-width: 768px) {
  .market-price { font-size: 24px; }
  .market-swipe-item { display: block; }
  .market-card { border-radius: 12px; }
}
</style>
