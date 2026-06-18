<template>
  <svg
    class="app-icon"
    :class="[`app-icon--${name}`, $attrs.class]"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'dashboard'">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </template>
    <template v-else-if="name === 'assets'">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8" />
      <path d="M9 11l3-3 3 3" />
    </template>
    <template v-else-if="name === 'holdings'">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
      <path d="M9 15h6" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'alerts'">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </template>
    <template v-else-if="name === 'strategies'">
      <path d="M4 18h4l3-11 4 14 3-9h2" />
      <path d="M4 6h4" />
    </template>
    <template v-else-if="name === 'plans'">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </template>
    <template v-else-if="name === 'market'">
      <path d="M3 17 9 11l4 4 7-8" />
      <path d="M14 7h6v6" />
    </template>
    <template v-else-if="name === 'signals'">
      <path d="M3 12h3l2 5 4-10 3 7 2-4h4" />
      <path d="M4 19h16" />
    </template>
    <template v-else-if="name === 'news'">
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v15" />
      <path d="M4 19.5V8h2" />
      <path d="M10 8h8" />
      <path d="M10 12h8" />
      <path d="M10 16h5" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </template>
    <template v-else-if="name === 'about'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </template>
    <template v-else-if="name === 'more'">
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'sparkles'">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
      <path d="M5 15l.7 1.8L7.5 17.5l-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7L5 15z" />
    </template>
    <template v-else-if="name === 'buy'">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
      <path d="M5 21h14" />
    </template>
    <template v-else-if="name === 'sell'">
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
      <path d="M5 3h14" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 3 19 6v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </template>
    <template v-else-if="name === 'balance'">
      <path d="M12 3v18" />
      <path d="M5 6h14" />
      <path d="M6 6l-3 7h6L6 6z" />
      <path d="M18 6l-3 7h6l-3-7z" />
    </template>
    <template v-else-if="name === 'trend'">
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M16 7h5v5" />
    </template>
    <template v-else-if="name === 'growth'">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7 15l4-4 3 3 5-7" />
      <path d="M15 7h4v4" />
    </template>
    <template v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="M20 6 9 17l-5-5" />
    </template>
    <template v-else-if="name === 'x'">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </template>
    <template v-else-if="name === 'edit'">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </template>
    <template v-else-if="name === 'pin'">
      <path d="M14 4l6 6" />
      <path d="M12 6 7 11l-3 1 8 8 1-3 5-5" />
      <path d="M9 15l-5 5" />
    </template>
    <template v-else-if="name === 'tool'">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-3-3 2.8-2.8z" />
    </template>
    <template v-else-if="name === 'plug'">
      <path d="M9 7V3" />
      <path d="M15 7V3" />
      <path d="M7 7h10v4a5 5 0 0 1-10 0V7z" />
      <path d="M12 16v2a3 3 0 0 1-3 3H7" />
      <path d="M5 21h2" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="M6 9l6 6 6-6" />
    </template>
    <template v-else-if="name === 'chevron-right'">
      <path d="M9 6l6 6-6 6" />
    </template>
    <template v-else-if="name === 'box'">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </template>
    <template v-else-if="name === 'backtest'">
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 4 3 4-7" />
      <path d="M15 7h3v3" />
    </template>
    <template v-else-if="name === 'stress-test'">
      <path d="M9 3h6" />
      <path d="M10 9h4" />
      <path d="M8 3v3.5a1 1 0 0 0 .3.7l5.4 5.4a4 4 0 1 1-5.66 5.66l-5.4-5.4A1 1 0 0 1 2 12.16V3h6" />
      <path d="M14 3v3.5a1 1 0 0 1-.3.7l-.7.7" />
    </template>
    <template v-else-if="name === 'review'">
      <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <path d="M8 17h7" />
    </template>
    <template v-else-if="name === 'chat'">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </template>
  </svg>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 18 },
  strokeWidth: { type: [Number, String], default: 1.8 },
})
</script>

<style scoped>
.app-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: -0.18em;
}
</style>

