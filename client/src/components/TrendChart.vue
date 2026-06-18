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
      <svg
        v-else
        class="trend-svg"
        viewBox="0 0 320 150"
        preserveAspectRatio="none"
        role="img"
        :aria-label="title"
        @pointermove="handlePointerMove"
        @pointerleave="clearActivePoint"
        @touchstart.passive="handlePointerMove"
        @touchmove.passive="handlePointerMove"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="lineColor" stop-opacity="0.24" />
            <stop offset="100%" :stop-color="lineColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <g v-for="tick in yAxisTicks" :key="tick.y">
          <line :x1="chartLeft" :x2="chartRight" :y1="tick.y" :y2="tick.y" class="trend-grid-line" />
        </g>
        <path :d="areaPath" :fill="`url(#${gradientId})`" />
        <path :d="linePath" fill="none" :stroke="lineColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        <g v-if="activePoint">
          <line :x1="activePoint.x" :x2="activePoint.x" :y1="chartTop" :y2="chartBottom" class="trend-crosshair" />
        </g>
      </svg>
      <div v-if="chartPoints.length" class="trend-y-axis" aria-hidden="true">
        <span v-for="tick in yAxisTicks" :key="tick.y" :style="axisLabelStyle(tick)">{{ tick.label }}</span>
      </div>
      <span v-if="chartPoints.length" class="trend-point trend-last-point" :style="pointStyle(lastPoint)" aria-hidden="true"></span>
      <span v-if="activePoint" class="trend-point trend-active-point" :style="pointStyle(activePoint)" aria-hidden="true"></span>
      <div v-if="activePoint" class="trend-tooltip" :style="tooltipStyle">
        <strong>{{ props.valueFormatter(activePoint.rawValue) }}</strong>
        <span>{{ pointTimeLabel(activePoint) }}</span>
      </div>
    </div>

    <div v-if="chartPoints.length" class="trend-foot">
      <span>{{ startLabel }}</span>
      <span>{{ lastValueLabel }}</span>
      <span>{{ endLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
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
const chartWidth = 320
const chartHeight = 150
const chartLeft = 44
const chartRight = 314
const chartTop = 12
const chartBottom = 132
const activePoint = ref(null)

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
  const plotWidth = chartRight - chartLeft
  const plotHeight = chartBottom - chartTop
  return points.map((point, index) => {
    const x = points.length === 1 ? chartLeft + plotWidth / 2 : chartLeft + (index / (points.length - 1)) * plotWidth
    const ratio = (point.rawValue - min) / (max - min)
    const y = chartTop + (1 - ratio) * plotHeight
    return { ...point, x, y }
  })
})

const linePath = computed(() => plotted.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '))
const areaPath = computed(() => {
  if (!plotted.value.length) return ''
  const first = plotted.value[0]
  const last = plotted.value[plotted.value.length - 1]
  return `${linePath.value} L ${last.x.toFixed(2)} ${chartBottom} L ${first.x.toFixed(2)} ${chartBottom} Z`
})
const yAxisTicks = computed(() => {
  const { min, max } = minMax.value
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = max - (max - min) * ratio
    const y = chartTop + (chartBottom - chartTop) * ratio
    return { y, label: compactValue(value) }
  })
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
const pointFormatter = computed(() => new Intl.DateTimeFormat(locale.value || undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
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
function compactValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(n / 1_000).toFixed(0)}K`
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`
  if (abs >= 100) return n.toFixed(0)
  if (abs >= 10) return n.toFixed(1)
  return n.toFixed(2)
}
function eventClientX(event) {
  return event.touches?.[0]?.clientX ?? event.clientX
}
function handlePointerMove(event) {
  if (!plotted.value.length) return
  const clientX = eventClientX(event)
  const rect = event.currentTarget.getBoundingClientRect()
  const svgX = ((clientX - rect.left) / rect.width) * chartWidth
  activePoint.value = plotted.value.reduce((nearest, point) => Math.abs(point.x - svgX) < Math.abs(nearest.x - svgX) ? point : nearest, plotted.value[0])
}
function clearActivePoint() {
  activePoint.value = null
}
function pointTimeLabel(point) {
  return point?.t ? pointFormatter.value.format(new Date(point.t)) : ''
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
function pctX(point) {
  return (point.x / chartWidth) * 100
}
function pctY(point) {
  return (point.y / chartHeight) * 100
}
function axisLabelStyle(tick) {
  return { top: `${pctY(tick)}%` }
}
function pointStyle(point) {
  return {
    left: `${pctX(point)}%`,
    top: `${pctY(point)}%`,
    background: lineColor.value,
  }
}
const tooltipStyle = computed(() => {
  if (!activePoint.value) return {}
  const rawLeftPct = pctX(activePoint.value)
  const rawTopPct = pctY(activePoint.value)
  const leftPct = clamp(rawLeftPct, 10, 94)
  const topPct = clamp(rawTopPct, 18, 86)
  const xTransform = rawLeftPct > 72 ? '-100%' : rawLeftPct < 18 ? '8px' : '-50%'
  const yTransform = rawTopPct < 28 ? '12px' : 'calc(-100% - 12px)'
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    transform: `translate(${xTransform}, ${yTransform})`,
  }
})
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
  touch-action: pan-y;
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
.trend-y-axis { position:absolute; inset:0; pointer-events:none; }
.trend-y-axis span { position:absolute; left:8px; transform:translateY(-50%); color:var(--text-muted); font-size:10px; font-weight:700; line-height:1; }
.trend-crosshair {
  stroke: var(--text-muted);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
  opacity: 0.75;
}
.trend-point { position:absolute; width:8px; height:8px; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; box-shadow:0 0 0 2px var(--bg-card); }
.trend-active-point { width:10px; height:10px; z-index:2; }
.trend-tooltip {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 170px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-overlay);
  color: var(--text);
  box-shadow: 0 10px 24px var(--shadow-color);
  pointer-events: none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.trend-tooltip strong { font-size: 13px; }
.trend-tooltip span { color: var(--text-dim); font-size: 11px; white-space: nowrap; }
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

