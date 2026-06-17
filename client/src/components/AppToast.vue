<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item"
          :class="`toast-${t.type}`"
        >
          <span class="toast-icon"><AppIcon :name="icons[t.type] || 'about'" size="16" /></span>
          <span class="toast-msg">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../utils/toast.js'
import AppIcon from './AppIcon.vue'

const { toasts } = useToast()

const icons = {
  success: 'check',
  error: 'x',
  info: 'about',
  loading: 'more',
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}
.toast-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  box-shadow: 0 4px 20px var(--shadow-color);
  white-space: nowrap;
}
.toast-success { border-color: var(--green); }
.toast-error { border-color: var(--red); }
.toast-icon { display: inline-flex; align-items: center; }
.toast-success .toast-icon { color: var(--green); }
.toast-error .toast-icon { color: var(--red); }
.toast-msg { color: var(--text); }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
