<template>
  <form @submit.prevent="submit" class="transaction-form">
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">类型 *</label>
        <select class="form-select" v-model="form.type" required>
          <option value="buy">买入</option>
          <option value="sell">卖出</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">日期</label>
        <input class="form-input" type="date" v-model="form.executed_at" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">数量 *</label>
        <input class="form-input" type="number" step="any" v-model="form.quantity" required placeholder="0.0000" />
      </div>
      <div class="form-group">
        <label class="form-label">价格 *</label>
        <input class="form-input" type="number" step="any" v-model="form.price" required placeholder="0.00" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">总金额</label>
        <input class="form-input" type="number" step="any" v-model="computedTotal" placeholder="自动计算" />
      </div>
      <div class="form-group">
        <label class="form-label">手续费</label>
        <input class="form-input" type="number" step="any" v-model="form.fee" placeholder="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">备注</label>
      <textarea class="form-textarea" v-model="form.reason" placeholder="交易原因/备注..." rows="2"></textarea>
    </div>
    <div class="form-actions">
      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? '提交中...' : '提交' }}
      </button>
      <button type="button" class="btn" @click="$emit('cancel')">取消</button>
    </div>
  </form>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { api } from '../utils/api.js'

const props = defineProps({
  assetId: { type: [Number, String], required: true },
})
const emit = defineEmits(['success', 'cancel'])

const submitting = ref(false)
const form = reactive({
  type: 'buy',
  quantity: '',
  price: '',
  total: '',
  fee: '',
  executed_at: new Date().toISOString().slice(0, 10),
  reason: '',
})

const computedTotal = computed({
  get: () => form.total || (form.quantity && form.price ? (Number(form.quantity) * Number(form.price)).toFixed(2) : ''),
  set: (v) => { form.total = v }
})

async function submit() {
  submitting.value = true
  try {
    const body = {
      asset_id: Number(props.assetId),
      type: form.type,
      quantity: Number(form.quantity),
      price: Number(form.price),
      total: Number(computedTotal.value) || Number(form.quantity) * Number(form.price),
      fee: form.fee ? Number(form.fee) : 0,
      executed_at: form.executed_at,
      reason: form.reason,
    }
    const res = await api('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '提交失败')
    emit('success')
  } catch (e) {
    alert(e.message)
  }
  submitting.value = false
}
</script>

<style scoped>
.transaction-form .form-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
</style>
