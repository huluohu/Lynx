<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="state.visible" class="confirm-overlay" @click.self="cancel">
        <div class="confirm-box" :class="{ 'confirm-danger': state.danger }">
          <div class="confirm-icon-area" v-if="state.icon">
            <div class="confirm-icon" :class="`icon-${state.icon}`">
              <svg v-if="state.icon === 'delete'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              <svg v-else-if="state.icon === 'logout'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          </div>
          <div class="confirm-content">
            <h3 class="confirm-title">{{ state.title }}</h3>
            <p class="confirm-message">{{ state.message }}</p>
          </div>
          <div class="confirm-actions">
            <button class="confirm-btn confirm-btn-cancel" @click="cancel">{{ state.cancelText }}</button>
            <button class="confirm-btn" :class="state.danger ? 'confirm-btn-danger' : 'confirm-btn-primary'" @click="doConfirm">{{ state.confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useDocumentScrollLock } from '../composables/useDocumentScrollLock.js'
import { useConfirmState, resolveConfirm } from '../utils/confirm.js'

const state = useConfirmState()

useDocumentScrollLock(computed(() => state.visible))

function cancel() {
  resolveConfirm(false)
}
function doConfirm() {
  resolveConfirm(true)
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--surface-backdrop);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.confirm-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  width: 380px;
  max-width: calc(100vw - 40px);
  overflow: hidden;
  box-shadow: 0 20px 60px var(--shadow-color);
}
.confirm-icon-area {
  display: flex;
  justify-content: center;
  padding: 24px 20px 0;
}
.confirm-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.confirm-icon.icon-delete {
  background: var(--danger-soft);
  color: var(--red, #ef4444);
}
.confirm-icon.icon-logout {
  background: var(--warning-soft);
  color: var(--warning, #f59e0b);
}
.confirm-icon.icon-warning {
  background: var(--warning-soft);
  color: var(--warning, #f59e0b);
}
.confirm-content {
  padding: 20px 24px 8px;
  text-align: center;
}
.confirm-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text);
}
.confirm-message {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.5;
  margin: 0;
}
.confirm-actions {
  display: flex;
  gap: 10px;
  padding: 16px 24px 24px;
}
.confirm-btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}
.confirm-btn-cancel {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
}
.confirm-btn-cancel:hover {
  background: var(--bg-hover);
}
.confirm-btn-cancel:active {
  transform: scale(0.97);
}
.confirm-btn-primary {
  background: var(--primary);
  color: #fff;
}
.confirm-btn-primary:hover {
  filter: brightness(1.1);
}
.confirm-btn-primary:active {
  transform: scale(0.97);
}
.confirm-btn-danger {
  background: var(--red, #ef4444);
  color: #fff;
}
.confirm-btn-danger:hover {
  filter: brightness(1.1);
}
.confirm-btn-danger:active {
  transform: scale(0.97);
}

/* Animation */
.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-dialog-enter-active .confirm-box,
.confirm-dialog-leave-active .confirm-box {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}
.confirm-dialog-enter-from .confirm-box {
  transform: scale(0.9) translateY(10px);
}
.confirm-dialog-leave-to .confirm-box {
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .confirm-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .confirm-box {
    width: 100%;
    max-width: 100%;
    border-radius: 16px 16px 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .confirm-actions {
    padding: 16px 20px calc(20px + env(safe-area-inset-bottom, 0));
  }
  .confirm-dialog-enter-from .confirm-box {
    transform: translateY(100%);
  }
  .confirm-dialog-leave-to .confirm-box {
    transform: translateY(100%);
  }
  .confirm-dialog-enter-active .confirm-box,
  .confirm-dialog-leave-active .confirm-box {
    transition: transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
  }
}
</style>
