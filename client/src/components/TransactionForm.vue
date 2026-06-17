<template>
  <form @submit.prevent="submit" class="transaction-form">
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">{{ t('transactionForm.type') }} *</label>
        <select class="form-select" v-model="form.type" required>
          <option value="buy">{{ t('history.transactionTypes.buy') }}</option>
          <option value="sell">{{ t('history.transactionTypes.sell') }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('transactionForm.date') }}</label>
        <input class="form-input" type="date" v-model="form.executed_at" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">{{ t('transactionForm.quantity') }} *</label>
        <input class="form-input" type="number" step="any" v-model="form.quantity" required placeholder="0.0000" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('transactionForm.price') }} *</label>
        <input class="form-input" type="number" step="any" v-model="form.price" required placeholder="0.00" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">{{ t('transactionForm.total') }}</label>
        <input class="form-input" type="number" step="any" v-model="computedTotal" :placeholder="t('transactionForm.totalPlaceholder')" />
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('transactionForm.fee') }}</label>
        <input class="form-input" type="number" step="any" v-model="form.fee" placeholder="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">{{ t('transactionForm.notes') }}</label>
      <textarea class="form-textarea" v-model="form.reason" :placeholder="t('transactionForm.notesPlaceholder')" rows="2"></textarea>
    </div>
    <MobileActionBar>
      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? t('transactionForm.submitting') : t('transactionForm.submit') }}
      </button>
      <button type="button" class="btn" @click="$emit('cancel')">{{ t('common.cancel') }}</button>
    </MobileActionBar>
  </form>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../utils/api.js'
import { useToast } from '../utils/toast.js'
import MobileActionBar from './MobileActionBar.vue'

const props = defineProps({
  assetId: { type: [Number, String], required: true },
})
const emit = defineEmits(['success', 'cancel'])
const { t } = useI18n()
const toast = useToast()

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
    if (!json.success) {
      toast.error(json.error || t('transactionForm.submitFailed'))
      return
    }
    emit('success')
  } catch (e) {
    toast.error(e.message)
  }
  submitting.value = false
}
</script>

<style scoped></style>
