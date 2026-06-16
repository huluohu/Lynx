<template>
  <Teleport to="body">
    <Transition :name="isMobile ? 'sheet' : 'drawer'">
      <div v-if="modelValue" class="overlay" :class="{ 'overlay-mobile': isMobile }" @click.self="close">
        <!-- Desktop: side drawer -->
        <div v-if="!isMobile" class="drawer-panel" :style="drawerStyle">
          <div class="panel-header">
            <h3 class="panel-title">{{ title }}</h3>
            <button class="panel-close" @click="close">✕</button>
          </div>
          <div class="panel-body">
            <slot />
          </div>
          <div class="panel-footer" v-if="$slots.footer">
            <slot name="footer" />
          </div>
        </div>

        <!-- Mobile: bottom sheet -->
        <div v-else class="sheet-panel" ref="sheetRef" :class="sheetClass" :style="sheetStyle">
          <div
            class="sheet-drag-surface"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div class="sheet-grip-area">
              <div class="sheet-grip"></div>
            </div>
            <div class="panel-header panel-header-mobile">
              <h3 class="panel-title">{{ title }}</h3>
              <button class="panel-close" @click="close">✕</button>
            </div>
          </div>
          <div ref="bodyRef" class="panel-body">
            <slot />
          </div>
          <div class="panel-footer" v-if="$slots.footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDocumentScrollLock } from '../composables/useDocumentScrollLock.js'

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '' },
  width: { type: [String, Number], default: '480px' },
  mobileHeight: { type: String, default: 'auto' },
})
const emit = defineEmits(['update:modelValue'])

const isMobile = ref(false)
const sheetRef = ref(null)
const bodyRef = ref(null)
const dragY = ref(0)
const dragging = ref(false)
let startY = 0

function checkMobile() {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

function close() {
  dragY.value = 0
  emit('update:modelValue', false)
}

// Touch gesture for bottom sheet
function onTouchStart(e) {
  startY = e.touches[0].clientY
  dragging.value = false
}

function onTouchMove(e) {
  const deltaY = e.touches[0].clientY - startY
   if ((bodyRef.value?.scrollTop || 0) <= 0 && deltaY > 0) {
     dragging.value = true
     dragY.value = Math.max(0, deltaY)
     e.preventDefault()
  }
}

function onTouchEnd() {
  if (dragging.value && dragY.value > 120) {
    close()
  } else {
    dragY.value = 0
  }
  dragging.value = false
}

const drawerStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
}))

const sheetStyle = computed(() => {
  const style = {}
  if (props.mobileHeight === 'fixed') {
    style.height = '78vh'
    style.maxHeight = '78vh'
  } else if (props.mobileHeight === 'fullscreen') {
    style.height = 'calc(100dvh - 12px)'
    style.maxHeight = 'calc(100dvh - 12px)'
  }
  if (dragY.value > 0) {
    style.transform = `translateY(${dragY.value}px)`
    style.transition = 'none'
  }
  return style
})

const sheetClass = computed(() => ({
  'sheet-panel--fixed': props.mobileHeight === 'fixed',
  'sheet-panel--fullscreen': props.mobileHeight === 'fullscreen',
}))

useDocumentScrollLock(computed(() => props.modelValue))
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--surface-backdrop);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.overlay-mobile {
  justify-content: center;
  align-items: flex-end;
}

/* === Desktop Drawer === */
.drawer-panel {
  width: 480px;
  max-width: 100vw;
  height: 100%;
  background: var(--bg-card);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* === Mobile Bottom Sheet === */
.sheet-panel {
  width: 100%;
  max-height: 90vh;
  background: var(--sheet-bg);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s ease;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.sheet-drag-surface {
  flex-shrink: 0;
  touch-action: none;
}

.sheet-grip-area {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
  flex-shrink: 0;
  cursor: grab;
}
.sheet-grip {
  width: 36px;
  height: 4px;
  background: var(--text-muted);
  border-radius: 2px;
  opacity: 0.5;
}

/* === Shared Panel Parts === */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.panel-header-mobile {
  padding-top: 8px;
}
.panel-title {
  font-size: 17px;
  font-weight: 600;
}
.panel-close {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 18px;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.15s;
}
.panel-close:active {
  background: var(--bg-hover);
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
.panel-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* === Desktop Drawer Transitions === */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}

/* === Mobile Sheet Transitions === */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.3s ease;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
