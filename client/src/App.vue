<template>
  <div class="app-layout" v-if="authStore.isLoggedIn">
    <AppToast />
    <ConfirmDialog />

    <div class="sidebar-overlay" :class="{ show: sidebarOpen }" @click="sidebarOpen = false"></div>

    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">
        <span class="brand-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13 Q6 8 9 9 Q11 5 12 5 Q13 5 15 9 Q18 8 20 13 Q20 18 12 20 Q4 18 4 13Z"/><circle cx="9.5" cy="13" r="1.2" fill="currentColor"/><circle cx="14.5" cy="13" r="1.2" fill="currentColor"/><path d="M5 7 L4 4M6 6 L5.5 3.5M19 7 L20 4M18 6 L18.5 3.5"/></svg>
          L¥NX
        </span>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section">{{ t('nav.sections.overview') }}</div>
        <router-link to="/" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="dashboard" class="nav-icon" />
          {{ t('nav.dashboard') }}
          <span v-if="notificationsStore.unreadCount" class="nav-badge">{{ notificationsStore.unreadCount }}</span>
        </router-link>

        <div class="nav-section">{{ t('nav.sections.management') }}</div>
        <router-link to="/assets" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="assets" class="nav-icon" />
          {{ t('nav.assets') }}
        </router-link>
        <router-link to="/holdings" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="holdings" class="nav-icon" />
          {{ t('nav.holdings') }}
        </router-link>
        <router-link to="/history" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="history" class="nav-icon" />
          {{ t('nav.history') }}
        </router-link>
        <router-link to="/alerts" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="alerts" class="nav-icon" />
          {{ t('nav.alerts') }}
          <span v-if="notificationsStore.unreadCount" class="nav-badge">{{ notificationsStore.unreadCount }}</span>
        </router-link>

        <div class="nav-section">{{ t('nav.sections.strategy') }}</div>
        <router-link to="/strategies" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="strategies" class="nav-icon" />
          {{ t('nav.strategies') }}
        </router-link>
        <router-link to="/plans" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="plans" class="nav-icon" />
          {{ t('nav.plans') }}
        </router-link>

        <div class="nav-section">{{ t('nav.sections.market') }}</div>
        <router-link to="/market" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="market" class="nav-icon" />
          {{ t('nav.market') }}
        </router-link>
        <router-link to="/signals" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="signals" class="nav-icon" />
          {{ t('nav.signals') }}
        </router-link>
        <router-link to="/news" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="news" class="nav-icon" />
          {{ t('nav.news') }}
        </router-link>

        <div class="nav-section">{{ t('nav.sections.system') }}</div>
        <router-link to="/settings" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="settings" class="nav-icon" />
          {{ t('nav.settings') }}
        </router-link>
        <router-link to="/about" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="about" class="nav-icon" />
          {{ t('nav.about') }}
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <span class="sidebar-user">{{ authStore.username }}</span>
        <button class="sidebar-logout" :title="t('nav.logoutTooltip')" @click="confirmLogout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          {{ t('nav.logout') }}
        </button>
      </div>
    </aside>

    <main class="main">
      <header class="app-shell-header">
        <div class="app-shell-header-left mobile-only">
          <button class="menu-toggle-inline mobile-only" @click="toggleSidebar" :title="t('nav.more')">
            <img class="menu-toggle-logo" src="/logo.svg" alt="Lynx" />
          </button>
        </div>
        <div class="shell-mobile-title mobile-only">
          <span class="shell-mobile-title-text">{{ mobileHeaderTitle }}</span>
        </div>
        <div class="shell-desktop-title desktop-only">
          <span class="shell-desktop-title-text">{{ mobileHeaderTitle }}</span>
        </div>
        <div class="app-shell-header-right">
          <div class="header-toolbar desktop-only">
            <label class="shell-toolbar-select" :title="t('appHeader.theme')">
              <svg class="shell-toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v4"/>
                <path d="M12 17v4"/>
                <path d="M4.93 4.93l2.83 2.83"/>
                <path d="M16.24 16.24l2.83 2.83"/>
                <path d="M3 12h4"/>
                <path d="M17 12h4"/>
                <path d="M4.93 19.07l2.83-2.83"/>
                <path d="M16.24 7.76l2.83-2.83"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
              <select
                class="form-select shell-select shell-select-compact"
                :value="preferencesStore.theme"
                :aria-label="t('appHeader.theme')"
                @change="applyTheme($event.target.value)"
              >
                <option v-for="value in preferencesStore.supportedThemes" :key="value" :value="value">{{ t(`preferences.themes.${value}`) }}</option>
              </select>
            </label>
            <label class="shell-toolbar-select" :title="t('appHeader.language')">
              <svg class="shell-toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h8"/>
                <path d="M8 3v2c0 4-2 7-4 9"/>
                <path d="M6 9c1.5 2 3.5 3.5 6 4.5"/>
                <path d="M14 15h6"/>
                <path d="M17 12v6"/>
              </svg>
              <select
                class="form-select shell-select shell-select-compact"
                :value="preferencesStore.language"
                :aria-label="t('appHeader.language')"
                @change="applyLanguage($event.target.value)"
              >
                <option v-for="value in preferencesStore.supportedLanguages" :key="value" :value="value">{{ t(`preferences.languages.${value}`) }}</option>
              </select>
            </label>
          </div>
          <button
            v-if="hasMobilePageActions"
            class="btn-icon mobile-only"
            :title="t('appHeader.pageActions')"
            :aria-label="t('appHeader.pageActions')"
            aria-haspopup="dialog"
            :aria-expanded="isMobilePageActionsOpen ? 'true' : 'false'"
            @click="openMobilePageActions"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
      </header>
      <div class="app-shell-content">
        <router-view />
      </div>
    </main>

    <nav class="mobile-nav">
      <div class="mobile-nav-inner">
        <router-link to="/" class="mobile-nav-item">
          <AppIcon name="dashboard" class="nav-icon" />
          <span>{{ t('nav.dashboard') }}</span>
        </router-link>
        <router-link to="/holdings" class="mobile-nav-item">
          <AppIcon name="holdings" class="nav-icon" />
          <span>{{ t('nav.holdings') }}</span>
        </router-link>
        <router-link to="/market" class="mobile-nav-item">
          <AppIcon name="market" class="nav-icon" />
          <span>{{ t('nav.market') }}</span>
        </router-link>
        <router-link to="/strategies" class="mobile-nav-item">
          <AppIcon name="strategies" class="nav-icon" />
          <span>{{ t('nav.strategies') }}</span>
        </router-link>
        <button class="mobile-nav-item mobile-nav-more" @click="openMoreMenu">
          <span class="mobile-nav-icon-wrap">
            <AppIcon name="more" class="nav-icon" />
            <span v-if="hasUnreadNotifications" class="mobile-nav-alert-badge">{{ mobileUnreadBadgeLabel }}</span>
          </span>
          <span>{{ t('nav.more') }}</span>
        </button>
      </div>
    </nav>

    <Teleport to="body">
      <Transition name="slide-up">
        <div v-if="moreMenuOpen" class="action-sheet-overlay" @click="moreMenuOpen = false">
          <div class="action-sheet" @click.stop>
            <div class="action-sheet-header">{{ t('nav.more') }}</div>
            <div class="action-sheet-group-label">{{ t('nav.sections.management') }}</div>
            <router-link to="/assets" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="assets" class="nav-icon" />
              {{ t('nav.assets') }}
            </router-link>
            <router-link to="/history" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="history" class="nav-icon" />
              {{ t('nav.history') }}
            </router-link>
            <router-link to="/alerts" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="alerts" class="nav-icon" />
              {{ t('nav.alerts') }}
              <span v-if="notificationsStore.unreadCount" class="nav-badge" style="margin-left:auto">{{ notificationsStore.unreadCount }}</span>
            </router-link>
            <div class="action-sheet-group-label">{{ t('nav.sections.market') }}</div>
            <router-link to="/signals" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="signals" class="nav-icon" />
              {{ t('nav.signals') }}
            </router-link>
            <router-link to="/news" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="news" class="nav-icon" />
              {{ t('nav.news') }}
            </router-link>
            <div class="action-sheet-group-label">{{ t('nav.sections.strategy') }}</div>
            <router-link to="/plans" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="plans" class="nav-icon" />
              {{ t('nav.plans') }}
            </router-link>
            <div class="action-sheet-group-label">{{ t('nav.sections.system') }}</div>
            <router-link to="/settings" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="settings" class="nav-icon" />
              {{ t('nav.settings') }}
            </router-link>
            <router-link to="/about" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="about" class="nav-icon" />
              {{ t('nav.about') }}
            </router-link>
            <div class="action-sheet-cancel" @click="moreMenuOpen = false">{{ t('common.cancel') }}</div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="slide-up">
        <div v-if="showMobilePageActionsSheet" class="action-sheet-overlay" @click="closeMobilePageActions">
          <div class="action-sheet" @click.stop>
            <div class="action-sheet-header">{{ t('appHeader.pageActions') }}</div>
            <template v-for="(action, index) in safeMobilePageActions" :key="action.key || `mobile-page-action-${index}`">
              <router-link
                v-if="action.to"
                :to="action.to"
                class="action-sheet-item"
                :class="{ danger: action.danger }"
                @click="closeMobilePageActions"
              >
                <span>{{ action.label }}</span>
              </router-link>
              <button
                v-else
                class="action-sheet-item action-sheet-item-button"
                :class="{ danger: action.danger }"
                :disabled="action.disabled"
                @click="handleMobilePageAction(action)"
              >
                <span>{{ action.label }}</span>
              </button>
            </template>
            <div class="action-sheet-cancel" @click="closeMobilePageActions">{{ t('common.cancel') }}</div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
  <div v-else>
    <AppToast />
    <ConfirmDialog />
    <router-view />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from './stores/auth.js'
import { useNotificationsStore } from './stores/notifications.js'
import { usePreferencesStore } from './stores/preferences.js'
import { useRuntimeSettingsStore } from './stores/runtime-settings.js'
import { useMobilePageActionsState } from './composables/useMobilePageActions.js'
import { useDocumentScrollLock } from './composables/useDocumentScrollLock.js'
import { useConfirm } from './utils/confirm.js'
import { useToast } from './utils/toast.js'
import AppToast from './components/AppToast.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import AppIcon from './components/AppIcon.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const preferencesStore = usePreferencesStore()
const runtimeSettingsStore = useRuntimeSettingsStore()
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()
const sidebarOpen = ref(false)
const moreMenuOpen = ref(false)
const {
  actions: mobilePageActionItems,
  isOpen: isMobilePageActionsOpen,
  hasActions: hasMobilePageActions,
  openActions: openMobilePageActions,
  closeActions: closeMobilePageActions,
  resetActions: resetMobilePageActions,
} = useMobilePageActionsState()
let pollTimer

function shouldAllowContextMenu(target) {
  return !!target?.closest?.('input, textarea, select, [contenteditable="true"], .allow-context-menu')
}

function shouldSuppressContextMenu() {
  const standalone = document.documentElement.dataset.displayMode === 'standalone'
  const touchLayout = window.matchMedia?.('(max-width: 768px)')?.matches && navigator.maxTouchPoints > 0
  return standalone || touchLayout
}

function preventLongPressContextMenu(event) {
  if (!shouldSuppressContextMenu() || shouldAllowContextMenu(event.target)) return
  event.preventDefault()
}

const mobileHeaderTitle = computed(() => {
  const titleKey = route.meta?.titleKey
  return titleKey ? t(titleKey) : 'L¥NX'
})

const safeMobilePageActions = computed(() => {
  const actions = Array.isArray(mobilePageActionItems.value) ? mobilePageActionItems.value : []
  return actions.filter((action) => action && action.label && (action.to || action.onSelect))
})

const showMobilePageActionsSheet = computed(() => isMobilePageActionsOpen.value && safeMobilePageActions.value.length > 0)
const hasUnreadNotifications = computed(() => notificationsStore.unreadCount > 0)
const mobileUnreadBadgeLabel = computed(() => (
  notificationsStore.unreadCount > 99 ? '99+' : String(notificationsStore.unreadCount || 0)
))
const shellOverlayOpen = computed(() => sidebarOpen.value || moreMenuOpen.value || showMobilePageActionsSheet.value)

useDocumentScrollLock(shellOverlayOpen)

async function syncPreferences() {
  try {
    const settings = await runtimeSettingsStore.syncFromServer()
    preferencesStore.applyServerSettings(settings)
  } catch {}
}

function doLogout() {
  authStore.logout()
  router.push('/login')
}

function toggleSidebar() {
  moreMenuOpen.value = false
  closeMobilePageActions()
  sidebarOpen.value = !sidebarOpen.value
}

function openMoreMenu() {
  sidebarOpen.value = false
  closeMobilePageActions()
  moreMenuOpen.value = true
}

async function confirmLogout() {
  const ok = await confirm({
    title: t('nav.logoutTitle'),
    message: t('nav.logoutMessage'),
    confirmText: t('nav.logoutConfirm'),
    cancelText: t('common.cancel'),
    icon: 'logout',
    danger: true,
  })
  if (ok) doLogout()
}

async function applyTheme(value) {
  try {
    await preferencesStore.setTheme(value, { persistServer: true })
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
  }
}

async function applyLanguage(value) {
  try {
    await preferencesStore.setLanguage(value, { persistServer: true })
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
  }
}

async function handleMobilePageAction(action) {
  if (!action || action.disabled) return
  closeMobilePageActions()
  if (action.onSelect) {
    await action.onSelect()
  }
}

function resolveRefreshIntervalMs() {
  const seconds = Math.max(0, Math.trunc(runtimeSettingsStore.getNumber('refresh_interval', 60)))
  return seconds * 1000
}

async function startPolling() {
  stopPolling()
  await notificationsStore.fetchUnreadCount().catch(() => {})
  const intervalMs = resolveRefreshIntervalMs()
  if (intervalMs > 0) {
    pollTimer = setInterval(() => {
      notificationsStore.fetchUnreadCount().catch(() => {})
    }, intervalMs)
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(() => authStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    syncPreferences()
    startPolling()
  } else {
    stopPolling()
    notificationsStore.reset()
  }
})

watch(() => runtimeSettingsStore.values.refresh_interval, (nextValue, prevValue) => {
  if (!authStore.isLoggedIn || nextValue === prevValue) return
  startPolling()
})

watch(() => route.fullPath, () => {
  sidebarOpen.value = false
  moreMenuOpen.value = false
  resetMobilePageActions()
})

onMounted(() => {
  document.addEventListener('contextmenu', preventLongPressContextMenu, { capture: true })
  resetMobilePageActions()
  if (authStore.isLoggedIn) {
    syncPreferences()
    startPolling()
  }
})

onUnmounted(() => {
  document.removeEventListener('contextmenu', preventLongPressContextMenu, { capture: true })
  stopPolling()
})
</script>

<style scoped>
.brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}
.brand-logo svg { color: var(--primary); }
.sidebar-brand {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.app-shell-header {
  position: sticky;
  top: 0;
  z-index: 140;
  display: flex;
  align-items: center;
   justify-content: flex-end;
   gap: 16px;
    margin-bottom: var(--mobile-shell-header-gap, 18px);
    padding: 8px 0 10px;
    background: var(--surface-overlay);
    border-bottom: 1px solid var(--border);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.app-shell-content {
  min-width: 0;
}
.app-shell-header-left,
.app-shell-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}
.app-shell-header-right {
  margin-left: auto;
  min-width: 0;
}
.shell-preferences-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 84px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.shell-preferences-trigger-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}
.shell-mobile-title {
  min-width: 0;
  flex: 1 1 auto;
  justify-content: center;
}
.shell-mobile-title-text {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.shell-desktop-title {
  min-width: 0;
  flex: 1 1 auto;
}
.shell-desktop-title-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}
.header-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.shell-toolbar-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 10px;
  min-height: 34px;
  border: 1px solid var(--border);
  border-radius: 999px;
   background: var(--bg-card);
   color: var(--text-dim);
}
.shell-toolbar-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.85;
}
.shell-select-compact {
  width: auto;
  min-width: 84px;
  padding: 6px 18px 6px 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font-size: 12px;
}
.shell-select-compact:focus {
  border: none;
  outline: none;
}
@media (min-width: 769px) {
  .app-shell-header {
    position: static;
    margin-bottom: 12px;
    padding: 0 0 8px;
    background: transparent;
    border-bottom: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
.menu-toggle-inline {
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
}
.menu-toggle-logo {
  width: 21px;
  height: 21px;
  display: block;
  object-fit: contain;
  border-radius: 6px;
}
.action-sheet-header {
  padding: 12px calc(24px + var(--safe-right)) 8px calc(24px + var(--safe-left));
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
}
.action-sheet-group-label {
  padding: 12px calc(24px + var(--safe-right)) 6px calc(24px + var(--safe-left));
  font-size: 12px;
  color: var(--text-muted);
}
.action-sheet-item.active {
  color: var(--blue);
  font-weight: 600;
}
.action-sheet-item-button {
  width: 100%;
  border: none;
  background: none;
  text-align: left;
  font: inherit;
}
.theme-preview,
.theme-option-preview {
  display: grid;
  grid-template-columns: 0.9fr 1.2fr;
  grid-template-rows: 0.8fr 1.2fr;
  gap: 2px;
  overflow: hidden;
}
.theme-preview {
  width: 18px;
  height: 14px;
  flex-shrink: 0;
}
.theme-option-preview {
  width: 100%;
  height: 46px;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-hover) 70%, transparent);
}
.theme-preview-pane {
  display: block;
  border-radius: 6px;
}
.theme-preview-pane-sidebar {
  grid-row: 1 / span 2;
}
.theme-preview-pane-header,
.theme-preview-pane-body {
  grid-column: 2;
}
.theme-preview--dark .theme-preview-pane-sidebar {
  background: #0f172a;
}
.theme-preview--dark .theme-preview-pane-header {
  background: #1e293b;
}
.theme-preview--dark .theme-preview-pane-body {
  background: #111827;
}
.theme-preview--light .theme-preview-pane-sidebar {
  background: #e2e8f0;
}
.theme-preview--light .theme-preview-pane-header {
  background: #ffffff;
}
.theme-preview--light .theme-preview-pane-body {
  background: #f8fafc;
}
.theme-preview--transparent .theme-preview-pane-sidebar {
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.45), rgba(15, 23, 42, 0.55));
}
.theme-preview--transparent .theme-preview-pane-header {
  background: rgba(255, 255, 255, 0.45);
}
.theme-preview--transparent .theme-preview-pane-body {
  background: rgba(15, 23, 42, 0.18);
}
.theme-preview--purple .theme-preview-pane-sidebar {
  background: #4c1d95;
}
.theme-preview--purple .theme-preview-pane-header {
  background: #6d28d9;
}
.theme-preview--purple .theme-preview-pane-body {
  background: #2e1065;
}
.theme-sheet {
  padding-top: 10px;
}
.theme-sheet-current {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 0 calc(24px + var(--safe-right)) 16px calc(24px + var(--safe-left));
}
.theme-sheet-current-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.theme-sheet-eyebrow {
  font-size: 12px;
  color: var(--text-muted);
}
.theme-sheet-current-name {
  font-size: 18px;
  line-height: 1.2;
  color: var(--text);
}
.theme-sheet-current-hint {
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-dim);
}
.theme-sheet-settings-link {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--blue) 12%, transparent);
  color: var(--blue);
  text-decoration: none;
  white-space: nowrap;
}
.theme-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 0 calc(24px + var(--safe-right)) 16px calc(24px + var(--safe-left));
}
.theme-option-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.theme-option-card.active {
  border-color: color-mix(in srgb, var(--blue) 45%, var(--border));
  background: color-mix(in srgb, var(--blue) 10%, var(--bg-card));
  box-shadow: 0 10px 24px color-mix(in srgb, var(--blue) 12%, transparent);
}
.theme-option-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}
.theme-option-label {
  font-size: 14px;
  font-weight: 600;
}
.theme-option-check {
  color: var(--blue);
  font-size: 14px;
  line-height: 1;
}
.theme-sheet-note {
  padding: 0 calc(24px + var(--safe-right)) 12px calc(24px + var(--safe-left));
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}
.sidebar-logout {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
  color: var(--text-muted);
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-family: inherit;
  border-radius: 4px;
}
.sidebar-logout:hover { opacity: 1; color: var(--red); }
.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sidebar-user {
  font-size: 12px;
  color: var(--text-muted);
}
.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.nav-badge {
  margin-left: auto;
  background: var(--red);
  color: #fff;
  font-size: 10px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
.mobile-nav-more .mobile-nav-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.mobile-nav-alert-badge {
  position: absolute;
  top: -6px;
  right: -12px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--red);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--bg-card);
}
button.mobile-nav-item {
  background: none;
  border: none;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
@media (max-width: 768px) {
  .app-shell-header {
    margin:
      0
      calc(-1 * (16px + var(--safe-right)))
      var(--mobile-shell-header-gap, 18px)
      calc(-1 * (16px + var(--safe-left)));
    padding:
      calc(10px + var(--safe-top))
      calc(16px + var(--safe-right))
      10px
      calc(16px + var(--safe-left));
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 84px;
    align-items: center;
    justify-content: stretch;
    gap: 10px;
  }
  .app-shell-content {
    padding-top: var(--mobile-shell-content-gap, 8px);
  }
  .app-shell-header-left,
  .app-shell-header-right {
    width: auto;
    min-width: 0;
  }
  .app-shell-header-right {
    justify-content: flex-end;
  }
  .header-toolbar {
    display: none;
  }
  .theme-sheet-current {
    flex-direction: column;
  }
  .theme-sheet-settings-link {
    align-self: flex-start;
  }
}
</style>
