<template>
  <div class="swipe-action-wrapper" ref="itemRef">
    <div class="swipe-action-content" :style="contentStyle">
      <slot />
    </div>
    <div class="swipe-action-actions" :style="actionsStyle">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSwipeAction } from '../composables/useSwipeAction.js'

const props = defineProps({
  actionWidth: { type: Number, default: 80 },
})

const itemRef = ref(null)
const { offsetX, isOpen, close } = useSwipeAction(itemRef, {
  actionWidth: props.actionWidth,
})

const contentStyle = computed(() => ({
  transform: `translateX(${offsetX.value}px)`,
  transition: offsetX.value === 0 || offsetX.value === -props.actionWidth ? 'transform 0.25s ease' : 'none',
}))

const actionsStyle = computed(() => ({
  width: `${props.actionWidth}px`,
}))

defineExpose({ close, isOpen })
</script>

<style scoped>
.swipe-action-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: inherit;
}
.swipe-action-content {
  position: relative;
  z-index: 1;
  background: var(--bg-card);
}
.swipe-action-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: stretch;
  z-index: 0;
}
</style>
