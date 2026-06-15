<template>
  <PullRefreshView :onRefresh="loadData">
  <div>
    <div class="page-header">
      <h1 class="page-title">持仓管理</h1>
    </div>

    <div class="card" v-if="holdings.length">
      <!-- Desktop table -->
      <table class="hide-mobile">
        <thead><tr><th>资产</th><th>数量</th><th>成本价</th><th>总投入</th><th>现价</th><th>市值</th><th>盈亏</th><th>状态</th></tr></thead>
        <tbody>
          <tr v-for="h in holdings" :key="h.id" style="cursor:pointer" @click="openDetail(h)">
            <td><span class="icon-text"><span class="icon">{{ h.icon }}</span> {{ h.name }}</span> <span style="color:var(--text-dim);font-size:12px">{{ h.symbol }}</span></td>
            <td style="font-weight:600">{{ h.quantity }}</td>
            <td>{{ cs(h) }}{{ fmt(h.avg_cost) }}</td>
            <td>{{ cs(h) }}{{ fmt(h.total_invested) }}</td>
            <td>{{ h.current_price ? cs(h) + fmt(h.current_price) : '-' }}</td>
            <td>{{ h.current_price ? cs(h) + fmt(h.quantity * h.current_price) : '-' }}</td>
            <td :style="{ color: pnlColor(h), fontWeight: 600 }">{{ pnlText(h) }}</td>
            <td><span class="badge" :class="h.status === 'active' ? 'badge-buy' : 'badge-pending'">{{ h.status === 'active' ? '持仓中' : '已清仓' }}</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile cards -->
      <div class="show-mobile holding-cards">
        <div v-for="h in holdings" :key="h.id" class="holding-card" @click="openDetail(h)">
          <div class="holding-card-top">
            <span class="icon-text" style="font-weight:600"><span class="icon">{{ h.icon }}</span> {{ h.name }}</span>
            <span :style="{ color: pnlColor(h), fontWeight: 600, fontSize: '13px' }">{{ pnlText(h) }}</span>
          </div>
          <div class="holding-card-body">
            <div><span class="meta-label">数量</span> {{ h.quantity }}</div>
            <div><span class="meta-label">成本</span> {{ cs(h) }}{{ fmt(h.avg_cost) }}</div>
            <div><span class="meta-label">现价</span> {{ h.current_price ? cs(h) + fmt(h.current_price) : '-' }}</div>
            <div><span class="meta-label">市值</span> {{ h.current_price ? cs(h) + fmt(h.quantity * h.current_price) : '-' }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!loading" class="card empty">
      <div class="empty-icon">📦</div><p>暂无持仓</p>
    </div>
    <div v-else class="card">
      <div class="skeleton-card" style="margin-bottom:8px" v-for="i in 3" :key="i">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="skeleton" style="width:24px;height:24px;border-radius:50%"></div>
          <div class="skeleton skeleton-text" style="width:100px"></div>
          <div class="skeleton skeleton-text short" style="margin-left:auto"></div>
        </div>
      </div>
    </div>

    <!-- Detail Drawer -->
    <AppDrawer v-model="showDetail" :title="currentHolding?.name || '持仓详情'">
      <div v-if="currentHolding" class="info-list">
        <div class="info-row"><span class="info-label">资产</span><span class="icon-text"><span class="icon">{{ currentHolding.icon }}</span> {{ currentHolding.name }}</span></div>
        <div class="info-row"><span class="info-label">数量</span><span style="font-weight:600">{{ currentHolding.quantity }}</span></div>
        <div class="info-row"><span class="info-label">成本价</span><span>{{ cs(currentHolding) }}{{ fmt(currentHolding.avg_cost) }}</span></div>
        <div class="info-row"><span class="info-label">总投入</span><span>{{ cs(currentHolding) }}{{ fmt(currentHolding.total_invested) }}</span></div>
        <div class="info-row"><span class="info-label">现价</span><span>{{ currentHolding.current_price ? cs(currentHolding) + fmt(currentHolding.current_price) : '暂无' }}</span></div>
        <div class="info-row"><span class="info-label">市值</span><span>{{ currentHolding.current_price ? cs(currentHolding) + fmt(currentHolding.quantity * currentHolding.current_price) : '-' }}</span></div>
        <div class="info-row"><span class="info-label">盈亏</span><span :style="{ color: pnlColor(currentHolding), fontWeight: 600 }">{{ pnlText(currentHolding) }}</span></div>
        <div class="info-row"><span class="info-label">目标价</span><span>{{ currentHolding.target_price ? cs(currentHolding)+currentHolding.target_price : '-' }}</span></div>
        <div class="info-row"><span class="info-label">止损线</span><span style="color:var(--red)">{{ currentHolding.stop_loss ? cs(currentHolding)+currentHolding.stop_loss : '-' }}</span></div>
      </div>

      <div style="margin-top:20px">
        <div class="section-title">编辑</div>
        <form @submit.prevent="saveHolding">
          <div class="form-row">
            <div class="form-group"><label class="form-label">数量</label><input class="form-input" type="number" step="any" v-model="editHolding.quantity" /></div>
            <div class="form-group"><label class="form-label">成本价</label><input class="form-input" type="number" step="any" v-model="editHolding.avg_cost" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">总投入</label><input class="form-input" type="number" step="any" v-model="editHolding.total_invested" /></div>
            <div class="form-group">
              <label class="form-label">计价单位</label>
              <select class="form-select" v-model="editHolding.currency">
                <option value="CNY">人民币 (CNY)</option>
                <option value="USD">美元 (USD)</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>
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

  </div>
  </PullRefreshView>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import { currencySymbol } from '../utils/currency.js'
import AppDrawer from '../components/AppDrawer.vue'
import TransactionForm from '../components/TransactionForm.vue'
import PullRefreshView from '../components/PullRefreshView.vue'

const toast = useToast()
const holdings = ref([])
const loading = ref(true)
const showDetail = ref(false)
const currentHolding = ref(null)
const editHolding = reactive({ quantity: '', avg_cost: '', total_invested: '', currency: '', target_price: '', stop_loss: '' })
const savingHolding = ref(false)

watch([() => editHolding.quantity, () => editHolding.avg_cost], ([qty, cost]) => {
  if (qty && cost) {
    editHolding.total_invested = (Number(qty) * Number(cost)).toFixed(2)
  }
})

async function loadData() {
  try {
    const res = await api('/api/holdings')
    const json = await res.json()
    holdings.value = json.data || []
  } finally { loading.value = false }
}

function openDetail(h) {
  currentHolding.value = h
  editHolding.quantity = h.quantity || ''
  editHolding.avg_cost = h.avg_cost || ''
  editHolding.total_invested = h.total_invested || ''
  editHolding.currency = h.currency || 'CNY'
  editHolding.target_price = h.target_price || ''
  editHolding.stop_loss = h.stop_loss || ''
  showDetail.value = true
}

function onTxSuccess() {
  showDetail.value = false
  toast.success('交易已记录')
  loadData()
}

async function saveHolding() {
  savingHolding.value = true
  try {
    const payload = {
      quantity: editHolding.quantity ? Number(editHolding.quantity) : undefined,
      avg_cost: editHolding.avg_cost ? Number(editHolding.avg_cost) : undefined,
      total_invested: editHolding.total_invested ? Number(editHolding.total_invested) : undefined,
      target_price: editHolding.target_price ? Number(editHolding.target_price) : null,
      stop_loss: editHolding.stop_loss ? Number(editHolding.stop_loss) : null,
      currency: editHolding.currency || undefined,
    }
    const res = await api(`/api/holdings/${currentHolding.value.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    if (json.success) { toast.success('已保存'); loadData() }
    else toast.error(json.error || '保存失败')
  } catch (e) { toast.error(e.message) }
  savingHolding.value = false
}

function cs(h) { return currencySymbol(h?.currency) }
function fmt(n) {
  if (!n && n !== 0) return '0'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}
function pnl(h) {
  if (!h.current_price || !h.total_invested) return null
  return h.quantity * h.current_price - h.total_invested
}
function pnlPct(h) {
  if (!h.current_price || !h.total_invested) return null
  return ((h.quantity * h.current_price - h.total_invested) / h.total_invested) * 100
}
function pnlColor(h) {
  const v = pnl(h)
  if (v === null) return 'var(--text-dim)'
  return v >= 0 ? 'var(--green)' : 'var(--red)'
}
function pnlText(h) {
  const v = pnl(h)
  if (v === null) return '-'
  const pct = pnlPct(h)
  const sign = v >= 0 ? '+' : ''
  return `${sign}${fmt(v)} (${sign}${pct.toFixed(1)}%)`
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
