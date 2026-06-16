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
          <svg class="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          {{ t('nav.dashboard') }}
          <span v-if="notificationsStore.unreadCount" class="nav-badge">{{ notificationsStore.unreadCount }}</span>
        </router-link>

        <div class="nav-section">{{ t('nav.sections.management') }}</div>
        <router-link to="/assets" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11l3-3 3 3"/></svg>
          {{ t('nav.assets') }}
        </router-link>
        <router-link to="/holdings" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
          {{ t('nav.holdings') }}
        </router-link>
        <router-link to="/history" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ t('nav.history') }}
        </router-link>
        <router-link to="/alerts" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
          {{ t('nav.alerts') }}
          <span v-if="notificationsStore.unreadCount" class="nav-badge">{{ notificationsStore.unreadCount }}</span>
        </router-link>

        <div class="nav-section">{{ t('nav.sections.strategy') }}</div>
        <router-link to="/strategies" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          {{ t('nav.strategies') }}
        </router-link>
        <router-link to="/plans" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          {{ t('nav.plans') }}
        </router-link>

        <div class="nav-section">{{ t('nav.sections.market') }}</div>
        <router-link to="/market" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          {{ t('nav.market') }}
        </router-link>
        <router-link to="/signals" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 12h3l2 5 4-10 3 7 2-4h4"/></svg>
          {{ t('nav.signals') }}
        </router-link>
        <router-link to="/news" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M18 18h-8M18 10h-8"/></svg>
          {{ t('nav.news') }}
        </router-link>

        <div class="nav-section">{{ t('nav.sections.system') }}</div>
        <router-link to="/settings" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          {{ t('nav.settings') }}
        </router-link>
        <router-link to="/about" class="nav-item" @click="sidebarOpen = false">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/></svg>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
        </div>
        <div class="shell-mobile-title mobile-only">
          <span class="shell-mobile-title-text">{{ mobileHeaderTitle }}</span>
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
            class="shell-preferences-trigger mobile-only"
            :title="t('appHeader.theme')"
            :aria-label="t('appHeader.preferences')"
            aria-haspopup="dialog"
            :aria-expanded="preferencesMenuOpen ? 'true' : 'false'"
            @click="openPreferencesMenu"
          >
            <span class="theme-preview" :class="`theme-preview--${preferencesStore.theme}`" aria-hidden="true">
              <span class="theme-preview-pane theme-preview-pane-sidebar"></span>
              <span class="theme-preview-pane theme-preview-pane-header"></span>
              <span class="theme-preview-pane theme-preview-pane-body"></span>
            </span>
            <span class="shell-preferences-trigger-label">{{ currentMobileThemeLabel }}</span>
          </button>
        </div>
      </header>
      <router-view />
    </main>

    <nav class="mobile-nav">
      <div class="mobile-nav-inner">
        <router-link to="/" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span>{{ t('nav.dashboard') }}</span>
        </router-link>
        <router-link to="/holdings" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
          <span>{{ t('nav.holdings') }}</span>
        </router-link>
        <router-link to="/market" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>{{ t('nav.market') }}</span>
        </router-link>
        <router-link to="/strategies" class="mobile-nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
          <span>{{ t('nav.strategies') }}</span>
        </router-link>
        <button class="mobile-nav-item" @click="openMoreMenu">
          <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
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
              <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11l3-3 3 3"/></svg>
              {{ t('nav.assets') }}
            </router-link>
            <router-link to="/history" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {{ t('nav.history') }}
            </router-link>
            <router-link to="/alerts" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
              {{ t('nav.alerts') }}
              <span v-if="notificationsStore.unreadCount" class="nav-badge" style="margin-left:auto">{{ notificationsStore.unreadCount }}</span>
            </router-link>
            <div class="action-sheet-group-label">{{ t('nav.sections.market') }}</div>
            <router-link to="/signals" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 12h3l2 5 4-10 3 7 2-4h4"/></svg>
              {{ t('nav.signals') }}
            </router-link>
            <router-link to="/news" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M18 18h-8M18 10h-8"/></svg>
              {{ t('nav.news') }}
            </router-link>
            <div class="action-sheet-group-label">{{ t('nav.sections.strategy') }}</div>
            <router-link to="/plans" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              {{ t('nav.plans') }}
            </router-link>
            <div class="action-sheet-group-label">{{ t('nav.sections.system') }}</div>
            <router-link to="/settings" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              {{ t('nav.settings') }}
            </router-link>
            <router-link to="/about" class="action-sheet-item" @click="moreMenuOpen = false">
              <svg class="nav-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/></svg>
              {{ t('nav.about') }}
            </router-link>
            <div class="action-sheet-cancel" @click="moreMenuOpen = false">{{ t('common.cancel') }}</div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="slide-up">
        <div v-if="preferencesMenuOpen" class="action-sheet-overlay" @click="preferencesMenuOpen = false">
          <div class="action-sheet theme-sheet" @click.stop>
            <div class="action-sheet-header">{{ t('appHeader.preferences') }}</div>
            <div class="theme-sheet-current">
              <div class="theme-sheet-current-copy">
                <span class="theme-sheet-eyebrow">{{ t('appHeader.currentTheme') }}</span>
                <strong class="theme-sheet-current-name">{{ t(`preferences.themes.${preferencesStore.theme}`) }}</strong>
                <span class="theme-sheet-current-hint">{{ t('appHeader.themePanelHint') }}</span>
              </div>
              <router-link to="/settings" class="theme-sheet-settings-link" @click="preferencesMenuOpen = false">
                {{ t('appHeader.openDisplaySettings') }}
              </router-link>
            </div>
            <div class="theme-option-grid">
              <button
                v-for="option in mobileThemeOptions"
                :key="`theme-${option.value}`"
                class="theme-option-card"
                :class="{ active: preferencesStore.theme === option.value }"
                @click="applyTheme(option.value, { closeMenu: true })"
              >
                <span class="theme-option-preview" :class="`theme-preview--${option.value}`" aria-hidden="true">
                  <span class="theme-preview-pane theme-preview-pane-sidebar"></span>
                  <span class="theme-preview-pane theme-preview-pane-header"></span>
                  <span class="theme-preview-pane theme-preview-pane-body"></span>
                </span>
                <span class="theme-option-meta">
                  <span class="theme-option-label">{{ option.label }}</span>
                  <span v-if="preferencesStore.theme === option.value" class="theme-option-check">✓</span>
                </span>
              </button>
            </div>
            <div class="theme-sheet-note">{{ t('appHeader.languageManagedInSettings') }}</div>
            <div class="action-sheet-cancel" @click="preferencesMenuOpen = false">{{ t('common.cancel') }}</div>
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
import { useConfirm } from './utils/confirm.js'
import { useToast } from './utils/toast.js'
import AppToast from './components/AppToast.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

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
const preferencesMenuOpen = ref(false)
let pollTimer

const mobileHeaderTitle = computed(() => {
  const titleKey = route.meta?.titleKey
  return titleKey ? t(titleKey) : 'L¥NX'
})

const currentMobileThemeLabel = computed(() => t(`appHeader.themeShort.${preferencesStore.theme}`))

const mobileThemeOptions = computed(() => (
  preferencesStore.supportedThemes.map((value) => ({
    value,
    label: t(`preferences.themes.${value}`),
  }))
))

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
  preferencesMenuOpen.value = false
  sidebarOpen.value = !sidebarOpen.value
}

function openMoreMenu() {
  sidebarOpen.value = false
  preferencesMenuOpen.value = false
  moreMenuOpen.value = true
}

function openPreferencesMenu() {
  sidebarOpen.value = false
  moreMenuOpen.value = false
  preferencesMenuOpen.value = true
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

async function applyTheme(value, { closeMenu = false } = {}) {
  try {
    await preferencesStore.setTheme(value, { persistServer: true })
    if (closeMenu) preferencesMenuOpen.value = false
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
  }
}

async function applyLanguage(value, { closeMenu = false } = {}) {
  try {
    await preferencesStore.setLanguage(value, { persistServer: true })
    if (closeMenu) preferencesMenuOpen.value = false
  } catch (error) {
    toast.error(error.message || t('common.saveFailed'))
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
  preferencesMenuOpen.value = false
})

onMounted(() => {
  if (authStore.isLoggedIn) {
    syncPreferences()
    startPolling()
  }
})

onUnmounted(() => {
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
   margin-bottom: 18px;
   padding: 8px 0 10px;
   background: var(--surface-overlay);
   border-bottom: 1px solid var(--border);
   backdrop-filter: blur(14px);
   -webkit-backdrop-filter: blur(14px);
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
.action-sheet-header {
  padding: 12px 24px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
}
.action-sheet-group-label {
  padding: 12px 24px 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.action-sheet-item.active {
  color: var(--blue);
  font-weight: 600;
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
  padding: 0 24px 16px;
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
  padding: 0 24px 16px;
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
  padding: 0 24px 12px;
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
button.mobile-nav-item {
  background: none;
  border: none;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}
@media (max-width: 768px) {
  .app-shell-header {
    margin: calc(-0px - var(--safe-top)) -16px 16px;
    padding: calc(10px + var(--safe-top)) 16px 10px;
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr) 84px;
    align-items: center;
    justify-content: stretch;
    gap: 10px;
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
