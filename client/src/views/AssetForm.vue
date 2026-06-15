<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">添加资产</h1>
    </div>
    <div class="card" style="max-width:600px">
      <form @submit.prevent="submit">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">资产名称 *</label>
            <input class="form-input" v-model="form.name" placeholder="例如：黄金Au99.99" required />
          </div>
          <div class="form-group">
            <label class="form-label">代码 *</label>
            <input class="form-input" v-model="form.symbol" placeholder="例如：AU9999" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">类型 *</label>
            <select class="form-select" v-model="form.type" required>
              <option value="">选择类型</option>
              <option value="gold">黄金</option>
              <option value="crypto">加密货币</option>
              <option value="stock">股票</option>
              <option value="forex">外汇</option>
              <option value="commodity">大宗商品</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">计价货币</label>
            <select class="form-select" v-model="form.currency">
              <option value="CNY">人民币 (CNY)</option>
              <option value="USD">美元 (USD)</option>
              <option v-if="form.type === 'crypto'" value="USDT">USDT</option>
            </select>
          </div>
        </div>

        <!-- 加密货币快速选择 -->
        <div v-if="form.type === 'crypto'" class="crypto-presets">
          <label class="form-label">快速选择主流币种</label>
          <div class="preset-grid">
            <button v-for="c in cryptoPresets" :key="c.symbol" type="button" class="preset-btn" :class="{ active: form.symbol === c.symbol }" @click="applyCryptoPreset(c)">
              <span class="preset-icon">{{ c.icon }}</span>
              <span class="preset-name">{{ c.name }}</span>
            </button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">图标 (emoji)</label>
            <input class="form-input" v-model="form.icon" placeholder="🥇" />
          </div>
          <div class="form-group">
            <label class="form-label">数据源</label>
            <select class="form-select" v-model="form.data_source">
              <option value="">自动</option>
              <option value="neodata">neodata (黄金)</option>
              <option value="coingecko">CoinGecko (加密货币)</option>
              <option value="manual">手动</option>
            </select>
          </div>
        </div>

        <!-- 初始持仓 -->
        <div class="section-title" style="margin-top:16px">📦 初始持仓 (可选)</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">持仓数量</label>
            <input class="form-input" type="number" step="any" v-model="holding.quantity" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">成本价</label>
            <input class="form-input" type="number" step="any" v-model="holding.avg_cost" placeholder="0" />
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-top:8px">
          <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? '创建中...' : '创建资产' }}</button>
          <router-link to="/assets" class="btn">取消</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../utils/api.js'

const router = useRouter()
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
    if (!json.success) { alert('创建失败: ' + json.error); return }

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
      if (!hJson.success) { alert('资产已创建，但持仓初始化失败: ' + hJson.error); }
    }
    router.push('/assets')
  } catch (e) {
    alert('创建失败: ' + e.message)
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
