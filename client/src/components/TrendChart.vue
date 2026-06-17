<template>
  <div class="trend-card card">
    <div class="trend-head">
      <div>
        <div class="section-title trend-title">{{ title }}</div>
        <div v-if="subtitle" class="trend-subtitle">{{ subtitle }}</div>
      </div>
      <div v-if="summary" class="trend-summary" :style="{ color: lineColor }">
        <span class="trend-summary-value">{{ formattedChange }}</span>
        <span v-if="formattedChangePct" class="trend-summary-pct">{{ formattedChangePct }}</span>
      </div>
    </div>

    <div class="trend-ranges" role="tablist" :aria-label="title">
      <button
        v-for="range in ranges"
        :key="range"
        type="button"
        class="trend-range-btn"
        :class="{ active: range === modelValue }"
        @click="$emit('update:modelValue', range)"
      >
        {{ rangeLabel(range) }}
      </button>
    </div>

    <div class="trend-chart-wrap" :class="{ loading }">
      <div v-if="loading" class="trend-skeleton">
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton trend-skeleton-line"></div>
      </div>
      <div v-else-if="!chartPoints.length" class="trend-empty">
        <span class="trend-empty-icon">〰️</span>
        <span>{{ emptyText }}</span>
      </div>
      <svg v-else class="trend-svg" viewBox="0 0 320 150" preserveAspectRatio="none" role="img" :aria-label="title">
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="lineColor" stop-opacity="0.24" />
            <stop offset="100%" :stop-color="lineColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line v-for="y in gridLines" :key="y" x1="0" x2="320" :y1="y" :y2="y" class="trend-grid-line" />
        <path :d="areaPath" :fill="`url(#${gradientId})`" />
        <path :d="linePath" fill="none" :stroke="lineColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        <circle :cx="lastPoint.x" :cy="lastPoint.y" r="3" :fill="lineColor" />
      </svg>
    </div>

    <div v-if="chartPoints.length" class="trend-foot">
      <span>{{ startLabel }}</span>
      <span>{{ lastValueLabel }}</span>
      <span>{{ endLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  points: { type: Array, default: () => [] },
  summary: { type: Object, default: null },
  modelValue: { type: String, default: '1m' },
  ranges: { type: Array, default: () => ['1d', '1w', '1m', '6m', '1y'] },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: '' },
  valueFormatter: { type: Function, default: (value) => String(value) },
  percentFormatter: { type: Function, default: (value) => `${Number(value || 0).toFixed(1)}%` },
})

defineEmits(['update:modelValue'])

const { t, locale } = useI18n()
const gradientId = `trend-gradient-${Math.random().toString(36).slice(2)}`
const gridLines = [28, 58, 88, 118]

const chartPoints = computed(() => (props.points || [])
  .map(point => ({ ...point, rawValue: Number(point.value) }))
  .filter(point => Number.isFinite(point.rawValue)))

const minMax = computed(() => {
  const values = chartPoints.value.map(point => point.rawValue)
  if (!values.length) return { min: 0, max: 1 }
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.08, 1)
    min -= pad
    max += pad
  }
  return { min, max }
})

const plotted = computed(() => {
  const points = chartPoints.value
  const { min, max } = minMax.value
  const width = 320
  const height = 150
  const top = 12
  const bottom = 18
  const chartHeight = height - top - bottom
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
    const ratio = (point.rawValue - min) / (max - min)
    const y = top + (1 - ratio) * chartHeight
    return { ...point, x, y }
  })
})

const linePath = computed(() => plotted.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '))
const areaPath = computed(() => {
  if (!plotted.value.length) return ''
  const first = plotted.value[0]
  const last = plotted.value[plotted.value.length - 1]
  return `${linePath.value} L ${last.x.toFixed(2)} 150 L ${first.x.toFixed(2)} 150 Z`
})
const lastPoint = computed(() => plotted.value[plotted.value.length - 1] || { x: 0, y: 0 })
const lastRawValue = computed(() => chartPoints.value[chartPoints.value.length - 1]?.rawValue ?? null)
const changeValue = computed(() => Number(props.summary?.change ?? 0))
const lineColor = computed(() => changeValue.value >= 0 ? 'var(--market-positive)' : 'var(--market-negative)')
const formattedChange = computed(() => {
  const value = Number(props.summary?.change ?? 0)
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${props.valueFormatter(value)}`
})
const formattedChangePct = computed(() => {
  const value = props.summary?.change_pct
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return ''
  const prefix = Number(value) > 0 ? '+' : ''
  return `${prefix}${props.percentFormatter(value)}`
})
const lastValueLabel = computed(() => lastRawValue.value == null ? '-' : props.valueFormatter(lastRawValue.value))
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value || undefined, { month: 'short', day: 'numeric' }))
const startLabel = computed(() => {
  const value = chartPoints.value[0]?.t
  return value ? dateFormatter.value.format(new Date(value)) : ''
})
const endLabel = computed(() => {
  const value = chartPoints.value[chartPoints.value.length - 1]?.t
  return value ? dateFormatter.value.format(new Date(value)) : ''
})

function rangeLabel(range) {
  return t(`trend.ranges.${range}`, range)
}
</script>

<style scoped>
.trend-card {
  margin-bottom: 20px;
  overflow: hidden;
}
.trend-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 12px;
}
.trend-title { margin: 0; }
.trend-subtitle {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}
.trend-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  white-space: nowrap;
}
.trend-summary-value { font-size: 18px; font-weight: 800; }
.trend-summary-pct { font-size: 12px; font-weight: 700; opacity: 0.86; }
.trend-ranges {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-soft);
}
.trend-range-btn {
  min-width: 42px;
  padding: 6px 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.trend-range-btn.active {
  background: var(--primary);
  color: white;
  box-shadow: 0 8px 18px rgba(59, 130, 246, 0.22);
}
.trend-chart-wrap {
  position: relative;
  min-height: 170px;
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--bg-soft), transparent);
  overflow: hidden;
}
.trend-svg {
  width: 100%;
  height: 170px;
  display: block;
}
.trend-grid-line {
  stroke: var(--border-subtle);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.trend-empty,
.trend-skeleton {
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
}
.trend-empty-icon { font-size: 22px; }
.trend-skeleton-line {
  width: min(82%, 420px);
  height: 86px;
  border-radius: 16px;
}
.trend-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 11px;
}
.trend-foot span:nth-child(2) {
  color: var(--text-dim);
  font-weight: 700;
}
@media (max-width: 768px) {
  .trend-card {
    margin-bottom: 16px;
    padding: 14px;
    border-radius: 16px;
  }
  .trend-head {
    flex-direction: column;
    gap: 8px;
  }
  .trend-summary {
    align-items: flex-start;
  }
  .trend-ranges {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    width: 100%;
    border-radius: 14px;
  }
  .trend-range-btn {
    min-width: 0;
    padding: 7px 4px;
  }
  .trend-chart-wrap,
  .trend-empty,
  .trend-skeleton {
    min-height: 150px;
  }
  .trend-svg {
    height: 150px;
  }
}
</style>

