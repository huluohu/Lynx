<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('assets.addTitle') }}</h1>
    </div>
    <div class="card" style="max-width:600px">
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
              <option value="gold">{{ t('assets.types.gold') }}</option>
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
              <option value="manual">{{ t('assets.manualSource') }}</option>
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

        <div style="display:flex;gap:12px;margin-top:8px">
          <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? t('assets.creating') : t('assets.createAsset') }}</button>
          <router-link to="/assets" class="btn">{{ t('common.cancel') }}</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'

const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const submitting = ref(false)
const form = reactive({ name: '', symbol: '', type: '', currency: 'CNY', icon: '', data_source: '' })
const holding = reactive({ quantity: '', avg_cost: '' })

const cryptoPresets = [
  { name: 'Bitcoin', symbol: 'BTC', icon: '₿', coingeckoId: 'bitcoin' },
  { name: 'Ethereum', symbol: 'ETH', icon: '⟠', coingeckoId: 'ethereum' },
  { name: 'BNB', symbol: 'BNB', icon: '🔶', coingeckoId: 'binancecoin' },
  { name: 'Solana', symbol: 'SOL', icon: '◎', coingeckoId: 'solana' },
  { name: 'XRP', symbol: 'XRP', icon: '✕', coingeckoId: 'ripple' },
  { name: 'Cardano', symbol: 'ADA', icon: '◆', coingeckoId: 'cardano' },
  { name: 'Dogecoin', symbol: 'DOGE', icon: '🐕', coingeckoId: 'dogecoin' },
  { name: 'TRON', symbol: 'TRX', icon: '⚡', coingeckoId: 'tron' },
  { name: 'Polkadot', symbol: 'DOT', icon: '●', coingeckoId: 'polkadot' },
  { name: 'Avalanche', symbol: 'AVAX', icon: '🔺', coingeckoId: 'avalanche-2' },
]

function applyCryptoPreset(c) {
  form.name = c.name
  form.symbol = c.symbol
  form.icon = c.icon
  form.currency = 'USD'
  form.data_source = 'coingecko'
}

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
    router.push('/assets')
  } catch (e) {
    toast.error(t('assets.createFailed', { message: e.message }))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
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
  .preset-grid { grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .preset-btn { padding: 8px 2px; }
  .preset-icon { font-size: 16px; }
  .preset-name { font-size: 10px; }
}
</style>
