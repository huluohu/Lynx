<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ t('assetList.title') }}</h1>
      <router-link to="/assets/add" class="btn btn-primary">+ {{ t('assetList.addAsset') }}</router-link>
    </div>

    <div class="card" v-if="assets.length">
      <!-- Desktop -->
      <table class="hide-mobile">
        <thead><tr><th>{{ t('assetList.name') }}</th><th>{{ t('assetList.symbol') }}</th><th>{{ t('assetList.type') }}</th><th>{{ t('assetList.quantity') }}</th><th>{{ t('assetList.avgCost') }}</th><th>{{ t('assetList.totalInvested') }}</th></tr></thead>
        <tbody>
          <tr v-for="a in assets" :key="a.id" style="cursor:pointer" @click="openDetail(a)">
            <td><span class="icon-text" style="font-weight:600"><span>{{ a.icon || '💰' }}</span><span>{{ a.name }}</span></span></td>
            <td style="color:var(--text-dim)">{{ a.symbol }}</td>
            <td><span class="badge" :class="typeBadge(a.type)">{{ a.type }}</span></td>
            <td>{{ a.quantity ? a.quantity.toFixed(4) : '-' }}</td>
            <td>{{ cs(a) }}{{ fmt(a.avg_cost) }}</td>
            <td>{{ cs(a) }}{{ fmt(a.total_invested) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile asset-cards">
        <div v-for="a in assets" :key="a.id" class="asset-card" @click="openDetail(a)">
          <div class="asset-card-top">
            <span class="icon-text" style="font-size:16px;font-weight:600"><span>{{ a.icon || '💰' }}</span><span>{{ a.name }}</span></span>
            <span class="badge" :class="typeBadge(a.type)">{{ a.type }}</span>
          </div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px">{{ a.symbol }}</div>
          <div class="asset-card-meta">
            <span v-if="a.quantity">{{ a.quantity.toFixed(4) }}</span>
            <span v-if="a.total_invested">{{ cs(a) }}{{ fmt(a.total_invested) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!loading" class="card empty">
      <div class="empty-icon">📭</div>
      <p>{{ t('assetList.empty') }}，<router-link to="/assets/add">{{ t('assetList.addOne') }}</router-link></p>
    </div>
    <div v-else class="card">
      <div class="skeleton-card" style="margin-bottom:8px" v-for="i in 3" :key="i">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="skeleton" style="width:24px;height:24px;border-radius:50%"></div>
          <div class="skeleton skeleton-text" style="width:100px"></div>
          <div class="skeleton skeleton-badge" style="margin-left:auto"></div>
        </div>
      </div>
    </div>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetailDrawer" :title="detailAsset ? `${detailAsset.icon || '💰'} ${detailAsset.name}` : t('assetList.assetDetails')">
      <div v-if="detailAsset" class="detail-drawer-content">
        <div class="detail-section">
          <div class="detail-row"><span>{{ t('assetList.symbol') }}</span><span style="color:var(--text-dim)">{{ detailAsset.symbol }}</span></div>
          <div class="detail-row"><span>{{ t('assetList.type') }}</span><span class="badge" :class="typeBadge(detailAsset.type)">{{ assetTypeLabel(detailAsset.type) }}</span></div>
          <div class="detail-row"><span>{{ t('assetList.currency') }}</span><span>{{ detailAsset.currency || 'CNY' }}</span></div>
        </div>

        <div v-if="detailAsset.quantity" class="detail-section">
          <div class="detail-section-title">{{ t('assetList.holdingInfo') }}</div>
          <div class="detail-row"><span>{{ t('assetList.quantity') }}</span><b>{{ detailAsset.quantity?.toFixed(4) }}</b></div>
          <div class="detail-row"><span>{{ t('assetList.avgCost') }}</span><span>{{ cs(detailAsset) }}{{ fmt(detailAsset.avg_cost) }}</span></div>
          <div class="detail-row"><span>{{ t('assetList.totalInvested') }}</span><span>{{ cs(detailAsset) }}{{ fmt(detailAsset.total_invested) }}</span></div>
        </div>

        <div class="detail-actions">
          <button class="btn btn-primary" style="flex:1" @click="detailOpenTx">+ {{ t('assetList.recordTrade') }}</button>
          <router-link :to="`/assets/${detailAsset.id}`" class="btn" style="flex:1;text-align:center" @click="showDetailDrawer = false">{{ t('assetList.viewDetailPage') }}</router-link>
        </div>
      </div>
    </AppDrawer>

    <!-- Transaction Drawer -->
    <AppDrawer v-model="showTxDrawer" :title="`${t('assetList.recordTrade')} - ${txAsset?.name || ''}`">
      <TransactionForm v-if="txAsset" :asset-id="txAsset.id" @success="onTxSuccess" @cancel="showTxDrawer = false" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { currencySymbol } from '../utils/currency.js'
import { formatNumber } from '../utils/formatters.js'
import AppDrawer from '../components/AppDrawer.vue'
import TransactionForm from '../components/TransactionForm.vue'

const toast = useToast()
const { t } = useI18n()
const assets = ref([])
const loading = ref(true)
const showTxDrawer = ref(false)
const txAsset = ref(null)
const showDetailDrawer = ref(false)
const detailAsset = ref(null)

async function loadData() {
  try {
    const res = await api('/api/assets')
    const json = await res.json()
    assets.value = json.data || []
  } finally { loading.value = false }
}

function openDetail(a) {
  detailAsset.value = a
  showDetailDrawer.value = true
}

function detailOpenTx() {
  txAsset.value = detailAsset.value
  showDetailDrawer.value = false
  showTxDrawer.value = true
}

function onTxSuccess() {
  showTxDrawer.value = false
  toast.success(t('assetList.tradeRecorded'))
  loadData()
}

function typeBadge(type) {
  return { gold: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
}
function assetTypeLabel(type) {
  return t(`assetList.types.${type}`)
}
function cs(a) { return currencySymbol(a?.currency) }
function fmt(n) {
  return formatNumber(Math.round(Number(n || 0)), { maximumFractionDigits: 0 })
}

onMounted(loadData)
</script>

<style scoped>
.hide-mobile { display: table; }
.show-mobile { display: none !important; }

.asset-cards { flex-direction: column; gap: 8px; }
.asset-card { display: block; border: 1px solid var(--border); border-radius: 8px; padding: 12px; cursor: pointer; color: var(--text); transition: background 0.15s; }
.asset-card:hover { background: var(--bg-hover); }
.asset-card:active { background: var(--bg-hover); }
.asset-card-top { display: flex; justify-content: space-between; align-items: center; }
.asset-card-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.detail-drawer-content { display: flex; flex-direction: column; gap: 16px; }
.detail-section { background: var(--bg); border-radius: 10px; padding: 4px 0; }
.detail-section-title { font-size: 12px; font-weight: 600; color: var(--text-dim); padding: 8px 14px 4px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; font-size: 14px; }
.detail-actions { display: flex; gap: 10px; margin-top: 8px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
