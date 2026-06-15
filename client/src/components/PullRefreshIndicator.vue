<template>
  <div class="pull-refresh-indicator" :class="{ visible: isPulling || isRefreshing }" :style="{ transform: `translateY(${pullDistance}px)` }">
    <div class="pull-refresh-content">
      <svg v-if="isRefreshing" class="pull-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      </svg>
      <svg v-else class="pull-arrow" :class="{ flipped: pullDistance >= threshold }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span class="pull-text">{{ statusText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  pullDistance: { type: Number, default: 0 },
  isPulling: { type: Boolean, default: false },
  isRefreshing: { type: Boolean, default: false },
  threshold: { type: Number, default: 60 },
})

const statusText = computed(() => {
  if (props.isRefreshing) return '刷新中...'
  if (props.pullDistance >= props.threshold) return '释放刷新'
  return '下拉刷新'
})
</script>

<style scoped>
.pull-refresh-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 45;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}
.pull-refresh-indicator.visible {
  opacity: 1;
}
.pull-refresh-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  font-size: 12px;
  color: var(--text-dim);
}
.pull-arrow {
  transition: transform 0.2s;
}
.pull-arrow.flipped {
  transform: rotate(180deg);
}
.pull-spinner {
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.pull-text {
  font-weight: 500;
}
</style>
