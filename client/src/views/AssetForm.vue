<template>
  <div class="asset-form-page" :class="{ embedded }">
    <div v-if="!embedded" class="page-header">
      <h1 class="page-title">{{ t('assets.addTitle') }}</h1>
    </div>
    <div class="card asset-form-card">
      <form @submit.prevent="submit">
        <div class="section-title">{{ t('assets.sections.basic') }}</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('assets.nameLabel') }} *</label>
            <input class="form-input" v-model="form.name" :placeholder="t('assets.namePlaceholder')" required />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('assets.symbolLabel') }} *</label>
            <input class="form-input" v-model="form.symbol" :placeholder="t('assets.symbolPlaceholder')" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('assets.type') }} *</label>
            <select class="form-select" v-model="form.type" required>
              <option value="">{{ t('assets.selectType') }}</option>
              <option value="precious_metal">{{ t('assets.types.precious_metal') }}</option>
              <option value="crypto">{{ t('assets.types.crypto') }}</option>
              <option value="stock">{{ t('assets.types.stock') }}</option>
              <option value="forex">{{ t('assets.types.forex') }}</option>
              <option value="commodity">{{ t('assets.types.commodity') }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('assets.currency') }}</label>
            <select class="form-select" v-model="form.currency">
              <option value="CNY">{{ t('assets.currencyCny') }}</option>
              <option value="USD">{{ t('assets.currencyUsd') }}</option>
              <option v-if="form.type === 'crypto'" value="USDT">USDT</option>
            </select>
          </div>
        </div>

        <div class="section-title" style="margin-top:8px">{{ t('assets.sections.market') }}</div>
        <div v-if="form.type === 'crypto'" class="crypto-presets">
          <label class="form-label">{{ t('assets.cryptoPresets') }}</label>
          <div class="preset-grid">
            <button v-for="c in cryptoPresets" :key="c.symbol" type="button" class="preset-btn" :class="{ active: form.symbol === c.symbol }" @click="applyCryptoPreset(c)">
              <span class="preset-icon">{{ c.icon }}</span>
              <span class="preset-name">{{ c.name }}</span>
            </button>
          </div>
        </div>
        <div v-if="isPreciousMetal" class="crypto-presets">
          <label class="form-label">{{ t('assets.preciousMetalPresets') }}</label>
          <div class="preset-grid">
            <button v-for="m in preciousMetalPresets" :key="m.symbol" type="button" class="preset-btn" :class="{ active: form.symbol === m.symbol }" @click="applyPreciousMetalPreset(m)">
              <span class="preset-icon">{{ m.icon }}</span>
              <span class="preset-name">{{ m.name }}</span>
            </button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('assets.iconLabel') }}</label>
            <input class="form-input" v-model="form.icon" placeholder="🥇" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('assets.dataSourceLabel') }}</label>
            <select class="form-select" v-model="form.data_source">
              <option value="">{{ t('assets.autoSource') }}</option>
              <option value="neodata">{{ t('assets.sources.neodata') }}</option>
              <option value="coingecko">{{ t('assets.sources.coingecko') }}</option>
              <option value="swissquote">{{ t('assets.sources.swissquote') }}</option>
              <option value="manual">{{ t('assets.manualSource') }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('assets.subtypeLabel') }}</label>
            <input class="form-input" v-model="form.subtype" :placeholder="t('assets.subtypePlaceholder')" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('assets.unitLabel') }}</label>
            <select class="form-select" v-model="form.unit">
              <option value="coin">coin</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="oz">oz</option>
              <option value="share">share</option>
              <option value="unit">unit</option>
            </select>
          </div>
        </div>

        <div class="section-title" style="margin-top:16px">{{ t('assets.initialHolding') }}</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ t('holdings.quantity') }}</label>
            <input class="form-input" type="number" step="any" v-model="holding.quantity" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('holdings.avgCost') }}</label>
            <input class="form-input" type="number" step="any" v-model="holding.avg_cost" placeholder="0" />
          </div>
        </div>

        <MobileActionBar :drawer="embedded">
          <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? t('assets.creating') : t('assets.createAsset') }}</button>
          <button v-if="embedded" type="button" class="btn" @click="emit('cancel')">{{ t('common.cancel') }}</button>
          <router-link v-else to="/assets" class="btn">{{ t('common.cancel') }}</router-link>
        </MobileActionBar>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import MobileActionBar from '../components/MobileActionBar.vue'

const router = useRouter()
const props = defineProps({ embedded: { type: Boolean, default: false } })
const emit = defineEmits(['created', 'cancel'])
const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const form = reactive({ name: '', symbol: '', type: '', currency: 'CNY', icon: '', data_source: '', subtype: '', quote_currency: 'CNY', unit: 'unit', provider_symbols: '' })
const holding = reactive({ quantity: '', avg_cost: '' })
const isPreciousMetal = computed(() => form.type === 'gold' || form.type === 'precious_metal')

const cryptoPresets = [
  { name: 'Bitcoin', symbol: 'BTC', icon: '₿', subtype: 'bitcoin', coingeckoId: 'bitcoin' },
  { name: 'Ethereum', symbol: 'ETH', icon: '⟠', subtype: 'ethereum', coingeckoId: 'ethereum' },
  { name: 'BNB', symbol: 'BNB', icon: '🔶', subtype: 'bnb', coingeckoId: 'binancecoin' },
  { name: 'Solana', symbol: 'SOL', icon: '◎', subtype: 'solana', coingeckoId: 'solana' },
  { name: 'XRP', symbol: 'XRP', icon: '✕', subtype: 'xrp', coingeckoId: 'ripple' },
  { name: 'Cardano', symbol: 'ADA', icon: '◆', subtype: 'cardano', coingeckoId: 'cardano' },
  { name: 'Dogecoin', symbol: 'DOGE', icon: '🐕', subtype: 'dogecoin', coingeckoId: 'dogecoin' },
  { name: 'TRON', symbol: 'TRX', icon: '⚡', subtype: 'tron', coingeckoId: 'tron' },
  { name: 'Polkadot', symbol: 'DOT', icon: '●', subtype: 'polkadot', coingeckoId: 'polkadot' },
  { name: 'Avalanche', symbol: 'AVAX', icon: '🔺', subtype: 'avalanche', coingeckoId: 'avalanche-2' },
]

const preciousMetalPresets = [
  { name: '黄金 XAU/USD', symbol: 'XAUUSD', icon: '🥇', subtype: 'gold', currency: 'USD', unit: 'oz', dataSource: 'swissquote', providerSymbols: { swissquote: 'XAU/USD' } },
  { name: '白银 XAG/USD', symbol: 'XAGUSD', icon: '🥈', subtype: 'silver', currency: 'USD', unit: 'oz', dataSource: 'swissquote', providerSymbols: { swissquote: 'XAG/USD' } },
  { name: '铂金 XPT/USD', symbol: 'XPTUSD', icon: '⚪', subtype: 'platinum', currency: 'USD', unit: 'oz', dataSource: 'swissquote', providerSymbols: { swissquote: 'XPT/USD' } },
  { name: '钯金 XPD/USD', symbol: 'XPDUSD', icon: '⚙️', subtype: 'palladium', currency: 'USD', unit: 'oz', dataSource: 'swissquote', providerSymbols: { swissquote: 'XPD/USD' } },
]

function applyCryptoPreset(c) {
  form.name = c.name
  form.symbol = c.symbol
  form.icon = c.icon
  form.currency = 'USD'
  form.quote_currency = 'USD'
  form.subtype = c.subtype
  form.unit = 'coin'
  form.data_source = 'coingecko'
  form.provider_symbols = JSON.stringify({
    coingecko: c.coingeckoId,
    binance: `${c.symbol}USDT`,
    okx: `${c.symbol}-USDT`,
    coinbase: `${c.symbol}-USD`,
    kraken: c.symbol === 'BTC' ? 'XBTUSD' : `${c.symbol}USD`,
    bitstamp: `${c.symbol}USD`,
    gemini: `${c.symbol}USD`,
  })
}

function applyPreciousMetalPreset(m) {
  form.type = 'precious_metal'
  form.name = m.name
  form.symbol = m.symbol
  form.icon = m.icon
  form.currency = m.currency
  form.quote_currency = m.currency
  form.subtype = m.subtype
  form.unit = m.unit
  form.data_source = m.dataSource
  form.provider_symbols = JSON.stringify(m.providerSymbols)
}

watch(() => form.type, (type) => {
  if (type === 'crypto' && form.unit === 'unit') form.unit = 'coin'
  if ((type === 'gold' || type === 'precious_metal') && form.unit === 'unit') form.unit = form.currency === 'USD' ? 'oz' : 'g'
  if (type === 'stock' && form.unit === 'unit') form.unit = 'share'
})

watch(() => form.currency, (currency) => {
  form.quote_currency = currency
})

async function submit() {
  submitting.value = true
  try {
    // Create asset
    const res = await api('/api/assets', {
      method: 'POST',
      body: JSON.stringify(form)
    })
    const json = await res.json()
    if (!json.success) { toast.error(t('assets.createFailed', { message: json.error })); return }

    // Create holding if provided
    if (holding.quantity && holding.avg_cost) {
      const hRes = await api('/api/holdings', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: json.data.id,
          quantity: Number(holding.quantity),
          avg_cost: Number(holding.avg_cost),
        })
      })
      const hJson = await hRes.json()
      if (!hJson.success) { toast.error(t('assets.holdingInitFailed', { message: hJson.error })); }
    }
    toast.success(t('assets.createdSuccess'))
    if (props.embedded) {
      emit('created', json.data)
    } else {
      router.push('/assets')
    }
  } catch (e) {
    toast.error(t('assets.createFailed', { message: e.message }))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.asset-form-page {
  max-width: 600px;
}
.asset-form-page.embedded {
  max-width: none;
}
.asset-form-card {
  max-width: 600px;
}
.asset-form-page.embedded .asset-form-card {
  max-width: none;
  margin-bottom: 0;
  padding: 0;
  border: none;
  background: transparent;
}
.crypto-presets { margin-bottom: 16px; }
.preset-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px; }
.preset-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 4px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg); cursor: pointer; transition: all 0.15s;
}
.preset-btn:hover { border-color: var(--primary); background: rgba(59,130,246,0.04); }
.preset-btn.active { border-color: var(--primary); background: rgba(59,130,246,0.08); }
.preset-icon { font-size: 20px; }
.preset-name { font-size: 11px; color: var(--text-dim); }
@media (max-width: 768px) {
  .asset-form-card {
    margin-bottom: 120px;
  }
  .asset-form-page.embedded .asset-form-card {
    margin-bottom: 0;
  }
  .preset-grid { grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .preset-btn { padding: 8px 2px; }
  .preset-icon { font-size: 16px; }
  .preset-name { font-size: 10px; }
}
</style>
