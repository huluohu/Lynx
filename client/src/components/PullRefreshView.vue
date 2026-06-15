<template>
  <div ref="containerRef" class="pull-refresh-view">
    <PullRefreshIndicator
      :pullDistance="pullDistance"
      :isPulling="isPulling"
      :isRefreshing="isRefreshing"
      :threshold="threshold"
    />
    <slot />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePullRefresh } from '../composables/usePullRefresh.js'
import PullRefreshIndicator from './PullRefreshIndicator.vue'

const props = defineProps({
  onRefresh: { type: Function, required: true },
  threshold: { type: Number, default: 60 },
})

const containerRef = ref(null)
const { pullDistance, isPulling, isRefreshing } = usePullRefresh({
  onRefresh: props.onRefresh,
  threshold: props.threshold,
})
</script>
