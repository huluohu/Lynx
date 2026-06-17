<template>
  <div class="card" :class="{ loading }">
    <div class="section-title">
      <span class="badge badge-gold">🥇 {{ t('marketCards.gold') }}</span>
    </div>
    <div class="price-big">
      {{ money(price?.shanghai, 'CNY') }}
      <span style="font-size:16px;font-weight:400;color:var(--text-dim)">{{ t('marketCards.gram') }}</span>
    </div>
    <div class="price-sub">
      {{ t('marketCards.londonGold', { price: money(price?.london, 'USD', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) }}
    </div>
    <div class="pnl" :class="pl_pct >= 0 ? 'positive' : 'negative'">
      {{ profit?.pl ? (profit.pl >= 0 ? '+' : '') + t('marketCards.profitYuan', { value: formatNum(profit.pl) }) : '-' }}
      &nbsp;({{ profit?.pl_pct ? (profit.pl_pct >= 0 ? '+' : '') + profit.pl_pct.toFixed(1) + '%' : '-' }})
    </div>
    <div class="progress-bar">
      <div
        class="fill"
        :style="{ width: Math.min(Math.abs(pl_pct) * 3, 100) + '%', background: pl_pct >= 0 ? 'var(--market-positive)' : 'var(--market-negative)' }"
      ></div>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim)">
      <div>{{ t('marketCards.holdingsGram', { amount: holding?.amount ?? '-' }) }}</div>
      <div>{{ t('marketCards.cost', { price: holding?.cost_per ? money(holding.cost_per, 'CNY') + t('marketCards.gram') : '-' }) }}</div>
      <div style="color:var(--green)">{{ t('marketCards.addPosition', { price: money(880, 'CNY') }) }}</div>
      <div style="color:var(--gold)">{{ t('marketCards.reducePosition', { price: money(950, 'CNY') }) }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCurrencyAmount } from '../utils/currency.js'
import { formatNumber } from '../utils/formatters.js'

const props = defineProps({
  price: Object,
  profit: Object,
  holding: Object,
  loading: Boolean
})
const { t } = useI18n()

const pl_pct = computed(() => props.profit?.pl_pct || 0)

function formatNum(n) {
  if (!n && n !== 0) return '-'
  return formatNumber(Math.round(n))
}

function money(value, currency, options = {}) {
  return formatCurrencyAmount(value, currency, { maximumFractionDigits: 2, ...options })
}
</script>
