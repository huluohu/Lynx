<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ asset.icon }} {{ asset.name }}</h1>
      <div class="page-actions hide-on-mobile">
        <button class="btn btn-primary" @click="showTxDrawer = true">+ {{ t('assetDetail.recordTrade') }}</button>
        <button class="btn" @click="showAIDrawer = true">{{ t('assetDetail.aiAdvice') }}</button>
        <button class="btn" @click="showEditDrawer = true">{{ t('assetDetail.edit') }}</button>
        <button class="btn btn-danger" @click="confirmDelete">{{ t('assetDetail.delete') }}</button>
      </div>
      <button class="btn btn-icon show-on-mobile" @click="showActions = !showActions">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>

    <!-- Mobile action sheet -->
    <div v-if="showActions" class="action-sheet-overlay" @click="showActions = false"></div>
    <transition name="slide-up">
      <div v-if="showActions" class="action-sheet">
        <div class="action-sheet-item" @click="showTxDrawer = true; showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {{ t('assetDetail.recordTrade') }}
        </div>
        <div class="action-sheet-item" @click="showAIDrawer = true; showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
          {{ t('assetDetail.aiAdviceTitle') }}
        </div>
        <div class="action-sheet-item" @click="showEditDrawer = true; showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          {{ t('assetDetail.editAsset') }}
        </div>
        <div class="action-sheet-item danger" @click="confirmDelete(); showActions = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          {{ t('assetDetail.deleteAsset') }}
        </div>
        <div class="action-sheet-cancel" @click="showActions = false">{{ t('common.cancel') }}</div>
      </div>
    </transition>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="section-title">{{ t('assetDetail.basicInfo') }}</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">{{ t('assets.fields.symbol') }}</span><span style="color:var(--text-dim)">{{ asset.symbol }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('assets.fields.type') }}</span><span class="badge" :class="typeBadge(asset.type)">{{ assetTypeLabel(asset.type) }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('assets.fields.currency') }}</span><span>{{ asset.currency }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('assetDetail.dataSource') }}</span><span style="color:var(--text-dim)">{{ asset.data_source || t('assetDetail.auto') }}</span></div>
        </div>
      </div>

      <div class="card" v-if="holding">
        <div class="section-title">📦 {{ t('assetDetail.holdingInfo') }}</div>
        <div class="info-list">
          <div class="info-row"><span class="info-label">{{ t('holdings.fields.quantity') }}</span><span style="font-weight:600">{{ holding.quantity }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('holdings.fields.avgCost') }}</span><span>¥{{ fmt(holding.avg_cost) }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('holdings.fields.totalInvested') }}</span><span>¥{{ fmt(holding.total_invested) }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('assetDetail.targetPrice') }}</span><span>{{ holding.target_price ? '¥' + fmt(holding.target_price) : '-' }}</span></div>
          <div class="info-row"><span class="info-label">{{ t('assetDetail.stopLoss') }}</span><span style="color:var(--red)">{{ holding.stop_loss ? '¥' + fmt(holding.stop_loss) : '-' }}</span></div>
        </div>
      </div>
    </div>

    <!-- 交易记录 -->
    <div class="card">
      <div class="section-title">{{ t('assetDetail.transactions') }}</div>
      <!-- Desktop -->
      <table v-if="transactions.length" class="hide-mobile">
        <thead><tr><th>{{ t('assetDetail.time') }}</th><th>{{ t('transactionForm.type') }}</th><th>{{ t('transactionForm.quantity') }}</th><th>{{ t('transactionForm.price') }}</th><th>{{ t('transactionForm.total') }}</th><th>{{ t('assetDetail.fee') }}</th></tr></thead>
        <tbody>
          <tr v-for="tx in transactions" :key="tx.id">
            <td>{{ tx.executed_at?.slice(0,10) }}</td>
            <td><span class="badge" :class="tx.type==='buy'?'badge-buy':'badge-sell'">{{ tx.type==='buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span></td>
            <td>{{ tx.quantity }}</td>
            <td>¥{{ fmt(tx.price) }}</td>
            <td :class="tx.type==='buy'?'pnl negative':'pnl positive'">¥{{ fmt(tx.total) }}</td>
            <td>¥{{ fmt(tx.fee) }}</td>
          </tr>
        </tbody>
      </table>
      <!-- Mobile cards -->
      <div v-if="transactions.length" class="show-mobile tx-cards">
          <div v-for="tx in transactions" :key="tx.id" class="tx-card">
            <div class="tx-card-top">
              <span class="badge" :class="tx.type==='buy'?'badge-buy':'badge-sell'">{{ tx.type==='buy' ? t('history.transactionTypes.buy') : t('history.transactionTypes.sell') }}</span>
              <span style="color:var(--text-muted);font-size:12px">{{ tx.executed_at?.slice(0,10) }}</span>
            </div>
            <div class="tx-card-body">
              <span>{{ tx.quantity }} × ¥{{ fmt(tx.price) }}</span>
              <span :class="tx.type==='buy'?'pnl negative':'pnl positive'" style="font-weight:600">¥{{ fmt(tx.total) }}</span>
            </div>
          </div>
        </div>
      <div v-if="!transactions.length" class="empty" style="padding:24px"><p>{{ t('assetDetail.noTransactions') }}</p></div>
    </div>

    <!-- Transaction Drawer -->
    <AppDrawer v-model="showTxDrawer" :title="t('assetDetail.recordTrade')">
      <TransactionForm :asset-id="route.params.id" @success="onTxSuccess" @cancel="showTxDrawer = false" />
    </AppDrawer>

    <!-- Edit Drawer -->
    <AppDrawer v-model="showEditDrawer" :title="t('assetDetail.editAsset')">
      <form @submit.prevent="saveEdit">
        <div class="form-group"><label class="form-label">{{ t('assets.fields.name') }}</label><input class="form-input" v-model="editForm.name" required /></div>
        <div class="form-group"><label class="form-label">{{ t('assets.fields.symbol') }}</label><input class="form-input" v-model="editForm.symbol" /></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('assets.fields.type') }}</label>
            <select class="form-select" v-model="editForm.type">
              <option value="gold">{{ assetTypeLabel('gold') }}</option><option value="crypto">{{ assetTypeLabel('crypto') }}</option><option value="stock">{{ assetTypeLabel('stock') }}</option><option value="forex">{{ assetTypeLabel('forex') }}</option><option value="commodity">{{ assetTypeLabel('commodity') }}</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">{{ t('assets.fields.currency') }}</label>
            <select class="form-select" v-model="editForm.currency">
              <option value="CNY">CNY</option><option value="USD">USD</option><option value="USDT">USDT</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('assets.fields.icon') }}</label><input class="form-input" v-model="editForm.icon" /></div>
          <div class="form-group"><label class="form-label">{{ t('assetDetail.dataSource') }}</label><input class="form-input" v-model="editForm.data_source" :placeholder="t('assetDetail.auto')" /></div>
        </div>

        <div class="section-title" style="margin-top:20px">{{ t('assetDetail.holdingInfo') }}</div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('holdings.fields.quantity') }}</label><input class="form-input" type="number" step="any" v-model="editForm.quantity" /></div>
          <div class="form-group"><label class="form-label">{{ t('holdings.fields.avgCost') }}</label><input class="form-input" type="number" step="any" v-model="editForm.avg_cost" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('holdings.fields.totalInvested') }}</label><input class="form-input" type="number" step="any" v-model="editForm.total_invested" /></div>
          <div class="form-group"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">{{ t('assetDetail.targetPrice') }}</label><input class="form-input" type="number" step="any" v-model="editForm.target_price" /></div>
          <div class="form-group"><label class="form-label">{{ t('assetDetail.stopLoss') }}</label><input class="form-input" type="number" step="any" v-model="editForm.stop_loss" /></div>
        </div>

        <div style="display:flex;gap:10px;margin-top:16px">
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? t('assetDetail.saving') : t('assetDetail.save') }}</button>
          <button type="button" class="btn" @click="showEditDrawer = false">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </AppDrawer>

    <!-- delete confirm is handled programmatically via useConfirm() -->

    <!-- AI Drawer -->
    <AppDrawer v-model="showAIDrawer" :title="`✨ ${t('assetDetail.aiAdviceTitle')}`">
      <AIStrategyGenerator :preset-asset-id="route.params.id" @done="showAIDrawer = false" />
    </AppDrawer>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import AppDrawer from '../components/AppDrawer.vue'
import TransactionForm from '../components/TransactionForm.vue'
import { useConfirm } from '../utils/confirm.js'
import AIStrategyGenerator from '../components/AIStrategyGenerator.vue'
import { useSwipeBack } from '../composables/useSwipeBack.js'
import { formatNumber } from '../utils/formatters.js'

useSwipeBack()

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const asset = ref({})
const holding = ref(null)
const transactions = ref([])
const showTxDrawer = ref(false)
const showEditDrawer = ref(false)
const showAIDrawer = ref(false)
const showDeleteConfirm = ref(false)
const showActions = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editForm = reactive({ name: '', symbol: '', type: '', currency: '', icon: '', data_source: '', quantity: '', avg_cost: '', total_invested: '', target_price: '', stop_loss: '' })

watch([() => editForm.quantity, () => editForm.avg_cost], ([qty, cost]) => {
  if (qty && cost) {
    editForm.total_invested = (Number(qty) * Number(cost)).toFixed(2)
  }
})

async function loadData() {
  const res = await api(`/api/assets/${route.params.id}`)
  const json = await res.json()
  if (json.data) {
    asset.value = json.data
    holding.value = json.data.quantity ? json.data : null
    Object.assign(editForm, {
      name: json.data.name, symbol: json.data.symbol, type: json.data.type,
      currency: json.data.currency, icon: json.data.icon || '', data_source: json.data.data_source || '',
      quantity: json.data.quantity || '', avg_cost: json.data.avg_cost || '',
      total_invested: json.data.total_invested || '', target_price: json.data.target_price || '',
      stop_loss: json.data.stop_loss || '',
    })
  }
  const tres = await api(`/api/transactions?asset_id=${route.params.id}`)
  const tjson = await tres.json()
  transactions.value = tjson.data || []
}

function onTxSuccess() {
  showTxDrawer.value = false
  toast.success(t('assetDetail.recordTrade'))
  loadData()
}

async function saveEdit() {
  saving.value = true
  try {
    // Save asset fields
    const assetPayload = { name: editForm.name, symbol: editForm.symbol, type: editForm.type, currency: editForm.currency, icon: editForm.icon, data_source: editForm.data_source }
    const res = await api(`/api/assets/${route.params.id}`, { method: 'PUT', body: JSON.stringify(assetPayload) })
    const json = await res.json()
    if (!json.success) { toast.error(json.error || t('common.saveFailed')); saving.value = false; return }

    // Save holding fields if we have a holding
    if (asset.value.holding_id) {
      const holdingPayload = {
        quantity: editForm.quantity ? Number(editForm.quantity) : undefined,
        avg_cost: editForm.avg_cost ? Number(editForm.avg_cost) : undefined,
        total_invested: editForm.total_invested ? Number(editForm.total_invested) : undefined,
        target_price: editForm.target_price ? Number(editForm.target_price) : null,
        stop_loss: editForm.stop_loss ? Number(editForm.stop_loss) : null,
      }
      await api(`/api/holdings/${asset.value.holding_id}`, { method: 'PUT', body: JSON.stringify(holdingPayload) })
    } else if (editForm.quantity && editForm.avg_cost) {
      // Create new holding if none exists
      await api('/api/holdings', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: Number(route.params.id),
          quantity: Number(editForm.quantity),
          avg_cost: Number(editForm.avg_cost),
          total_invested: editForm.total_invested ? Number(editForm.total_invested) : undefined,
          target_price: editForm.target_price ? Number(editForm.target_price) : null,
          stop_loss: editForm.stop_loss ? Number(editForm.stop_loss) : null,
        })
      })
    }

    toast.success(t('assetDetail.updated')); showEditDrawer.value = false; loadData()
  } catch (e) { toast.error(e.message) }
  saving.value = false
}

async function confirmDelete() {
  const ok = await confirm({
    title: t('assetDetail.deleteAsset'),
    message: t('assetDetail.deleteConfirm', { name: asset.name }),
    confirmText: t('assetDetail.delete'),
    icon: 'delete',
    danger: true,
  })
  if (ok) doDelete()
}

async function doDelete() {
  deleting.value = true
  try {
    const res = await api(`/api/assets/${route.params.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.success) { toast.success(t('assetDetail.deleted')); router.push('/assets') }
    else toast.error(json.error || t('assetDetail.deleteFailed'))
  } catch (e) { toast.error(e.message) }
  deleting.value = false
  showDeleteConfirm.value = false
}

function typeBadge(type) {
  return { gold: 'badge-gold', crypto: 'badge-crypto', stock: 'badge-stock' }[type] || 'badge-pending'
}
function assetTypeLabel(type) {
  return {
    gold: t('assets.types.gold'),
    crypto: t('assets.types.crypto'),
    stock: t('assets.types.stock'),
    forex: t('assets.types.forex'),
    commodity: t('assets.types.commodity'),
  }[type] || type
}
function fmt(n) {
  if (!n && n !== 0) return '0'
  return formatNumber(Number(n))
}

onMounted(loadData)
</script>

<style scoped>
.page-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hide-on-mobile { display: flex; gap: 8px; flex-wrap: wrap; }
.show-on-mobile { display: none; }
.info-list { font-size: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
.info-row:last-child { border-bottom: none; }
.info-label { color: var(--text-dim); font-size: 13px; }

.hide-mobile { display: table; }
.show-mobile { display: none !important; }

.tx-cards { flex-direction: column; gap: 8px; }
.tx-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.tx-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.tx-card-body { display: flex; justify-content: space-between; font-size: 14px; }

@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }
  .hide-on-mobile { display: none !important; }
  .show-on-mobile { display: flex !important; }
  .info-row { flex-wrap: wrap; gap: 4px; }
  .tx-card-body { flex-wrap: wrap; gap: 4px; font-size: 13px; }
  .tx-card { padding: 12px 14px; }
}
</style>
