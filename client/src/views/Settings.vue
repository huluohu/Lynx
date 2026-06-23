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
          <div class="setting-item setting-item-vertical setting-item-preference">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.appearance.theme') }}</span>
              <span class="setting-desc">{{ t('settings.appearance.themeDesc') }}</span>
            </div>
            <div class="preference-choice-grid theme-choice-grid" role="radiogroup" :aria-label="t('settings.appearance.theme')">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                type="button"
                class="preference-choice theme-choice"
                :class="{ active: form.theme === option.value }"
                role="radio"
                :aria-checked="form.theme === option.value ? 'true' : 'false'"
                @click="setAppearanceValue('theme', option.value)"
              >
                <span class="settings-theme-preview" :class="`settings-theme-preview--${option.value}`" aria-hidden="true">
                  <span class="settings-theme-preview-pane settings-theme-preview-pane-sidebar"></span>
                  <span class="settings-theme-preview-pane settings-theme-preview-pane-header"></span>
                  <span class="settings-theme-preview-pane settings-theme-preview-pane-body"></span>
                </span>
                <span class="preference-choice-meta">
                  <span class="preference-choice-label">{{ option.label }}</span>
                  <span class="preference-choice-check">{{ form.theme === option.value ? '✓' : '' }}</span>
                </span>
              </button>
            </div>
          </div>
          <div class="setting-item setting-item-vertical setting-item-preference">
            <div class="setting-info">
              <span class="setting-label">{{ t('settings.appearance.language') }}</span>
              <span class="setting-desc">{{ t('settings.appearance.languageDesc') }}</span>
            </div>
            <div class="preference-choice-grid language-choice-grid" role="radiogroup" :aria-label="t('settings.appearance.language')">
              <button
                v-for="option in languageOptions"
                :key="option.value"
                type="button"
                class="preference-choice language-choice"
                :class="{ active: form.language === option.value }"
                role="radio"
                :aria-checked="form.language === option.value ? 'true' : 'false'"
                @click="setAppearanceValue('language', option.value)"
              >
                <span class="language-choice-flag" aria-hidden="true">{{ option.flag }}</span>
                <span class="preference-choice-meta">
                  <span class="preference-choice-label">{{ option.label }}</span>
                  <span class="preference-choice-check">{{ form.language === option.value ? '✓' : '' }}</span>
                </span>
              </button>
            </div>
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
              <span class="setting-label">{{ t('settings.market.signalRefreshInterval') }}</span>
              <span class="setting-desc">{{ t('settings.market.signalRefreshIntervalDesc') }}</span>
            </div>
            <div class="setting-control">
              <input class="setting-input" type="number" inputmode="numeric" min="0" v-model="form.market_signal_refresh_interval" @input="dirty.market = true" />
              <span class="setting-unit">{{ t('common.minuteUnit') }}</span>
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
  market_crypto_sources_enabled: 'stablecoin_peg,coingecko,binance,coinbase,kraken,okx,bitstamp,gemini,kucoin,gateio,bitget,mexc,defillama',
  market_precious_metal_sources_enabled: 'sge_sina,neodata,swissquote,yahoo_metals',
  market_btc_sources_enabled: 'stablecoin_peg,coingecko,binance,coinbase,kraken,okx,bitstamp,gemini,kucoin,gateio,bitget,mexc,defillama',
  market_gold_sources_enabled: 'sge_sina,neodata,swissquote,yahoo_metals',
  news_sources_available: '',
  rate_cache_duration: '60',
  strategy_monitor_interval: '5',
  signal_valid_hours: '24',
  market_signal_refresh_interval: '30',
  news_refresh_interval: '30',
  news_sources_enabled: 'coindesk,cointelegraph,decrypt,panews,coingecko,kitco,fxstreet,bbc_business,bbc_world,cnbc_economy,cnbc_world,china_daily_business,china_daily_china,china_daily_world',
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
  { key: 'bbc_business', label: t('settings.news.builtinSourceLabels.bbc_business') },
  { key: 'bbc_world', label: t('settings.news.builtinSourceLabels.bbc_world') },
  { key: 'cnbc_economy', label: t('settings.news.builtinSourceLabels.cnbc_economy') },
  { key: 'cnbc_world', label: t('settings.news.builtinSourceLabels.cnbc_world') },
  { key: 'china_daily_business', label: t('settings.news.builtinSourceLabels.china_daily_business') },
  { key: 'china_daily_china', label: t('settings.news.builtinSourceLabels.china_daily_china') },
  { key: 'china_daily_world', label: t('settings.news.builtinSourceLabels.china_daily_world') },
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
  { key: 'kucoin', label: t('settings.market.sourceLabels.kucoin') },
  { key: 'gateio', label: t('settings.market.sourceLabels.gateio') },
  { key: 'bitget', label: t('settings.market.sourceLabels.bitget') },
  { key: 'mexc', label: t('settings.market.sourceLabels.mexc') },
  { key: 'defillama', label: t('settings.market.sourceLabels.defillama') },
])

const goldMarketSources = computed(() => [
  { key: 'sge_sina', label: t('settings.market.sourceLabels.sge_sina') },
  { key: 'neodata', label: t('settings.market.sourceLabels.neodata') },
  { key: 'swissquote', label: t('settings.market.sourceLabels.swissquote') },
  { key: 'yahoo_metals', label: t('settings.market.sourceLabels.yahoo_metals') },
])

const enabledNewsSourceOptions = computed(() => {
  const available = new Set(csvToArray(form.news_sources_available, builtinNewsSources.value.map(source => source.key)))
  return builtinNewsSources.value.filter(source => available.has(source.key))
})

const enabledBtcSourceOptions = computed(() => enabledMarketSourceOptions('crypto', btcMarketSources.value))
const enabledGoldSourceOptions = computed(() => enabledMarketSourceOptions('precious_metal', goldMarketSources.value))
const languageFlagMap = { 'zh-CN': '🇨🇳', 'en-US': '🇺🇸' }
const themeOptions = computed(() => preferencesStore.supportedThemes.map((value) => ({
  value,
  label: t(`preferences.themes.${value}`),
})))
const languageOptions = computed(() => preferencesStore.supportedLanguages.map((value) => ({
  value,
  flag: languageFlagMap[value] || '🌐',
  label: t(`preferences.languages.${value}`),
})))

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
  market: ['refresh_interval', 'market_refresh_interval', 'market_crypto_sources_enabled', 'market_precious_metal_sources_enabled', 'market_btc_sources_enabled', 'market_gold_sources_enabled', 'rate_cache_duration', 'strategy_monitor_interval', 'signal_valid_hours', 'market_signal_refresh_interval', 'price_alert_threshold', 'plan_approaching_pct'],
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

function setAppearanceValue(key, value) {
  if (!(key in form) || form[key] === value) return
  form[key] = value
  dirty.appearance = true
  if (key === 'theme') preferencesStore.setTheme(value).catch(() => {})
  if (key === 'language') preferencesStore.setLanguage(value).catch(() => {})
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

.setting-item-preference {
  gap: 12px;
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

.preference-choice-grid {
  display: grid;
  gap: 10px;
}
.theme-choice-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.language-choice-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.preference-choice {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, white 6%), var(--bg-card));
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.preference-choice:hover {
  border-color: color-mix(in srgb, var(--blue) 34%, var(--border));
  background: color-mix(in srgb, var(--blue) 7%, var(--bg-card));
}
.preference-choice:active {
  transform: scale(0.985);
}
.preference-choice.active {
  border-color: color-mix(in srgb, var(--blue) 58%, var(--border));
  background: color-mix(in srgb, var(--blue) 13%, var(--bg-card));
  box-shadow: 0 12px 26px color-mix(in srgb, var(--blue) 11%, transparent);
}
.preference-choice-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.preference-choice-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 650;
}
.preference-choice-check {
  width: 16px;
  color: var(--blue);
  font-size: 13px;
  font-weight: 700;
  text-align: right;
}
.settings-theme-preview {
  display: grid;
  grid-template-columns: 0.9fr 1.2fr;
  grid-template-rows: 0.8fr 1.2fr;
  gap: 2px;
  width: 34px;
  height: 26px;
  flex-shrink: 0;
  padding: 3px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 86%, transparent);
}
.settings-theme-preview-pane {
  display: block;
  border-radius: 4px;
}
.settings-theme-preview-pane-sidebar {
  grid-row: 1 / span 2;
}
.settings-theme-preview-pane-header,
.settings-theme-preview-pane-body {
  grid-column: 2;
}
.settings-theme-preview--dark .settings-theme-preview-pane-sidebar { background: #0f172a; }
.settings-theme-preview--dark .settings-theme-preview-pane-header { background: #1e293b; }
.settings-theme-preview--dark .settings-theme-preview-pane-body { background: #111827; }
.settings-theme-preview--light .settings-theme-preview-pane-sidebar { background: #e2e8f0; }
.settings-theme-preview--light .settings-theme-preview-pane-header { background: #fff; }
.settings-theme-preview--light .settings-theme-preview-pane-body { background: #f8fafc; }
.settings-theme-preview--transparent .settings-theme-preview-pane-sidebar { background: linear-gradient(180deg, rgba(59, 130, 246, 0.48), rgba(15, 23, 42, 0.56)); }
.settings-theme-preview--transparent .settings-theme-preview-pane-header { background: rgba(255, 255, 255, 0.52); }
.settings-theme-preview--transparent .settings-theme-preview-pane-body { background: rgba(15, 23, 42, 0.2); }
.settings-theme-preview--purple .settings-theme-preview-pane-sidebar { background: #4c1d95; }
.settings-theme-preview--purple .settings-theme-preview-pane-header { background: #6d28d9; }
.settings-theme-preview--purple .settings-theme-preview-pane-body { background: #2e1065; }
.language-choice-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-hover) 78%, transparent);
  font-size: 21px;
  line-height: 1;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 78%, transparent);
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
  .theme-choice-grid,
  .language-choice-grid { grid-template-columns: 1fr 1fr; }
  .preference-choice { min-height: 56px; padding: 10px; }
  .save-btn { min-height: 36px; padding: 8px 16px; }
}

@media (max-width: 480px) {
  .theme-choice-grid,
  .language-choice-grid { grid-template-columns: 1fr; }
}
</style>
