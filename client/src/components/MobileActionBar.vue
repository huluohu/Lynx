<template>
  <div class="mobile-action-bar" :class="{ 'mobile-action-bar--stacked': stacked }">
    <slot />
  </div>
</template>

<script setup>
defineProps({
  stacked: Boolean,
})
</script>

<style scoped>
.mobile-action-bar {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .mobile-action-bar {
    position: sticky;
    bottom: calc(12px + var(--safe-bottom));
    z-index: 180;
    margin-top: 20px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface-overlay);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 14px 40px var(--shadow-color);
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
