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
        <router-link to="/data-sources" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="market" class="nav-icon" />
          {{ t('nav.dataSources') }}
        </router-link>
        <router-link to="/market-data-rules" class="nav-item" @click="sidebarOpen = false">
          <AppIcon name="plug" class="nav-icon" />
          {{ t('nav.marketDataRules') }}
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
            <div ref="themeMenuRef" class="shell-preference-menu" :class="{ open: themeMenuOpen }">
              <button
                type="button"
                class="shell-preference-trigger shell-preference-trigger--theme"
                :title="t('appHeader.theme')"
                aria-haspopup="menu"
                :aria-expanded="themeMenuOpen ? 'true' : 'false'"
                @click="toggleThemeMenu"
              >
                <span class="theme-preview" :class="`theme-preview--${currentThemeOption.value}`" aria-hidden="true">
                  <span class="theme-preview-pane theme-preview-pane-sidebar"></span>
                  <span class="theme-preview-pane theme-preview-pane-header"></span>
                  <span class="theme-preview-pane theme-preview-pane-body"></span>
                </span>
                <span class="shell-preference-trigger-copy">
                  <span class="shell-preference-kicker">{{ t('appHeader.theme') }}</span>
                  <strong>{{ currentThemeOption.label }}</strong>
                </span>
                <svg class="shell-preference-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <Transition name="shell-menu">
                <div v-if="themeMenuOpen" class="shell-preference-popover shell-theme-popover" role="menu" :aria-label="t('appHeader.theme')">
                  <div class="shell-popover-header">
                    <span>{{ t('appHeader.themeQuickSwitch') }}</span>
                    <small>{{ t('appHeader.themePanelHint') }}</small>
                  </div>
                  <div class="shell-theme-menu-grid">
                    <button
                      v-for="option in themeOptions"
                      :key="option.value"
                      type="button"
                      class="shell-theme-menu-item"
                      :class="{ active: preferencesStore.theme === option.value }"
                      role="menuitemradio"
                      :aria-checked="preferencesStore.theme === option.value ? 'true' : 'false'"
                      @click="selectTheme(option.value)"
                    >
                      <span class="theme-option-preview" :class="`theme-preview--${option.value}`" aria-hidden="true">
                        <span class="theme-preview-pane theme-preview-pane-sidebar"></span>
                        <span class="theme-preview-pane theme-preview-pane-header"></span>
                        <span class="theme-preview-pane theme-preview-pane-body"></span>
                      </span>
                      <span class="shell-theme-menu-meta">
                        <strong>{{ option.fullLabel }}</strong>
                        <small>{{ option.label }}</small>
                      </span>
                      <span v-if="preferencesStore.theme === option.value" class="shell-menu-check" aria-hidden="true">✓</span>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
            <div ref="languageMenuRef" class="shell-preference-menu" :class="{ open: languageMenuOpen }">
              <button
                type="button"
                class="shell-preference-trigger shell-preference-trigger--language"
                :title="t('appHeader.language')"
                aria-haspopup="menu"
                :aria-expanded="languageMenuOpen ? 'true' : 'false'"
                @click="toggleLanguageMenu"
              >
                <span class="language-flag language-flag--current" aria-hidden="true">{{ currentLanguageOption.flag }}</span>
                <span class="shell-preference-trigger-copy">
                  <span class="shell-preference-kicker">{{ t('appHeader.language') }}</span>
                  <strong>{{ currentLanguageOption.shortLabel }}</strong>
                </span>
                <svg class="shell-preference-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <Transition name="shell-menu">
                <div v-if="languageMenuOpen" class="shell-preference-popover shell-language-popover" role="menu" :aria-label="t('appHeader.language')">
                  <div class="shell-popover-header shell-popover-header--compact">
                    <span>{{ t('appHeader.language') }}</span>
                  </div>
                  <div class="shell-language-menu-list">
                    <button
                      v-for="option in languageOptions"
                      :key="option.value"
                      type="button"
                      class="shell-language-menu-item"
                      :class="{ active: preferencesStore.language === option.value }"
                      role="menuitemradio"
                      :aria-checked="preferencesStore.language === option.value ? 'true' : 'false'"
                      @click="selectLanguage(option.value)"
                    >
                      <span class="language-flag" aria-hidden="true">{{ option.flag }}</span>
                      <span class="shell-language-menu-copy">
                        <strong>{{ option.label }}</strong>
                        <small>{{ option.shortLabel }}</small>
                      </span>
                      <span v-if="preferencesStore.language === option.value" class="shell-menu-check" aria-hidden="true">✓</span>
                    </button>
                  </div>
                </div>
              </Transition>
            </div>
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
            <router-link to="/data-sources" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="market" class="nav-icon" />
              {{ t('nav.dataSources') }}
            </router-link>
            <router-link to="/market-data-rules" class="action-sheet-item" @click="moreMenuOpen = false">
              <AppIcon name="plug" class="nav-icon" />
              {{ t('nav.marketDataRules') }}
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
const themeMenuOpen = ref(false)
const languageMenuOpen = ref(false)
const themeMenuRef = ref(null)
const languageMenuRef = ref(null)
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
const languageFlagMap = { 'zh-CN': '🇨🇳', 'en-US': '🇺🇸' }
const languageShortLabelMap = { 'zh-CN': '中文', 'en-US': 'EN' }
const themeOptions = computed(() => preferencesStore.supportedThemes.map((value) => ({
  value,
  label: t(`appHeader.themeShort.${value}`),
  fullLabel: t(`preferences.themes.${value}`),
})))
const languageOptions = computed(() => preferencesStore.supportedLanguages.map((value) => ({
  value,
  flag: languageFlagMap[value] || '🌐',
  label: t(`preferences.languages.${value}`),
  shortLabel: languageShortLabelMap[value] || t(`preferences.languages.${value}`),
})))
const currentThemeOption = computed(() => (
  themeOptions.value.find((option) => option.value === preferencesStore.theme)
  || themeOptions.value[0]
  || { value: 'dark', label: t('appHeader.theme'), fullLabel: t('appHeader.theme') }
))
const currentLanguageOption = computed(() => (
  languageOptions.value.find((option) => option.value === preferencesStore.language)
  || languageOptions.value[0]
  || { value: 'zh-CN', flag: '🌐', label: t('appHeader.language'), shortLabel: t('appHeader.language') }
))

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
  closePreferenceMenus()
  sidebarOpen.value = !sidebarOpen.value
}

function openMoreMenu() {
  sidebarOpen.value = false
  closeMobilePageActions()
  closePreferenceMenus()
  moreMenuOpen.value = true
}

function closePreferenceMenus() {
  themeMenuOpen.value = false
  languageMenuOpen.value = false
}

function toggleThemeMenu() {
  themeMenuOpen.value = !themeMenuOpen.value
  languageMenuOpen.value = false
}

function toggleLanguageMenu() {
  languageMenuOpen.value = !languageMenuOpen.value
  themeMenuOpen.value = false
}

function handlePreferenceOutsideClick(event) {
  if (!themeMenuOpen.value && !languageMenuOpen.value) return
  const target = event.target
  if (themeMenuRef.value?.contains(target) || languageMenuRef.value?.contains(target)) return
  closePreferenceMenus()
}

function handlePreferenceEscape(event) {
  if (event.key !== 'Escape') return
  closePreferenceMenus()
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

async function selectTheme(value) {
  await applyTheme(value)
  themeMenuOpen.value = false
}

async function applyLanguage(value) {
  try {
    await preferencesStore.setLanguage(value, { persistServer: true })
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
  }
}

async function selectLanguage(value) {
  await applyLanguage(value)
  languageMenuOpen.value = false
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
  closePreferenceMenus()
  resetMobilePageActions()
})

onMounted(() => {
  document.addEventListener('contextmenu', preventLongPressContextMenu, { capture: true })
  document.addEventListener('click', handlePreferenceOutsideClick, { capture: true })
  document.addEventListener('keydown', handlePreferenceEscape)
  resetMobilePageActions()
  if (authStore.isLoggedIn) {
    syncPreferences()
    startPolling()
  }
})

onUnmounted(() => {
  document.removeEventListener('contextmenu', preventLongPressContextMenu, { capture: true })
  document.removeEventListener('click', handlePreferenceOutsideClick, { capture: true })
  document.removeEventListener('keydown', handlePreferenceEscape)
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
.shell-preference-menu {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.shell-preference-trigger {
  display: inline-grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 14px;
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--blue) 16%, transparent), transparent 40%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 97%, white 3%), var(--bg-card));
  color: var(--text);
  font: inherit;
  cursor: pointer;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--shadow-color) 28%, transparent);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
}
.shell-preference-trigger--theme {
  width: 142px;
}
.shell-preference-trigger--language {
  width: 116px;
}
.shell-preference-trigger:hover,
.shell-preference-menu.open .shell-preference-trigger {
  border-color: color-mix(in srgb, var(--blue) 44%, var(--border));
  box-shadow: 0 14px 32px color-mix(in srgb, var(--blue) 14%, transparent), 0 12px 28px color-mix(in srgb, var(--shadow-color) 26%, transparent);
}
.shell-preference-trigger:active {
  transform: translateY(1px) scale(0.99);
}
.shell-preference-trigger-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1;
}
.shell-preference-trigger-copy strong,
.shell-theme-menu-meta strong,
.shell-language-menu-copy strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}
.shell-preference-kicker,
.shell-theme-menu-meta small,
.shell-language-menu-copy small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}
.shell-preference-caret {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  transition: transform 0.18s ease, color 0.18s ease;
}
.shell-preference-menu.open .shell-preference-caret {
  transform: rotate(180deg);
  color: var(--blue);
}
.shell-preference-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 260;
  width: min(360px, calc(100vw - 32px));
  max-height: min(70vh, 520px);
  overflow: auto;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
  border-radius: 20px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 96%, var(--bg) 4%), var(--bg-card));
  box-shadow: 0 22px 60px color-mix(in srgb, var(--shadow-color) 48%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.shell-preference-popover::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 24px;
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border-top: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
  background: color-mix(in srgb, var(--bg-card) 98%, var(--bg) 2%);
}
.shell-language-popover {
  width: min(248px, calc(100vw - 32px));
}
.shell-popover-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 4px 12px;
}
.shell-popover-header--compact {
  padding-bottom: 8px;
}
.shell-popover-header span {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.shell-popover-header small {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-muted);
}
.shell-theme-menu-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.shell-theme-menu-item,
.shell-language-menu-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--bg-hover) 52%, transparent);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}
.shell-theme-menu-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 9px;
  padding: 9px;
  border-radius: 16px;
  text-align: left;
}
.shell-language-menu-list {
  display: flex;
  max-height: min(46vh, 360px);
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}
.shell-language-menu-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border-radius: 14px;
  text-align: left;
}
.shell-theme-menu-item:hover,
.shell-language-menu-item:hover {
  background: color-mix(in srgb, var(--bg-hover) 82%, transparent);
  transform: translateY(-1px);
}
.shell-theme-menu-item.active,
.shell-language-menu-item.active {
  border-color: color-mix(in srgb, var(--blue) 38%, var(--border));
  background: color-mix(in srgb, var(--blue) 14%, var(--bg-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--blue) 14%, transparent), 0 6px 16px color-mix(in srgb, var(--blue) 12%, transparent);
}
.shell-theme-menu-meta,
.shell-language-menu-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.shell-menu-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--blue) 18%, transparent);
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
}
.language-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg-hover) 78%, transparent);
  font-size: 13px;
  line-height: 1;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent);
}
.language-flag--current {
  width: 20px;
  height: 20px;
}
.shell-menu-enter-active,
.shell-menu-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.shell-menu-enter-from,
.shell-menu-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
@media (min-width: 769px) {
  .app-shell-header {
    position: sticky;
    top: 0;
    z-index: 220;
    margin: -24px -24px 18px;
    padding: 24px 24px 12px;
    background:
      linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 94%, transparent) 72%, transparent 100%);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
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
  border-radius: 5px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--border) 76%, transparent);
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
}
</style>
