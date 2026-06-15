<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">资产管理</h1>
      <router-link to="/assets/add" class="btn btn-primary">+ 添加资产</router-link>
    </div>

    <div class="card" v-if="assets.length">
      <!-- Desktop -->
      <table class="hide-mobile">
        <thead><tr><th>图标</th><th>名称</th><th>代码</th><th>类型</th><th>持仓量</th><th>成本价</th><th>总投入</th></tr></thead>
        <tbody>
          <tr v-for="a in assets" :key="a.id" style="cursor:pointer" @click="openDetail(a)">
            <td style="font-size:20px">{{ a.icon || '💰' }}</td>
            <td style="font-weight:600">{{ a.name }}</td>
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
            <span style="font-size:20px">{{ a.icon || '💰' }}</span>
            <span class="badge" :class="typeBadge(a.type)">{{ a.type }}</span>
          </div>
          <div style="font-weight:600;margin:4px 0">{{ a.name }}</div>
          <div style="font-size:12px;color:var(--text-dim)">{{ a.symbol }}</div>
          <div class="asset-card-meta">
            <span v-if="a.quantity">{{ a.quantity.toFixed(4) }}</span>
            <span v-if="a.total_invested">{{ cs(a) }}{{ fmt(a.total_invested) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!loading" class="card empty">
      <div class="empty-icon">📭</div>
      <p>还没有资产，<router-link to="/assets/add">添加一个</router-link></p>
    </div>
    <div v-else class="card empty"><span class="spinner"></span></div>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetailDrawer" :title="detailAsset ? `${detailAsset.icon || '💰'} ${detailAsset.name}` : '资产详情'">
      <div v-if="detailAsset" class="detail-drawer-content">
        <div class="detail-section">
          <div class="detail-row"><span>代码</span><span style="color:var(--text-dim)">{{ detailAsset.symbol }}</span></div>
          <div class="detail-row"><span>类型</span><span class="badge" :class="typeBadge(detailAsset.type)">{{ detailAsset.type }}</span></div>
          <div class="detail-row"><span>计价货币</span><span>{{ detailAsset.currency || 'CNY' }}</span></div>
        </div>

        <div v-if="detailAsset.quantity" class="detail-section">
          <div class="detail-section-title">持仓信息</div>
          <div class="detail-row"><span>数量</span><b>{{ detailAsset.quantity?.toFixed(4) }}</b></div>
          <div class="detail-row"><span>成本价</span><span>{{ cs(detailAsset) }}{{ fmt(detailAsset.avg_cost) }}</span></div>
          <div class="detail-row"><span>总投入</span><span>{{ cs(detailAsset) }}{{ fmt(detailAsset.total_invested) }}</span></div>
        </div>

        <div class="detail-actions">
          <button class="btn btn-primary" style="flex:1" @click="detailOpenTx">+ 记录交易</button>
          <router-link :to="`/assets/${detailAsset.id}`" class="btn" style="flex:1;text-align:center" @click="showDetailDrawer = false">查看详情页</router-link>
        </div>
      </div>
    </AppDrawer>

    <!-- Transaction Drawer -->
    <AppDrawer v-model="showTxDrawer" :title="`记录交易 - ${txAsset?.name || ''}`">
      <TransactionForm v-if="txAsset" :asset-id="txAsset.id" @success="onTxSuccess" @cancel="showTxDrawer = false" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { currencySymbol } from '../utils/currency.js'
import AppDrawer from '../components/AppDrawer.vue'
import TransactionForm from '../components/TransactionForm.vue'

const toast = useToast()
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
  toast.success('交易已记录')
  loadData()
}

function typeBadge(type) {
  return { gold: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
}
function cs(a) { return currencySymbol(a?.currency) }
function fmt(n) {
  if (!n && n !== 0) return '-'
  return Math.round(n).toLocaleString()
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
