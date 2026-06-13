<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">📦 持仓管理</h1>
    </div>

    <div class="card" v-if="holdings.length">
      <!-- Desktop table -->
      <table class="hide-mobile">
        <thead><tr><th>资产</th><th>数量</th><th>成本价</th><th>总投入</th><th>目标价</th><th>止损</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="h in holdings" :key="h.id" style="cursor:pointer" @click="openDetail(h)">
            <td>{{ h.icon }} {{ h.name }} <span style="color:var(--text-dim);font-size:12px">{{ h.symbol }}</span></td>
            <td style="font-weight:600">{{ h.quantity }}</td>
            <td>¥{{ fmt(h.avg_cost) }}</td>
            <td>¥{{ fmt(h.total_invested) }}</td>
            <td>{{ h.target_price ? '¥'+h.target_price : '-' }}</td>
            <td style="color:var(--red)">{{ h.stop_loss ? '¥'+h.stop_loss : '-' }}</td>
            <td><span class="badge" :class="h.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ h.status === 'active' ? '持仓中' : '已清仓' }}</span></td>
            <td @click.stop>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm" @click="openDetail(h)">详情</button>
                <button class="btn btn-sm" @click="openTx(h)">+ 交易</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile holding-cards">
        <div v-for="h in holdings" :key="h.id" class="holding-card" @click="openDetail(h)">
          <div class="holding-card-top">
            <span style="font-weight:600">{{ h.icon }} {{ h.name }}</span>
            <span class="badge" :class="h.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ h.status === 'active' ? '持仓中' : '已清仓' }}</span>
          </div>
          <div class="holding-card-body">
            <div><span class="meta-label">数量</span> {{ h.quantity }}</div>
            <div><span class="meta-label">成本</span> ¥{{ fmt(h.avg_cost) }}</div>
            <div><span class="meta-label">投入</span> ¥{{ fmt(h.total_invested) }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="card empty">
      <div class="empty-icon">📦</div><p>暂无持仓</p>
    </div>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetail" :title="currentHolding?.name || '持仓详情'">
      <div v-if="currentHolding" class="info-list">
        <div class="info-row"><span class="info-label">资产</span><span>{{ currentHolding.icon }} {{ currentHolding.name }}</span></div>
        <div class="info-row"><span class="info-label">数量</span><span style="font-weight:600">{{ currentHolding.quantity }}</span></div>
        <div class="info-row"><span class="info-label">成本价</span><span>¥{{ fmt(currentHolding.avg_cost) }}</span></div>
        <div class="info-row"><span class="info-label">总投入</span><span>¥{{ fmt(currentHolding.total_invested) }}</span></div>
        <div class="info-row"><span class="info-label">目标价</span><span>{{ currentHolding.target_price ? '¥'+currentHolding.target_price : '-' }}</span></div>
        <div class="info-row"><span class="info-label">止损线</span><span style="color:var(--red)">{{ currentHolding.stop_loss ? '¥'+currentHolding.stop_loss : '-' }}</span></div>
      </div>

      <div style="margin-top:20px">
        <div class="section-title">✏️ 编辑</div>
        <form @submit.prevent="saveHolding">
          <div class="form-row">
            <div class="form-group"><label class="form-label">目标价</label><input class="form-input" type="number" step="any" v-model="editHolding.target_price" /></div>
            <div class="form-group"><label class="form-label">止损线</label><input class="form-input" type="number" step="any" v-model="editHolding.stop_loss" /></div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm" :disabled="savingHolding">保存</button>
        </form>
      </div>

      <div style="margin-top:20px">
        <div class="section-title">+ 快速记录交易</div>
        <TransactionForm v-if="currentHolding" :asset-id="currentHolding.asset_id" @success="onTxSuccess" @cancel="showDetail = false" />
      </div>
    </AppDrawer>

    <!-- Transaction Drawer (from list button) -->
    <AppDrawer v-model="showTxDrawer" title="记录交易">
      <TransactionForm v-if="txAssetId" :asset-id="txAssetId" @success="onTxSuccess" @cancel="showTxDrawer = false" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import AppDrawer from '../components/AppDrawer.vue'
import TransactionForm from '../components/TransactionForm.vue'

const toast = useToast()
const holdings = ref([])
const showDetail = ref(false)
const showTxDrawer = ref(false)
const currentHolding = ref(null)
const txAssetId = ref(null)
const editHolding = reactive({ target_price: '', stop_loss: '' })
const savingHolding = ref(false)

async function loadData() {
  const res = await api('/api/holdings')
  const json = await res.json()
  holdings.value = json.data || []
}

function openDetail(h) {
  currentHolding.value = h
  editHolding.target_price = h.target_price || ''
  editHolding.stop_loss = h.stop_loss || ''
  showDetail.value = true
}

function openTx(h) {
  txAssetId.value = h.asset_id
  showTxDrawer.value = true
}

async function saveHolding() {
  savingHolding.value = true
  try {
    const res = await api(`/api/holdings/${currentHolding.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ target_price: editHolding.target_price ? Number(editHolding.target_price) : null, stop_loss: editHolding.stop_loss ? Number(editHolding.stop_loss) : null })
    })
    const json = await res.json()
    if (json.success) { toast.success('已保存'); loadData() }
    else toast.error(json.error || '保存失败')
  } catch (e) { toast.error(e.message) }
  savingHolding.value = false
}

function onTxSuccess() {
  showTxDrawer.value = false
  showDetail.value = false
  toast.success('交易已记录')
  loadData()
}

function fmt(n) {
  if (!n && n !== 0) return '0'
  return Math.round(n).toLocaleString()
}
onMounted(loadData)
</script>

<style scoped>
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }

.hide-mobile { display: table; }
.show-mobile { display: none !important; }

.holding-cards { flex-direction: column; gap: 8px; }
.holding-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; cursor: pointer; transition: background 0.15s; }
.holding-card:active { background: var(--bg-hover); }
.holding-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.holding-card-body { display: flex; gap: 16px; font-size: 13px; flex-wrap: wrap; }
.meta-label { color: var(--text-muted); font-size: 11px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
}
</style>
