<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">💰 资产管理</h1>
      <router-link to="/assets/add" class="btn btn-primary">+ 添加资产</router-link>
    </div>

    <div class="card" v-if="assets.length">
      <!-- Desktop -->
      <table class="hide-mobile">
        <thead><tr><th>图标</th><th>名称</th><th>代码</th><th>类型</th><th>持仓量</th><th>成本价</th><th>总投入</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="a in assets" :key="a.id">
            <td style="font-size:20px">{{ a.icon || '💰' }}</td>
            <td>
              <router-link :to="`/assets/${a.id}`" style="font-weight:600">{{ a.name }}</router-link>
            </td>
            <td style="color:var(--text-dim)">{{ a.symbol }}</td>
            <td><span class="badge" :class="typeBadge(a.type)">{{ a.type }}</span></td>
            <td>{{ a.quantity ? a.quantity.toFixed(4) : '-' }}</td>
            <td>¥{{ fmt(a.avg_cost) }}</td>
            <td>¥{{ fmt(a.total_invested) }}</td>
            <td>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm" @click.prevent="openTx(a)">+ 交易</button>
                <router-link :to="`/assets/${a.id}`" class="btn btn-sm">详情</router-link>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile asset-cards">
        <router-link v-for="a in assets" :key="a.id" :to="`/assets/${a.id}`" class="asset-card">
          <div class="asset-card-top">
            <span style="font-size:20px">{{ a.icon || '💰' }}</span>
            <span class="badge" :class="typeBadge(a.type)">{{ a.type }}</span>
          </div>
          <div style="font-weight:600;margin:4px 0">{{ a.name }}</div>
          <div style="font-size:12px;color:var(--text-dim)">{{ a.symbol }}</div>
          <div class="asset-card-meta">
            <span v-if="a.quantity">{{ a.quantity.toFixed(4) }}</span>
            <span v-if="a.total_invested">¥{{ fmt(a.total_invested) }}</span>
          </div>
        </router-link>
      </div>
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">📭</div>
      <p>还没有资产，<router-link to="/assets/add">添加一个</router-link></p>
    </div>

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
import AppDrawer from '../components/AppDrawer.vue'
import TransactionForm from '../components/TransactionForm.vue'

const toast = useToast()
const assets = ref([])
const showTxDrawer = ref(false)
const txAsset = ref(null)

async function loadData() {
  const res = await api('/api/assets')
  const json = await res.json()
  assets.value = json.data || []
}

function openTx(a) {
  txAsset.value = a
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
.asset-card { display: block; border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-decoration: none; color: var(--text); transition: background 0.15s; }
.asset-card:active { background: var(--bg-hover); }
.asset-card-top { display: flex; justify-content: space-between; align-items: center; }
.asset-card-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text-muted); margin-top: 4px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
