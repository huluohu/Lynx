<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('settings.title') }}</h1>
    </div>

    <div class="settings-container">
      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.appearance.title') }}</span>
          <button class="save-btn" :class="{ changed: dirty.appearance }" @click="saveGroup('appearance')">
            {{ saveState.appearance === 'saved' ? `✓ ${t('common.saved')}` : t('common.save') }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.appearance.theme') }}</span>
              <span class="setting-desc">{{ t('settings.appearance.themeDesc') }}</span>
            </div>
            <select class="form-select inline-select" v-model="form.theme" @change="dirty.appearance = true">
              <option v-for="value in preferencesStore.supportedThemes" :key="value" :value="value">{{ t(`preferences.themes.${value}`) }}</option>
            </select>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.appearance.language') }}</span>
              <span class="setting-desc">{{ t('settings.appearance.languageDesc') }}</span>
            </div>
            <select class="form-select inline-select" v-model="form.language" @change="dirty.appearance = true">
              <option v-for="value in preferencesStore.supportedLanguages" :key="value" :value="value">{{ t(`preferences.languages.${value}`) }}</option>
            </select>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.appearance.marketColors') }}</span>
              <span class="setting-desc">{{ t('settings.appearance.marketColorsDesc') }}</span>
            </div>
            <select class="form-select inline-select" v-model="form.market_color_scheme" @change="dirty.appearance = true">
              <option v-for="option in marketColorOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.news.title') }}</span>
          <button class="save-btn" :class="{ changed: dirty.news }" @click="saveGroup('news')">
            {{ saveState.news === 'saved' ? `✓ ${t('common.saved')}` : t('common.save') }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.news.refreshInterval') }}</span>
              <span class="setting-desc">{{ t('settings.news.refreshIntervalDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="5" v-model="form.news_refresh_interval" @input="dirty.news = true" />
              <span class="setting-unit">{{ t('common.minuteUnit') }}</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.news.autoCache') }}</span>
              <span class="setting-desc">{{ t('settings.news.autoCacheDesc') }}</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form.news_auto_cache" true-value="true" false-value="false" @change="dirty.news = true" /><span class="slider"></span></label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.news.cacheBatchSize') }}</span>
              <span class="setting-desc">{{ t('settings.news.cacheBatchSizeDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" max="20" v-model="form.news_cache_batch_size" @input="dirty.news = true" />
              <span class="setting-unit">{{ t('common.itemUnit') }}</span>
            </div>
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.news.builtinSources') }}</span>
            <span class="setting-desc">{{ t('settings.news.enabledSourcesDesc') }}</span>
            <div v-if="enabledNewsSourceOptions.length" class="source-chips">
              <label v-for="src in enabledNewsSourceOptions" :key="src.key" class="source-chip" :class="{ active: selectedNewsSources.includes(src.key) }">
                <input type="checkbox" :value="src.key" v-model="selectedNewsSources" @change="dirty.news = true" />
                {{ src.label }}
              </label>
            </div>
            <span v-else class="setting-empty-hint">{{ t('settings.dataSources.noEnabledNewsSources') }}</span>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.market.title') }}</span>
          <button class="save-btn" :class="{ changed: dirty.market }" @click="saveGroup('market')">
            {{ saveState.market === 'saved' ? `✓ ${t('common.saved')}` : t('common.save') }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.market.dashboardRefreshInterval') }}</span>
              <span class="setting-desc">{{ t('settings.market.dashboardRefreshIntervalDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="0" v-model="form.refresh_interval" @input="dirty.market = true" />
              <span class="setting-unit">{{ t('common.secondUnit') }}</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.market.refreshInterval') }}</span>
              <span class="setting-desc">{{ t('settings.market.refreshIntervalDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="0" v-model="form.market_refresh_interval" @input="dirty.market = true" />
              <span class="setting-unit">{{ t('common.minuteUnit') }}</span>
            </div>
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.market.btcSources') }}</span>
            <span class="setting-desc">{{ t('settings.market.enabledSourcesDesc') }}</span>
            <div v-if="enabledBtcSourceOptions.length" class="source-chips">
              <label v-for="src in enabledBtcSourceOptions" :key="src.key" class="source-chip" :class="{ active: selectedBtcSources.includes(src.key) }">
                <input type="checkbox" :value="src.key" v-model="selectedBtcSources" @change="dirty.market = true" />
                {{ src.label }}
              </label>
            </div>
            <span v-else class="setting-empty-hint">{{ t('settings.dataSources.noEnabledMarketSources') }}</span>
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.market.goldSources') }}</span>
            <span class="setting-desc">{{ t('settings.market.enabledSourcesDesc') }}</span>
            <div v-if="enabledGoldSourceOptions.length" class="source-chips">
              <label v-for="src in enabledGoldSourceOptions" :key="src.key" class="source-chip" :class="{ active: selectedGoldSources.includes(src.key) }">
                <input type="checkbox" :value="src.key" v-model="selectedGoldSources" @change="dirty.market = true" />
                {{ src.label }}
              </label>
            </div>
            <span v-else class="setting-empty-hint">{{ t('settings.dataSources.noEnabledMarketSources') }}</span>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.market.rateCacheDuration') }}</span>
              <span class="setting-desc">{{ t('settings.market.rateCacheDurationDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" v-model="form.rate_cache_duration" @input="dirty.market = true" />
              <span class="setting-unit">{{ t('common.minuteUnit') }}</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.market.strategyMonitorInterval') }}</span>
              <span class="setting-desc">{{ t('settings.market.strategyMonitorIntervalDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" v-model="form.strategy_monitor_interval" @input="dirty.market = true" />
              <span class="setting-unit">{{ t('common.minuteUnit') }}</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.market.signalValidHours') }}</span>
              <span class="setting-desc">{{ t('settings.market.signalValidHoursDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="1" v-model="form.signal_valid_hours" @input="dirty.market = true" />
              <span class="setting-unit">{{ t('common.hourUnit') }}</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.market.priceAlertThreshold') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="decimal" step="0.1" v-model="form.price_alert_threshold" @input="dirty.market = true" />
              <span class="setting-unit">%</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.market.planApproachingPct') }}</span>
              <span class="setting-desc">{{ t('settings.market.planApproachingPctDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" v-model="form.plan_approaching_pct" @input="dirty.market = true" />
              <span class="setting-unit">%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.push.title') }}</span>
          <button class="save-btn" :class="{ changed: dirty.push }" @click="saveGroup('push')">
            {{ saveState.push === 'saved' ? `✓ ${t('common.saved')}` : t('common.save') }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.push.enabled') }}</span>
              <span class="setting-desc">{{ t('settings.push.enabledDesc') }}</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form.push_enabled" true-value="true" false-value="false" @change="dirty.push = true" /><span class="slider"></span></label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.push.webhookType') }}</span>
            </div>
            <select class="form-select inline-select" v-model="form.push_webhook_type" @change="dirty.push = true">
              <option v-for="option in pushTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.push.webhookUrl') }}</span>
            <input class="setting-input-full" type="url" v-model="form.push_webhook_url" :placeholder="webhookPlaceholder" @input="dirty.push = true" />
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.push.test') }}</span>
              <span class="setting-desc">{{ t('settings.push.testDesc') }}</span>
            </div>
            <button class="btn btn-sm" @click="testPush" :disabled="testingPush || !form.push_webhook_url">{{ testingPush ? t('settings.push.testSending') : t('settings.push.testSend') }}</button>
          </div>
        </div>
        <div class="settings-group-footer">{{ t('settings.push.channelsHint') }}</div>
      </div>

      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.notifications.title') }}</span>
        </div>
        <div class="settings-card">
          <div v-for="evt in notifyEvents" :key="evt.key" class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ evt.label }}</span>
              <span v-if="evt.desc" class="setting-desc">{{ evt.desc }}</span>
            </div>
            <label class="switch"><input type="checkbox" v-model="form[evt.key]" true-value="true" false-value="false" @change="saveKey(evt.key, form[evt.key])" /><span class="slider"></span></label>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.ai.title') }}</span>
          <button class="save-btn" :class="{ changed: dirty.ai }" @click="saveGroup('ai')">
            {{ saveState.ai === 'saved' ? `✓ ${t('common.saved')}` : t('common.save') }}
          </button>
        </div>
        <div class="settings-card">
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.ai.apiUrl') }}</span>
            <input class="setting-input-full" type="url" v-model="form.ai_api_url" placeholder="https://api.openai.com/v1/chat/completions" @input="dirty.ai = true" />
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.ai.apiKey') }}</span>
            <input class="setting-input-full" type="password" v-model="form.ai_api_key" placeholder="sk-..." @input="dirty.ai = true" />
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.ai.model') }}</span>
            </div>
            <input class="setting-input" type="text" v-model="form.ai_model" placeholder="gpt-4o-mini" @input="dirty.ai = true" />
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.ai.analysisModel') }}</span>
              <span class="setting-desc">{{ t('settings.ai.analysisModelDesc') }}</span>
            </div>
            <input class="setting-input" type="text" v-model="form.agent_analysis_model" :placeholder="t('settings.ai.sameAsAbove')" @input="dirty.ai = true" />
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.ai.retryCount') }}</span>
              <span class="setting-desc">{{ t('settings.ai.retryCountDesc') }}</span>
            </div>
            <input class="setting-input" type="number" inputmode="numeric" min="1" max="5" v-model="form.agent_llm_retries" @input="dirty.ai = true" />
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.ai.searchApiUrl') }} <span class="setting-desc">({{ t('settings.ai.searchApiUrlDesc') }})</span></span>
            <input class="setting-input-full" type="url" v-model="form.agent_search_api_url" placeholder="https://api.search.example/v1/search" @input="dirty.ai = true" />
          </div>
          <div class="setting-item setting-item-vertical">
            <span class="setting-label">{{ t('settings.ai.searchApiKey') }}</span>
            <input class="setting-input-full" type="password" v-model="form.agent_search_api_key" :placeholder="t('settings.ai.optional')" @input="dirty.ai = true" />
          </div>
        </div>
        <div class="settings-group-footer">{{ t('settings.ai.footer') }}</div>
      </div>

      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.about.title') }}</span>
        </div>
        <div class="settings-card">
          <div class="setting-item" @click="router.push('/about')" style="cursor:pointer">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.about.openPage') }}</span>
              <span class="setting-desc">{{ t('settings.about.openPageDesc') }}</span>
            </div>
            <span style="color:var(--text-muted)">›</span>
          </div>
        </div>
      </div>

      <div class="settings-group">
        <div class="settings-group-header">
          <span class="settings-group-title">{{ t('settings.account.title') }}</span>
        </div>
        <div class="settings-card">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.account.credentials') }}</span>
              <span class="setting-desc">{{ t('settings.account.credentialsDesc') }}</span>
            </div>
          </div>
          <div class="setting-item" @click="confirmLogout" style="cursor:pointer">
            <span class="setting-label" style="color:var(--red)">{{ t('settings.account.logout') }}</span>
            <span style="color:var(--text-muted)">›</span>
          </div>
        </div>
      </div>

      <div class="version-info">
        L¥NX v{{ appVersion }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth.js'
import { useRuntimeSettingsStore } from '../stores/runtime-settings.js'
import { usePreferencesStore } from '../stores/preferences.js'
import { api } from '../utils/api.js'
import { useConfirm } from '../utils/confirm.js'
import { useToast } from '../utils/toast.js'
import { appVersion } from '../utils/appVersion.js'

const router = useRouter()
const authStore = useAuthStore()
const runtimeSettingsStore = useRuntimeSettingsStore()
const preferencesStore = usePreferencesStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()
const form = reactive({
  theme: preferencesStore.theme,
  language: preferencesStore.language,
  market_color_scheme: preferencesStore.marketColorScheme,
  refresh_interval: '60',
  market_refresh_interval: '5',
  market_crypto_sources_enabled: 'stablecoin_peg,coingecko,binance,coinbase,kraken,okx,bitstamp,gemini',
  market_precious_metal_sources_enabled: 'sge_sina,neodata,swissquote',
  market_btc_sources_enabled: 'stablecoin_peg,coingecko,binance,coinbase,kraken,okx,bitstamp,gemini',
  market_gold_sources_enabled: 'sge_sina,neodata,swissquote',
  news_sources_available: '',
  rate_cache_duration: '60',
  strategy_monitor_interval: '5',
  signal_valid_hours: '24',
  news_refresh_interval: '30',
  news_sources_enabled: 'coindesk,cointelegraph,decrypt,panews,coingecko',
  news_auto_cache: 'true',
  news_cache_batch_size: '5',
  price_alert_threshold: '2',
  plan_approaching_pct: '5',
  ai_api_url: '',
  ai_api_key: '',
  ai_model: '',
  agent_analysis_model: '',
  agent_llm_retries: '3',
  agent_search_api_url: '',
  agent_search_api_key: '',
  push_enabled: 'true',
  push_webhook_type: 'wecom',
  push_webhook_url: '',
  notify_plan_triggered: 'true',
  notify_plan_approaching: 'false',
  notify_stop_loss: 'true',
  notify_price_swing: 'true',
  notify_trade_executed: 'false',
})

const dirty = reactive({ appearance: false, market: false, ai: false, news: false, push: false })
const saveState = reactive({ appearance: '', market: '', ai: '', news: '', push: '' })
const testingPush = ref(false)
const marketSources = ref([])
const selectedNewsSources = ref(['coindesk', 'cointelegraph', 'decrypt', 'panews', 'coingecko'])
const selectedBtcSources = ref(['stablecoin_peg', 'coingecko', 'binance', 'coinbase', 'kraken', 'okx', 'bitstamp', 'gemini'])
const selectedGoldSources = ref(['sge_sina', 'neodata', 'swissquote'])
const webhookPlaceholder = computed(() => {
  const map = {
    wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
    serverchan: 'https://sctapi.ftqq.com/xxx.send',
    pushplus: 'https://www.pushplus.plus/send',
    bark: 'https://api.day.app/xxx',
    custom: 'https://your-webhook.example.com/notify',
  }
  return map[form.push_webhook_type] || map.custom
})

const pushTypeOptions = computed(() => [
  { value: 'wecom', label: t('settings.push.wecom') },
  { value: 'serverchan', label: t('settings.push.serverchan') },
  { value: 'pushplus', label: t('settings.push.pushplus') },
  { value: 'bark', label: t('settings.push.bark') },
  { value: 'custom', label: t('settings.push.custom') },
])

const builtinNewsSources = computed(() => [
  { key: 'coindesk', label: t('settings.news.builtinSourceLabels.coindesk') },
  { key: 'cointelegraph', label: t('settings.news.builtinSourceLabels.cointelegraph') },
  { key: 'decrypt', label: t('settings.news.builtinSourceLabels.decrypt') },
  { key: 'crypto_news', label: t('settings.news.builtinSourceLabels.crypto_news') },
  { key: 'yahoo_finance', label: t('settings.news.builtinSourceLabels.yahoo_finance') },
  { key: 'blockchain_news', label: t('settings.news.builtinSourceLabels.blockchain_news') },
  { key: 'panews', label: t('settings.news.builtinSourceLabels.panews') },
  { key: 'coingecko', label: t('settings.news.builtinSourceLabels.coingecko') },
  { key: 'bitcoin_magazine', label: t('settings.news.builtinSourceLabels.bitcoin_magazine') },
  { key: 'kitco', label: t('settings.news.builtinSourceLabels.kitco') },
  { key: 'fxstreet', label: t('settings.news.builtinSourceLabels.fxstreet') },
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

const enabledNewsSourceOptions = computed(() => {
  const available = new Set(csvToArray(form.news_sources_available, builtinNewsSources.value.map(source => source.key)))
  return builtinNewsSources.value.filter(source => available.has(source.key))
})

const enabledBtcSourceOptions = computed(() => enabledMarketSourceOptions('crypto', btcMarketSources.value))
const enabledGoldSourceOptions = computed(() => enabledMarketSourceOptions('precious_metal', goldMarketSources.value))

const marketColorOptions = computed(() => preferencesStore.supportedMarketColorSchemes.map((value) => ({
  value,
  label: t(`preferences.marketColorSchemes.${value}`),
})))

const notifyEvents = computed(() => [
  { key: 'notify_plan_triggered', label: t('settings.notifications.planTriggered'), desc: t('settings.notifications.planTriggeredDesc') },
  { key: 'notify_plan_approaching', label: t('settings.notifications.planApproaching'), desc: t('settings.notifications.planApproachingDesc') },
  { key: 'notify_stop_loss', label: t('settings.notifications.stopLoss'), desc: t('settings.notifications.stopLossDesc') },
  { key: 'notify_price_swing', label: t('settings.notifications.priceSwing'), desc: t('settings.notifications.priceSwingDesc') },
  { key: 'notify_trade_executed', label: t('settings.notifications.tradeExecuted'), desc: t('settings.notifications.tradeExecutedDesc') },
])

const groupKeys = {
  appearance: ['market_color_scheme'],
  market: ['refresh_interval', 'market_refresh_interval', 'market_crypto_sources_enabled', 'market_precious_metal_sources_enabled', 'market_btc_sources_enabled', 'market_gold_sources_enabled', 'rate_cache_duration', 'strategy_monitor_interval', 'signal_valid_hours', 'price_alert_threshold', 'plan_approaching_pct'],
  ai: ['ai_api_url', 'ai_api_key', 'ai_model', 'agent_analysis_model', 'agent_llm_retries', 'agent_search_api_url', 'agent_search_api_key'],
  news: ['news_refresh_interval', 'news_sources_enabled', 'news_auto_cache', 'news_cache_batch_size'],
  push: ['push_enabled', 'push_webhook_type', 'push_webhook_url'],
}

function csvToArray(value, fallback = []) {
  const values = String(value || '').split(',').map((source) => source.trim()).filter(Boolean)
  return values.length ? values : [...fallback]
}

function enabledMarketSourceOptions(assetClass, definitions) {
  const rows = marketSources.value.filter(source => source.source_type === 'builtin' && source.asset_class === assetClass && source.enabled !== 0)
  if (!marketSources.value.length) return definitions
  const enabledKeys = new Set(rows.map(source => source.key))
  return definitions.filter(source => enabledKeys.has(source.key))
}

function filterSelection(values, options) {
  const allowed = new Set(options.map(option => option.key))
  return values.filter(value => allowed.has(value))
}

function syncSelectedSources() {
  selectedNewsSources.value = filterSelection(csvToArray(form.news_sources_enabled, selectedNewsSources.value), enabledNewsSourceOptions.value)
  selectedBtcSources.value = filterSelection(csvToArray(form.market_crypto_sources_enabled || form.market_btc_sources_enabled, selectedBtcSources.value), enabledBtcSourceOptions.value)
  selectedGoldSources.value = filterSelection(csvToArray(form.market_precious_metal_sources_enabled || form.market_gold_sources_enabled, selectedGoldSources.value), enabledGoldSourceOptions.value)
}

async function refreshSourceAvailability() {
  const [settingsRes, marketRes] = await Promise.all([
    api('/api/settings'),
    api('/api/market/sources'),
  ])
  const settingsJson = await settingsRes.json()
  if (settingsJson.success && 'news_sources_available' in (settingsJson.data || {})) {
    form.news_sources_available = settingsJson.data.news_sources_available || ''
  }
  const marketJson = await marketRes.json()
  if (marketJson.success) marketSources.value = marketJson.data || []
  syncSelectedSources()
}

function markSaved(group) {
  saveState[group] = 'saved'
  setTimeout(() => {
    saveState[group] = ''
  }, 2000)
}

function showSaveError(error) {
  toast.error(t('settings.alerts.saveFailed', { message: error?.message || t('common.unknownError') }))
}

async function load() {
  try {
    const [res, marketRes] = await Promise.all([
      api('/api/settings'),
      api('/api/market/sources'),
    ])
    const json = await res.json()
    if (json.success) {
      runtimeSettingsStore.mergeValues(json.data)
      preferencesStore.applyServerSettings(json.data)
      for (const [key, value] of Object.entries(json.data)) {
        if (key in form) form[key] = value
      }
      form.theme = preferencesStore.theme
      form.language = preferencesStore.language
      form.market_color_scheme = preferencesStore.marketColorScheme
    }
    const marketJson = await marketRes.json()
    if (marketJson.success) marketSources.value = marketJson.data || []
    syncSelectedSources()
  } catch {}

}

async function saveGroup(group) {
  const keys = groupKeys[group]
  if (!keys) return
  try {
    if (group === 'appearance') {
      await preferencesStore.setTheme(form.theme, { persistServer: true })
      await preferencesStore.setLanguage(form.language, { persistServer: true })
      await preferencesStore.setMarketColorScheme(form.market_color_scheme, { persistServer: true })
      form.theme = preferencesStore.theme
      form.language = preferencesStore.language
      form.market_color_scheme = preferencesStore.marketColorScheme
      dirty.appearance = false
      markSaved(group)
      return
    }
    if (group === 'news' || group === 'market') {
      await refreshSourceAvailability()
    }
    if (group === 'news') {
      form.news_sources_enabled = selectedNewsSources.value.join(',')
    }
    if (group === 'market') {
      form.market_crypto_sources_enabled = selectedBtcSources.value.join(',')
      form.market_precious_metal_sources_enabled = selectedGoldSources.value.join(',')
      form.market_btc_sources_enabled = form.market_crypto_sources_enabled
      form.market_gold_sources_enabled = form.market_precious_metal_sources_enabled
    }
    const payload = {}
    for (const key of keys) payload[key] = form[key]
    const res = await api('/api/settings', { method: 'PUT', body: JSON.stringify(payload) })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error || t('common.unknownError'))
    }
    runtimeSettingsStore.mergeValues(payload)
    dirty[group] = false
    markSaved(group)
  } catch (error) {
    showSaveError(error)
  }
}

async function saveKey(key, value) {
  try {
    const res = await api(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value })
    })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error || t('common.unknownError'))
    }
    runtimeSettingsStore.mergeValues({ [key]: value })
  } catch (error) {
    showSaveError(error)
  }
}

function doLogout() {
  authStore.logout()
  router.push('/login')
}

async function confirmLogout() {
  const ok = await confirm({
    title: t('nav.logoutTitle'),
    message: t('nav.logoutMessage'),
    confirmText: t('nav.logoutConfirm'),
    cancelText: t('common.cancel'),
    icon: 'logout',
    danger: true,
  })
  if (ok) doLogout()
}

async function testPush() {
  testingPush.value = true
  try {
    await saveGroup('push')
    const res = await api('/api/notifications/test-push', { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      toast.success(t('settings.push.testSuccess'))
    } else {
      toast.error(t('settings.push.testFailed', { message: json.error || t('common.unknownError') }))
    }
  } catch (error) {
    toast.error(t('settings.push.testFailed', { message: error.message }))
  }
  testingPush.value = false
}

onMounted(load)
</script>

<style scoped>
.settings-page {
  max-width: 720px;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.settings-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  margin-bottom: 8px;
  gap: 12px;
}

.settings-group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.setting-inline-value {
  font-size: 13px;
  color: var(--text);
  font-weight: 600;
}

.save-btn {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.save-btn.changed {
  background: var(--blue);
  color: #fff;
  animation: pulse-once 0.3s ease;
}
@keyframes pulse-once {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.settings-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  min-height: 48px;
}
.setting-item:last-child {
  border-bottom: none;
}

.setting-nav-item {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.setting-arrow {
  color: var(--text-muted);
  font-size: 20px;
}

.setting-item-vertical {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}

.setting-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.3;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.setting-input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  text-align: right;
}
.setting-input:focus {
  outline: none;
  border-color: var(--blue);
}

.setting-input-full {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
}
.setting-input-full:focus {
  outline: none;
  border-color: var(--blue);
}

.inline-select {
  max-width: 220px;
  width: auto;
}

.setting-unit {
  font-size: 13px;
  color: var(--text-dim);
  min-width: 20px;
}

.settings-group-footer {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 16px 0;
  line-height: 1.4;
}

.switch { position: relative; display: inline-block; width: 44px; height: 26px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: var(--border); border-radius: 26px; transition: 0.3s; }
.slider::before { content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: var(--surface-card); border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 3px var(--shadow-color); }
.switch input:checked + .slider { background: var(--green); }
.switch input:checked + .slider::before { transform: translateX(18px); }

.source-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.source-chip { display: inline-flex; align-items: center; gap: 4px; padding: 7px 12px; border-radius: 999px; font-size: 13px; cursor: pointer; background: var(--bg); border: 1px solid var(--border); transition: all 0.2s; }
.source-chip input { display: none; }
.source-chip.active { background: var(--blue); color: #fff; border-color: var(--blue); }
.setting-empty-hint { color: var(--text-muted); font-size: 12px; padding: 8px 0 2px; }

.about-value {
  word-break: break-all;
}

.version-info {
  text-align: center;
  padding: 24px 0 16px;
  font-size: 12px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .settings-page { max-width: 100%; }
  .setting-input { width: 100%; max-width: 160px; font-size: 16px; }
  .setting-input-full { font-size: 16px; }
  .setting-item { padding: 16px; flex-wrap: wrap; gap: 10px; }
  .setting-item .form-select,
  .inline-select { max-width: 100%; width: 100%; }
  .save-btn { min-height: 36px; padding: 8px 16px; }
}
</style>
