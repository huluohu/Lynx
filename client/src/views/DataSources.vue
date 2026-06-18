<template>
  <div class="data-sources-page">
    <section class="source-hero">
      <div>
        <div class="hero-kicker">{{ t('dataSources.consoleKicker') }}</div>
        <p class="hero-subtitle">{{ t('dataSources.productSubtitle') }}</p>
      </div>
      <div class="hero-actions desktop-actions">
        <button class="btn" type="button" :disabled="loading" @click="load">{{ loading ? t('common.refreshing') : t('common.refresh') }}</button>
        <button class="btn btn-primary" type="button" :disabled="saving || !hasChanges" @click="saveAvailability">{{ saving ? t('dataSources.saving') : saveButtonText }}</button>
      </div>
    </section>

    <section class="scope-callout">
      <div class="scope-icon">!</div>
      <div>
        <strong>{{ t('dataSources.scopeTitle') }}</strong>
        <p>{{ t('dataSources.scopeDesc') }}</p>
      </div>
    </section>

    <div v-if="loadError" class="source-alert" role="alert">
      <div>
        <strong>{{ t('common.loadFailed') }}</strong>
        <span>{{ loadError }}</span>
      </div>
      <button class="btn btn-sm" type="button" @click="load">{{ t('common.refresh') }}</button>
    </div>

    <div class="source-mode-switch" role="tablist" :aria-label="t('dataSources.tabsLabel')">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="source-mode-card"
        :class="[tab.key, { active: activeTab === tab.key }]"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.key"
        @click="activeTab = tab.key"
      >
        <span class="mode-icon">{{ tab.icon }}</span>
        <span class="mode-copy">
          <strong>{{ tab.label }}</strong>
          <small>{{ tab.meta }}</small>
        </span>
        <span class="mode-arrow">›</span>
      </button>
    </div>

    <div v-if="loading" class="source-skeleton-grid" aria-busy="true">
      <div v-for="index in 4" :key="index" class="source-skeleton-card">
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-text long"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
    </div>

    <template v-else>
      <section v-show="activeTab === 'news'" class="management-panel news-panel" role="tabpanel">
        <div class="panel-title-block">
          <div>
            <div class="panel-kicker">{{ t('dataSources.newsKicker') }}</div>
            <h2>{{ t('dataSources.newsAvailabilityTitle') }}</h2>
            <p>{{ t('dataSources.newsAvailabilityDesc') }}</p>
          </div>
          <span class="count-pill">{{ newsAvailableSources.length }}/{{ builtinNewsSources.length }}</span>
        </div>

        <div class="panel-grid">
          <section class="manager-card primary-card">
            <div class="manager-card-header">
              <div>
                <h3>{{ t('dataSources.builtinSources') }}</h3>
                <p>{{ t('dataSources.builtinNewsManageDesc') }}</p>
              </div>
            </div>
            <div class="source-row-list">
              <button
                v-for="source in builtinNewsSources"
                :key="source.key"
                class="source-manage-row"
                :class="{ enabled: isNewsAvailable(source.key) }"
                type="button"
                @click="toggleNewsBuiltin(source.key)"
              >
                <span class="source-avatar">{{ source.logo }}</span>
                <span class="source-row-main">
                  <strong>{{ source.label }}</strong>
                  <small>{{ source.desc }}</small>
                </span>
                <span class="state-copy">{{ isNewsAvailable(source.key) ? t('dataSources.enabled') : t('dataSources.disabled') }}</span>
                <span class="source-switch" aria-hidden="true"></span>
              </button>
            </div>
          </section>

          <section class="manager-card custom-card">
            <div class="manager-card-header action-header">
              <div>
                <h3>{{ t('dataSources.customRssTitle') }}</h3>
                <p>{{ t('dataSources.customRssDesc') }}</p>
              </div>
              <button class="btn btn-sm" type="button" @click="openSourceDrawer('news')">{{ t('common.add') }}</button>
            </div>

            <div v-if="customNewsSources.length" class="source-row-list custom-list">
              <article v-for="source in customNewsSources" :key="source.id" class="source-manage-row custom-row" :class="{ enabled: isCustomNewsEnabled(source) }">
                <span class="source-avatar rss">RSS</span>
                <span class="source-row-main">
                  <strong>{{ source.name }}</strong>
                  <a :href="source.url" target="_blank" rel="noreferrer">{{ source.url }}</a>
                </span>
                <button class="state-button" type="button" @click="toggleCustomNews(source)">{{ isCustomNewsEnabled(source) ? t('dataSources.enabled') : t('dataSources.disabled') }}</button>
                <button class="icon-danger-btn" type="button" :title="t('settings.news.deleteSource')" @click="confirmDeleteCustomNewsSource(source)">×</button>
              </article>
            </div>
            <div v-else class="empty-card">
              <div class="empty-icon">📰</div>
              <p>{{ t('dataSources.noCustomRss') }}</p>
            </div>
          </section>
        </div>
      </section>

      <section v-show="activeTab === 'market'" class="management-panel market-panel" role="tabpanel">
        <div class="panel-title-block">
          <div>
            <div class="panel-kicker">{{ t('dataSources.marketKicker') }}</div>
            <h2>{{ t('dataSources.marketAvailabilityTitle') }}</h2>
            <p>{{ t('dataSources.marketAvailabilityDesc') }}</p>
          </div>
          <span class="count-pill">{{ enabledMarketCount }}/{{ marketSources.length }}</span>
        </div>

        <div class="panel-grid market-grid">
          <section class="manager-card primary-card">
            <div class="manager-card-header">
              <div>
                <h3>{{ t('dataSources.builtinSources') }}</h3>
                <p>{{ t('dataSources.builtinMarketManageDesc') }}</p>
              </div>
            </div>

            <div class="market-group">
              <div class="market-group-title">{{ t('settings.market.btcSources') }}</div>
              <div class="source-row-list">
                <button
                  v-for="source in marketBuiltinRows('crypto', btcMarketSources)"
                  :key="source.key"
                  class="source-manage-row"
                  :class="{ enabled: isMarketEnabled(source) }"
                  type="button"
                  :disabled="!source.id"
                  @click="toggleMarketSource(source)"
                >
                  <span class="source-avatar market">{{ source.label.slice(0, 2).toUpperCase() }}</span>
                  <span class="source-row-main">
                    <strong>{{ source.label }}</strong>
                    <small>{{ t('assets.types.crypto') }}</small>
                  </span>
                  <span class="state-copy">{{ isMarketEnabled(source) ? t('dataSources.enabled') : t('dataSources.disabled') }}</span>
                  <span class="source-switch" aria-hidden="true"></span>
                </button>
              </div>
            </div>

            <div class="market-group">
              <div class="market-group-title">{{ t('settings.market.goldSources') }}</div>
              <div class="source-row-list">
                <button
                  v-for="source in marketBuiltinRows('precious_metal', goldMarketSources)"
                  :key="source.key"
                  class="source-manage-row"
                  :class="{ enabled: isMarketEnabled(source) }"
                  type="button"
                  :disabled="!source.id"
                  @click="toggleMarketSource(source)"
                >
                  <span class="source-avatar metal">{{ source.label.slice(0, 2).toUpperCase() }}</span>
                  <span class="source-row-main">
                    <strong>{{ source.label }}</strong>
                    <small>{{ t('assets.types.precious_metal') }}</small>
                  </span>
                  <span class="state-copy">{{ isMarketEnabled(source) ? t('dataSources.enabled') : t('dataSources.disabled') }}</span>
                  <span class="source-switch" aria-hidden="true"></span>
                </button>
              </div>
            </div>
          </section>

          <section class="manager-card custom-card">
            <div class="manager-card-header action-header">
              <div>
                <h3>{{ t('dataSources.customHttpTitle') }}</h3>
                <p>{{ t('dataSources.customHttpDesc') }}</p>
              </div>
              <button class="btn btn-sm" type="button" @click="openSourceDrawer('market')">{{ t('common.add') }}</button>
            </div>

            <div v-if="customMarketSources.length" class="source-row-list custom-list">
              <article v-for="source in customMarketSources" :key="source.id" class="source-manage-row custom-row" :class="{ enabled: isMarketEnabled(source) }">
                <span class="source-avatar http">HTTP</span>
                <span class="source-row-main">
                  <strong>{{ source.name }}</strong>
                  <span>{{ marketSourceUrl(source) }}</span>
                </span>
                <button class="state-button" type="button" @click="toggleMarketSource(source)">{{ isMarketEnabled(source) ? t('dataSources.enabled') : t('dataSources.disabled') }}</button>
                <button class="btn btn-sm" type="button" :disabled="testingSourceId === source.id" @click="testMarketSource(source)">{{ testingSourceId === source.id ? t('dataSources.testing') : t('settings.market.testSource') }}</button>
                <button class="icon-danger-btn" type="button" @click="confirmDeleteMarketSource(source)">×</button>
              </article>
            </div>
            <div v-else class="empty-card">
              <div class="empty-icon">📡</div>
              <p>{{ t('dataSources.noCustomHttp') }}</p>
            </div>
          </section>
        </div>
      </section>
    </template>

    <AppDrawer v-model="sourceDrawerOpen" :title="t('dataSources.addSourceTitle')" mobileHeight="fixed">
      <form class="source-drawer-form" @submit.prevent="addSourceFromDrawer">
        <div class="source-kind-toggle" role="tablist" :aria-label="t('dataSources.sourceKindLabel')">
          <button class="source-kind-card" :class="{ active: sourceKind === 'news' }" type="button" @click="sourceKind = 'news'">
            <strong>{{ t('dataSources.newsTab') }}</strong>
            <small>{{ t('dataSources.newsKindDesc') }}</small>
          </button>
          <button class="source-kind-card" :class="{ active: sourceKind === 'market' }" type="button" @click="sourceKind = 'market'">
            <strong>{{ t('dataSources.marketTab') }}</strong>
            <small>{{ t('dataSources.marketKindDesc') }}</small>
          </button>
        </div>

        <template v-if="sourceKind === 'news'">
          <input ref="newsNameInputRef" class="form-input" v-model.trim="newNewsSource.name" :placeholder="t('settings.news.sourceNamePlaceholder')" autocomplete="off" />
          <input class="form-input" v-model.trim="newNewsSource.url" type="url" :placeholder="t('settings.news.sourceUrlPlaceholder')" autocomplete="off" />
          <p class="form-helper">{{ t('dataSources.rssDrawerHelp') }}</p>
        </template>

        <template v-else>
          <input ref="marketNameInputRef" class="form-input" v-model.trim="newMarketSource.name" :placeholder="t('settings.market.sourceNamePlaceholder')" autocomplete="off" />
          <select class="form-select" v-model="newMarketSource.asset_class">
            <option value="crypto">{{ t('assets.types.crypto') }}</option>
            <option value="precious_metal">{{ t('assets.types.precious_metal') }}</option>
            <option value="equity">{{ t('dataSources.assetClasses.equity') }}</option>
            <option value="forex">{{ t('dataSources.assetClasses.forex') }}</option>
            <option value="fund">{{ t('dataSources.assetClasses.fund') }}</option>
            <option value="index">{{ t('dataSources.assetClasses.index') }}</option>
            <option value="all">{{ t('common.all') }}</option>
          </select>
          <input class="form-input" v-model.trim="newMarketSource.url_template" :placeholder="t('settings.market.urlTemplatePlaceholder')" autocomplete="off" />
          <input class="form-input" v-model.trim="newMarketSource.price_path" :placeholder="t('settings.market.pricePathPlaceholder')" autocomplete="off" />
          <input class="form-input" v-model.trim="newMarketSource.currency_path" :placeholder="t('dataSources.currencyPathPlaceholder')" autocomplete="off" />
          <input class="form-input" v-model.trim="newMarketSource.timestamp_path" :placeholder="t('dataSources.timestampPathPlaceholder')" autocomplete="off" />
          <p class="form-helper">{{ t('dataSources.urlTemplateHelp') }}</p>
        </template>
      </form>

      <template #footer>
        <div class="drawer-footer-actions">
          <button class="btn" type="button" @click="sourceDrawerOpen = false">{{ t('common.cancel') }}</button>
          <button class="btn btn-primary" type="button" :disabled="addingSource || !canAddCurrentSource" @click="addSourceFromDrawer">
            {{ addingSource ? t('dataSources.adding') : t('common.add') }}
          </button>
        </div>
      </template>
    </AppDrawer>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDrawer from '../components/AppDrawer.vue'
import { useMobilePageActions } from '../composables/useMobilePageActions.js'
import { useRuntimeSettingsStore } from '../stores/runtime-settings.js'
import { api } from '../utils/api.js'
import { useConfirm } from '../utils/confirm.js'
import { useToast } from '../utils/toast.js'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const mobilePageActions = useMobilePageActions()
const runtimeSettingsStore = useRuntimeSettingsStore()

const loading = ref(true)
const saving = ref(false)
const addingNewsSource = ref(false)
const addingMarketSource = ref(false)
const loadError = ref('')
const activeTab = ref('news')
const testingSourceId = ref(null)
const newsNameInputRef = ref(null)
const marketNameInputRef = ref(null)
const sourceDrawerOpen = ref(false)
const sourceKind = ref('news')

const newsAvailableSources = ref([])
const settingsValues = ref({})
const customNewsSources = ref([])
const marketSources = ref([])
const draftCustomNewsEnabled = reactive({})
const initialCustomNewsEnabled = reactive({})
const draftMarketEnabled = reactive({})
const initialMarketEnabled = reactive({})
const initialNewsAvailable = ref('')
const newNewsSource = reactive({ name: '', url: '' })
const newMarketSource = reactive({ name: '', asset_class: 'crypto', url_template: '', price_path: 'price', currency_path: '', timestamp_path: '' })

const builtinNewsSources = computed(() => [
  { key: 'coindesk', logo: 'CD', label: t('settings.news.builtinSourceLabels.coindesk'), desc: t('dataSources.newsSourceDesc.coindesk') },
  { key: 'cointelegraph', logo: 'CT', label: t('settings.news.builtinSourceLabels.cointelegraph'), desc: t('dataSources.newsSourceDesc.cointelegraph') },
  { key: 'decrypt', logo: 'DC', label: t('settings.news.builtinSourceLabels.decrypt'), desc: t('dataSources.newsSourceDesc.decrypt') },
  { key: 'crypto_news', logo: 'CN', label: t('settings.news.builtinSourceLabels.crypto_news'), desc: t('dataSources.newsSourceDesc.crypto_news') },
  { key: 'yahoo_finance', logo: 'YF', label: t('settings.news.builtinSourceLabels.yahoo_finance'), desc: t('dataSources.newsSourceDesc.yahoo_finance') },
  { key: 'blockchain_news', logo: 'BN', label: t('settings.news.builtinSourceLabels.blockchain_news'), desc: t('dataSources.newsSourceDesc.blockchain_news') },
  { key: 'panews', logo: 'PA', label: t('settings.news.builtinSourceLabels.panews'), desc: t('dataSources.newsSourceDesc.panews') },
  { key: 'coingecko', logo: 'CG', label: t('settings.news.builtinSourceLabels.coingecko'), desc: t('dataSources.newsSourceDesc.coingecko') },
  { key: 'bitcoin_magazine', logo: 'BM', label: t('settings.news.builtinSourceLabels.bitcoin_magazine'), desc: t('dataSources.newsSourceDesc.bitcoin_magazine') },
  { key: 'kitco', logo: 'KT', label: t('settings.news.builtinSourceLabels.kitco'), desc: t('dataSources.newsSourceDesc.kitco') },
  { key: 'fxstreet', logo: 'FX', label: t('settings.news.builtinSourceLabels.fxstreet'), desc: t('dataSources.newsSourceDesc.fxstreet') },
])

const btcMarketSources = computed(() => [
  { key: 'stablecoin_peg', label: t('settings.market.sourceLabels.stablecoin_peg') },
  { key: 'coingecko', label: t('settings.market.sourceLabels.coingecko') },
  { key: 'binance', label: t('settings.market.sourceLabels.binance') },
  { key: 'coinbase', label: t('settings.market.sourceLabels.coinbase') },
  { key: 'kraken', label: t('settings.market.sourceLabels.kraken') },
  { key: 'okx', label: t('settings.market.sourceLabels.okx') },
  { key: 'bitstamp', label: t('settings.market.sourceLabels.bitstamp') },
  { key: 'gemini', label: t('settings.market.sourceLabels.gemini') },
])
const goldMarketSources = computed(() => [
  { key: 'sge_sina', label: t('settings.market.sourceLabels.sge_sina') },
  { key: 'neodata', label: t('settings.market.sourceLabels.neodata') },
  { key: 'swissquote', label: t('settings.market.sourceLabels.swissquote') },
])

const customMarketSources = computed(() => marketSources.value.filter(source => source.source_type === 'custom_http'))
const enabledMarketCount = computed(() => marketSources.value.filter(source => isMarketEnabled(source)).length)
const canAddNewsSource = computed(() => newNewsSource.name && isValidHttpUrl(newNewsSource.url))
const canAddMarketSource = computed(() => newMarketSource.name && newMarketSource.price_path && isValidUrlTemplate(newMarketSource.url_template))
const canAddCurrentSource = computed(() => sourceKind.value === 'news' ? canAddNewsSource.value : canAddMarketSource.value)
const addingSource = computed(() => sourceKind.value === 'news' ? addingNewsSource.value : addingMarketSource.value)
const hasChanges = computed(() => serialize(newsAvailableSources.value) !== initialNewsAvailable.value || customNewsSources.value.some(source => isCustomNewsEnabled(source) !== initialCustomNewsEnabled[source.id]) || marketSources.value.some(source => isMarketEnabled(source) !== initialMarketEnabled[source.id]))
const saveButtonText = computed(() => hasChanges.value ? t('dataSources.saveChanges') : t('common.saved'))
const tabs = computed(() => [
  { key: 'news', icon: '📰', label: t('dataSources.newsTab'), meta: t('dataSources.availableCount', { count: newsAvailableSources.value.length }) },
  { key: 'market', icon: '📈', label: t('dataSources.marketTab'), meta: t('dataSources.availableCount', { count: enabledMarketCount.value }) },
])

function serialize(values) {
  return [...values].map(value => String(value).trim()).filter(Boolean).sort().join(',')
}
function csvToArray(value, fallback = []) {
  const values = String(value || '').split(',').map(item => item.trim()).filter(Boolean)
  return values.length ? values : [...fallback]
}
function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}
function isValidUrlTemplate(value) {
  return isValidHttpUrl(String(value || '').replace(/{[^}]+}/g, 'BTC'))
}
function isNewsAvailable(key) {
  return newsAvailableSources.value.includes(key)
}
function toggleNewsBuiltin(key) {
  newsAvailableSources.value = isNewsAvailable(key)
    ? newsAvailableSources.value.filter(item => item !== key)
    : [...newsAvailableSources.value, key]
}
function isCustomNewsEnabled(source) {
  return draftCustomNewsEnabled[source.id] ?? source.enabled !== 0
}
function toggleCustomNews(source) {
  draftCustomNewsEnabled[source.id] = !isCustomNewsEnabled(source)
}
function isMarketEnabled(source) {
  return draftMarketEnabled[source.id] ?? source.enabled !== 0
}
function toggleMarketSource(source) {
  if (!source?.id) return
  draftMarketEnabled[source.id] = !isMarketEnabled(source)
}
function marketBuiltinRows(assetClass, definitions) {
  return definitions.map((definition) => {
    const row = marketSources.value.find(source => source.key === definition.key && source.source_type === 'builtin')
    return row ? { ...row, label: definition.label } : { ...definition, id: null, asset_class: assetClass, source_type: 'builtin', enabled: 0 }
  })
}
function marketSourceConfig(source) {
  if (!source?.config_json) return {}
  try {
    return typeof source.config_json === 'string' ? JSON.parse(source.config_json) : source.config_json
  } catch {
    return {}
  }
}
function marketSourceUrl(source) {
  const config = marketSourceConfig(source)
  return config.url_template || config.url || t('dataSources.noUrlTemplate')
}
function captureInitialState() {
  initialNewsAvailable.value = serialize(newsAvailableSources.value)
  for (const key of Object.keys(initialCustomNewsEnabled)) delete initialCustomNewsEnabled[key]
  for (const key of Object.keys(initialMarketEnabled)) delete initialMarketEnabled[key]
  for (const source of customNewsSources.value) {
    draftCustomNewsEnabled[source.id] = source.enabled !== 0
    initialCustomNewsEnabled[source.id] = source.enabled !== 0
  }
  for (const source of marketSources.value) {
    draftMarketEnabled[source.id] = source.enabled !== 0
    initialMarketEnabled[source.id] = source.enabled !== 0
  }
}
function enabledBuiltinMarketKeys(assetClass) {
  return marketSources.value
    .filter(source => source.source_type === 'builtin' && source.asset_class === assetClass && isMarketEnabled(source))
    .map(source => source.key)
}
function pruneCsvSelection(value, allowedKeys) {
  const allowed = new Set(allowedKeys)
  return csvToArray(value, []).filter(key => allowed.has(key)).join(',')
}

async function loadSettings() {
  const res = await api('/api/settings')
  const json = await res.json()
  if (!json.success) throw new Error(json.error || t('common.loadFailed'))
  settingsValues.value = json.data || {}
  runtimeSettingsStore.mergeValues(settingsValues.value)
  newsAvailableSources.value = csvToArray(settingsValues.value.news_sources_available, builtinNewsSources.value.map(source => source.key))
}
async function loadCustomNewsSources() {
  const res = await api('/api/news/sources')
  const json = await res.json()
  if (!json.success) throw new Error(json.error || t('common.loadFailed'))
  customNewsSources.value = json.data || []
}
async function loadMarketSources() {
  const res = await api('/api/market/sources')
  const json = await res.json()
  if (!json.success) throw new Error(json.error || t('common.loadFailed'))
  marketSources.value = json.data || []
}
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    await Promise.all([loadSettings(), loadCustomNewsSources(), loadMarketSources()])
    captureInitialState()
  } catch (error) {
    loadError.value = error.message || t('common.loadFailed')
  } finally {
    loading.value = false
  }
}
async function saveAvailability() {
  if (!hasChanges.value) return
  saving.value = true
  try {
    const availableNewsKeys = newsAvailableSources.value
    const availableCryptoKeys = enabledBuiltinMarketKeys('crypto')
    const availablePreciousMetalKeys = enabledBuiltinMarketKeys('precious_metal')
    const payload = {
      news_sources_available: availableNewsKeys.join(','),
      news_sources_enabled: pruneCsvSelection(settingsValues.value.news_sources_enabled, availableNewsKeys),
      market_crypto_sources_enabled: pruneCsvSelection(settingsValues.value.market_crypto_sources_enabled || settingsValues.value.market_btc_sources_enabled, availableCryptoKeys),
      market_precious_metal_sources_enabled: pruneCsvSelection(settingsValues.value.market_precious_metal_sources_enabled || settingsValues.value.market_gold_sources_enabled, availablePreciousMetalKeys),
    }
    payload.market_btc_sources_enabled = payload.market_crypto_sources_enabled
    payload.market_gold_sources_enabled = payload.market_precious_metal_sources_enabled

    const settingRes = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) })
    const settingJson = await settingRes.json()
    if (!settingJson.success) throw new Error(settingJson.error || t('common.saveFailed'))

    const requests = []
    for (const source of customNewsSources.value) {
      const enabled = isCustomNewsEnabled(source)
      if (enabled !== initialCustomNewsEnabled[source.id]) {
        requests.push(api(`/api/news/sources/${source.id}`, { method: 'PUT', body: JSON.stringify({ enabled }) }))
      }
    }
    for (const source of marketSources.value) {
      const enabled = isMarketEnabled(source)
      if (enabled !== initialMarketEnabled[source.id]) {
        requests.push(api(`/api/market/sources/${source.id}`, { method: 'PUT', body: JSON.stringify({ enabled }) }))
      }
    }
    const results = await Promise.all(requests)
    for (const res of results) {
      const json = await res.json()
      if (!json.success) throw new Error(json.error || t('common.saveFailed'))
    }
    settingsValues.value = { ...settingsValues.value, ...payload }
    runtimeSettingsStore.mergeValues(payload)
    await Promise.all([loadCustomNewsSources(), loadMarketSources()])
    captureInitialState()
    toast.success(t('dataSources.saved'))
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function addCustomNewsSource() {
  if (!canAddNewsSource.value) return toast.error(t('dataSources.invalidRssUrl'))
  addingNewsSource.value = true
  try {
    const res = await api('/api/news/sources', { method: 'POST', body: JSON.stringify({ ...newNewsSource }) })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('common.saveFailed'))
    newNewsSource.name = ''
    newNewsSource.url = ''
    await loadCustomNewsSources()
    captureInitialState()
    sourceDrawerOpen.value = false
    toast.success(t('dataSources.customRssAdded'))
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
  } finally {
    addingNewsSource.value = false
  }
}
async function confirmDeleteCustomNewsSource(source) {
  const ok = await confirm({ title: t('dataSources.confirmDeleteTitle'), message: t('dataSources.confirmDeleteRss', { name: source.name }), confirmText: t('common.delete'), cancelText: t('common.cancel'), icon: 'delete', danger: true })
  if (ok) await deleteCustomNewsSource(source.id)
}
async function deleteCustomNewsSource(id) {
  try {
    const res = await api(`/api/news/sources/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('common.deleteFailed'))
    customNewsSources.value = customNewsSources.value.filter(source => source.id !== id)
    delete draftCustomNewsEnabled[id]
    delete initialCustomNewsEnabled[id]
    toast.success(t('dataSources.sourceDeleted'))
  } catch (error) {
    toast.error(error.message || t('common.deleteFailed'))
  }
}
async function addMarketSource() {
  if (!canAddMarketSource.value) return toast.error(t('dataSources.invalidMarketSource'))
  addingMarketSource.value = true
  try {
    const res = await api('/api/market/sources', { method: 'POST', body: JSON.stringify({ ...newMarketSource }) })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('common.saveFailed'))
    newMarketSource.name = ''
    newMarketSource.asset_class = 'crypto'
    newMarketSource.url_template = ''
    newMarketSource.price_path = 'price'
    newMarketSource.currency_path = ''
    newMarketSource.timestamp_path = ''
    await loadMarketSources()
    captureInitialState()
    sourceDrawerOpen.value = false
    toast.success(t('settings.market.sourceAdded'))
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
  } finally {
    addingMarketSource.value = false
  }
}
async function testMarketSource(source) {
  testingSourceId.value = source.id
  try {
    const samples = {
      precious_metal: { symbol: 'XAUUSD', currency: 'USD', unit: 'oz' },
      equity: { symbol: 'AAPL', currency: 'USD', unit: 'share' },
      forex: { symbol: 'EURUSD', currency: 'USD', unit: 'pair' },
      fund: { symbol: 'SPY', currency: 'USD', unit: 'share' },
      index: { symbol: 'SPX', currency: 'USD', unit: 'point' },
    }
    const sample = samples[source.asset_class] || { symbol: 'BTC', currency: 'USD', unit: 'coin' }
    const res = await api(`/api/market/sources/${source.id}/test`, { method: 'POST', body: JSON.stringify({ ...sample, asset_class: source.asset_class }) })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('settings.market.sourceTestFailed'))
    toast.success(t('settings.market.sourceTestOk', { price: json.data.price, currency: json.data.currency }))
  } catch (error) {
    toast.error(error.message || t('settings.market.sourceTestFailed'))
  } finally {
    testingSourceId.value = null
  }
}
async function confirmDeleteMarketSource(source) {
  const ok = await confirm({ title: t('dataSources.confirmDeleteTitle'), message: t('dataSources.confirmDeleteHttp', { name: source.name }), confirmText: t('common.delete'), cancelText: t('common.cancel'), icon: 'delete', danger: true })
  if (ok) await deleteMarketSource(source.id)
}
async function deleteMarketSource(id) {
  try {
    const res = await api(`/api/market/sources/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || t('common.deleteFailed'))
    marketSources.value = marketSources.value.filter(source => source.id !== id)
    delete draftMarketEnabled[id]
    delete initialMarketEnabled[id]
    toast.success(t('dataSources.sourceDeleted'))
  } catch (error) {
    toast.error(error.message || t('common.deleteFailed'))
  }
}
async function focusDrawerFirstInput() {
  await nextTick()
  window.setTimeout(() => {
    const target = sourceKind.value === 'news' ? newsNameInputRef.value : marketNameInputRef.value
    target?.focus?.({ preventScroll: true })
  }, 180)
}

function openSourceDrawer(kind = activeTab.value) {
  sourceKind.value = kind === 'market' ? 'market' : 'news'
  sourceDrawerOpen.value = true
  focusDrawerFirstInput()
}

async function addSourceFromDrawer() {
  if (sourceKind.value === 'news') await addCustomNewsSource()
  else await addMarketSource()
}

function syncMobileActions() {
  const actions = [
    { key: 'add-source', label: t('dataSources.addSourceTitle'), onSelect: () => openSourceDrawer(activeTab.value) },
    { key: 'refresh', label: t('common.refresh'), onSelect: load, disabled: loading.value },
  ]
  if (hasChanges.value || saving.value) {
    actions.splice(1, 0, {
      key: 'save',
      label: saving.value ? t('dataSources.saving') : t('dataSources.saveChanges'),
      onSelect: saveAvailability,
      disabled: saving.value,
    })
  }
  mobilePageActions.setActions(actions)
}

watch([saveButtonText, hasChanges, saving, loading], syncMobileActions, { immediate: true })
onMounted(load)
onUnmounted(() => mobilePageActions.clearActions())
</script>

<style scoped>
.data-sources-page { width: 100%; max-width: 1180px; min-width: 0; overflow-x: hidden; padding-bottom: 36px; }
.data-sources-page * { box-sizing: border-box; }
.source-hero {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
  padding: 24px; margin-bottom: 14px; border: 1px solid var(--border); border-radius: 22px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--blue) 15%, var(--bg-card)), var(--bg-card));
  box-shadow: 0 18px 42px color-mix(in srgb, var(--shadow-color) 70%, transparent);
}
.hero-kicker, .panel-kicker { color: var(--primary); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.hero-subtitle { color: var(--text-dim); font-size: 14px; line-height: 1.65; }
.hero-actions { display: flex; gap: 10px; flex-shrink: 0; }
.scope-callout {
  display: flex; gap: 12px; padding: 14px 16px; margin-bottom: 16px;
  border: 1px solid color-mix(in srgb, var(--warning) 42%, var(--border)); border-radius: 16px;
  background: var(--warning-soft);
}
.scope-icon { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: var(--warning); color: #111827; font-weight: 900; flex-shrink: 0; }
.scope-callout p { margin: 2px 0 0; color: var(--text-dim); font-size: 13px; line-height: 1.5; }
.source-alert { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 14px 16px; margin-bottom: 16px; border: 1px solid var(--danger-border); border-radius: 14px; background: var(--danger-soft); color: var(--red); }
.source-alert div { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.source-mode-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; min-width: 0; margin-bottom: 18px; }
.source-mode-card { display: flex; align-items: center; gap: 14px; min-width: 0; min-height: 86px; padding: 16px; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text); cursor: pointer; text-align: left; font: inherit; transition: border-color .18s, background .18s, transform .18s; }
.source-mode-card:active { transform: scale(.99); }
.source-mode-card.active.news { border-color: var(--primary); background: color-mix(in srgb, var(--blue) 13%, var(--bg-card)); }
.source-mode-card.active.market { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 13%, var(--bg-card)); }
.mode-icon { display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 16px; background: var(--bg-hover); font-size: 24px; }
.mode-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mode-copy strong { font-size: 16px; }
.mode-copy small { color: var(--text-dim); }
.mode-arrow { color: var(--text-muted); font-size: 24px; }
.management-panel { min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 24px; padding: 20px; background: var(--bg-card); }
.news-panel { box-shadow: inset 4px 0 0 color-mix(in srgb, var(--blue) 64%, transparent); }
.market-panel { box-shadow: inset 4px 0 0 color-mix(in srgb, var(--gold) 64%, transparent); }
.panel-title-block { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.panel-title-block h2 { margin: 2px 0 4px; }
.panel-title-block p, .manager-card-header p, .form-helper { color: var(--text-dim); font-size: 13px; line-height: 1.5; }
.count-pill { display: inline-flex; align-items: center; min-height: 30px; padding: 4px 11px; border-radius: 999px; color: var(--primary); background: var(--info-soft); font-size: 12px; font-weight: 800; white-space: nowrap; }
.panel-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, .82fr); gap: 16px; align-items: start; }
.market-grid { grid-template-columns: minmax(0, .92fr) minmax(420px, 1fr); }
.manager-card { min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; padding: 16px; background: var(--bg); }
.primary-card { background: color-mix(in srgb, var(--bg) 90%, var(--blue)); }
.custom-card { background: color-mix(in srgb, var(--bg) 92%, var(--gold)); }
.manager-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.manager-card-header h3 { margin: 0 0 4px; }
.action-header { align-items: center; }
.source-row-list { display: flex; flex-direction: column; gap: 10px; }
.source-manage-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 16px; background: var(--bg-card); color: var(--text); cursor: pointer; text-align: left; font: inherit; }
.source-manage-row:disabled { opacity: .55; cursor: not-allowed; }
.source-manage-row.enabled { border-color: color-mix(in srgb, var(--green) 44%, var(--border)); background: color-mix(in srgb, var(--green) 7%, var(--bg-card)); }
.source-avatar { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 14px; background: var(--bg-hover); color: var(--primary); font-size: 12px; font-weight: 900; flex-shrink: 0; }
.source-avatar.rss { color: var(--blue); }
.source-avatar.market { color: var(--green); }
.source-avatar.metal, .source-avatar.http { color: var(--gold); }
.source-row-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
.source-row-main small, .source-row-main span, .source-row-main a { color: var(--text-dim); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.state-copy { color: var(--text-dim); font-size: 12px; font-weight: 700; }
.state-button { border: 1px solid var(--border); border-radius: 999px; background: var(--bg); color: var(--text-dim); padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.enabled .state-button { border-color: color-mix(in srgb, var(--green) 40%, var(--border)); color: var(--green); }
.source-switch { position: relative; display: inline-block; width: 40px; height: 24px; border-radius: 999px; background: var(--border); flex-shrink: 0; }
.source-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface-card); transition: transform .18s; }
.enabled .source-switch { background: var(--green); }
.enabled .source-switch::after { transform: translateX(16px); }
.custom-row { cursor: default; }
.icon-danger-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid var(--danger-border); border-radius: 10px; background: var(--danger-soft); color: var(--red); cursor: pointer; font-size: 18px; line-height: 1; flex-shrink: 0; }
.source-drawer-form { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.source-kind-toggle { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 4px; }
.source-kind-card { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.source-kind-card.active { border-color: var(--primary); background: var(--info-soft); }
.source-kind-card small { color: var(--text-dim); font-size: 12px; line-height: 1.35; }
.drawer-footer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.form-helper { margin: 0; }
.market-group + .market-group { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border); }
.market-group-title { margin-bottom: 10px; color: var(--text-dim); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.empty-card { padding: 28px 16px; border: 1px dashed var(--border); border-radius: 16px; text-align: center; color: var(--text-dim); background: var(--bg-card); }
.empty-card .empty-icon { font-size: 30px; margin-bottom: 8px; }
.source-skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.source-skeleton-card { min-height: 150px; padding: 16px; border: 1px solid var(--border); border-radius: 18px; background: var(--bg-card); }
.source-fold-enter-active, .source-fold-leave-active { transition: opacity .18s ease, transform .18s ease; }
.source-fold-enter-from, .source-fold-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-width: 1080px) { .panel-grid, .market-grid { grid-template-columns: 1fr; } }
@media (max-width: 768px) {
  .data-sources-page { max-width: 100%; padding-bottom: 112px; }
  .source-hero { padding: 18px; border-radius: 18px; margin-bottom: 12px; }
  .desktop-actions { display: none; }
  .scope-callout { padding: 12px; }
  .source-mode-switch { position: sticky; top: 0; z-index: 10; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px 0; background: var(--surface-overlay); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
  .source-mode-card { min-height: 72px; padding: 12px; border-radius: 16px; }
  .mode-icon { width: 34px; height: 34px; border-radius: 12px; font-size: 18px; }
  .mode-arrow { display: none; }
  .management-panel { padding: 14px; border-radius: 20px; }
  .panel-title-block, .manager-card-header { flex-direction: column; align-items: stretch; gap: 10px; }
  .action-header { flex-direction: row; align-items: center; }
  .source-drawer-form .form-input,
  .source-drawer-form .form-select { min-width: 0; font-size: 16px; }
  .source-manage-row { align-items: flex-start; }
  .source-row-main a, .source-row-main span { white-space: normal; word-break: break-all; }
  .custom-row { flex-wrap: wrap; }
  .custom-row .source-row-main { flex-basis: calc(100% - 52px); }
  .source-skeleton-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .source-hero { padding: 14px; }
  .source-mode-switch { gap: 8px; }
  .source-mode-card { min-height: 86px; flex-direction: column; align-items: flex-start; padding: 10px; }
  .mode-copy strong { font-size: 14px; }
  .mode-copy small { font-size: 11px; }
  .management-panel { padding: 12px; border-radius: 18px; }
  .manager-card { padding: 12px; border-radius: 16px; }
  .source-kind-toggle { grid-template-columns: 1fr; }
  .source-manage-row { gap: 10px; padding: 10px; }
  .state-copy { display: none; }
}
</style>

