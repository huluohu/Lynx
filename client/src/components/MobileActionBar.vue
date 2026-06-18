<template>
  <div class="mobile-action-bar" :class="{ 'mobile-action-bar--stacked': stacked, 'mobile-action-bar--drawer': drawer }">
    <slot />
  </div>
  <div class="mobile-action-bar-spacer" :class="{ 'mobile-action-bar-spacer--stacked': stacked }" aria-hidden="true"></div>
</template>

<script setup>
defineProps({
  stacked: Boolean,
  drawer: Boolean,
})
</script>

<style scoped>
.mobile-action-bar {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.mobile-action-bar-spacer { display: none; }

@media (max-width: 768px) {
  .mobile-action-bar {
    position: fixed;
    left: calc(12px + var(--safe-left));
    right: calc(12px + var(--safe-right));
    bottom: calc(76px + var(--safe-bottom));
    z-index: 260;
    margin-top: 0;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface-overlay);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 14px 40px var(--shadow-color);
  }

  .mobile-action-bar--drawer {
    bottom: max(8px, var(--safe-bottom));
    z-index: 1201;
  }

  .mobile-action-bar-spacer {
    display: block;
    height: calc(88px + var(--safe-bottom));
  }

  .mobile-action-bar-spacer--stacked {
    height: calc(132px + var(--safe-bottom));
  }

  .mobile-action-bar :slotted(.btn) {
    flex: 1;
    min-width: 0;
    justify-content: center;
  }

  .mobile-action-bar--stacked {
    flex-direction: column;
  }
}
</style>
