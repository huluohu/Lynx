import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../utils/api.js'
import { detectBrowserLocale, getSupportedLanguages, normalizeLocale, setLocale } from '../i18n/index.js'

const THEME_STORAGE_KEY = 'lynx:theme'
const LANGUAGE_STORAGE_KEY = 'lynx:language'
const MARKET_COLOR_SCHEME_STORAGE_KEY = 'lynx:market-color-scheme'
const DEFAULT_THEME = 'dark'
const DEFAULT_MARKET_COLOR_SCHEME = 'green-up-red-down'
const SUPPORTED_THEMES = ['dark', 'light', 'transparent', 'purple']
const SUPPORTED_MARKET_COLOR_SCHEMES = ['green-up-red-down', 'red-up-green-down']
const COLOR_SCHEMES = {
  dark: 'dark',
  light: 'light',
  transparent: 'dark',
  purple: 'dark',
}

function normalizeTheme(theme) {
  return SUPPORTED_THEMES.includes(theme) ? theme : DEFAULT_THEME
}

function normalizeMarketColorScheme(value) {
  return SUPPORTED_MARKET_COLOR_SCHEMES.includes(value) ? value : DEFAULT_MARKET_COLOR_SCHEME
}

function readStoredTheme() {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME
  return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))
}

function readStoredLanguage() {
  if (typeof localStorage === 'undefined') return detectBrowserLocale()
  return normalizeLocale(localStorage.getItem(LANGUAGE_STORAGE_KEY) || detectBrowserLocale())
}

function readStoredMarketColorScheme() {
  if (typeof localStorage === 'undefined') return DEFAULT_MARKET_COLOR_SCHEME
  return normalizeMarketColorScheme(localStorage.getItem(MARKET_COLOR_SCHEME_STORAGE_KEY))
}

function persistLocal(key, value) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, value)
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = COLOR_SCHEMES[theme] || COLOR_SCHEMES.dark
}

function applyMarketColorsToDocument(scheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.marketColors = scheme
}

async function persistRemotePreference(key, value) {
  const res = await api(`/api/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'Save failed')
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const theme = ref(readStoredTheme())
  const language = ref(readStoredLanguage())
  const marketColorScheme = ref(readStoredMarketColorScheme())
  const initialized = ref(false)

  function initialize() {
    if (initialized.value) return
    applyThemeToDocument(theme.value)
    applyMarketColorsToDocument(marketColorScheme.value)
    persistLocal(THEME_STORAGE_KEY, theme.value)
    persistLocal(LANGUAGE_STORAGE_KEY, language.value)
    persistLocal(MARKET_COLOR_SCHEME_STORAGE_KEY, marketColorScheme.value)
    setLocale(language.value)
    initialized.value = true
  }

  function applyServerSettings(settings = {}) {
    if (settings.theme) {
      theme.value = normalizeTheme(settings.theme)
      persistLocal(THEME_STORAGE_KEY, theme.value)
      applyThemeToDocument(theme.value)
    }
    if (settings.language) {
      language.value = normalizeLocale(settings.language)
      persistLocal(LANGUAGE_STORAGE_KEY, language.value)
      setLocale(language.value)
    }
    if (settings.market_color_scheme) {
      marketColorScheme.value = normalizeMarketColorScheme(settings.market_color_scheme)
      persistLocal(MARKET_COLOR_SCHEME_STORAGE_KEY, marketColorScheme.value)
      applyMarketColorsToDocument(marketColorScheme.value)
    }
  }

  async function syncFromServer() {
    const res = await api('/api/settings')
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error || 'Load failed')
    }
    applyServerSettings(json.data)
    return json.data
  }

  async function setTheme(nextTheme, { persistServer = false } = {}) {
    const normalized = normalizeTheme(nextTheme)
    theme.value = normalized
    persistLocal(THEME_STORAGE_KEY, normalized)
    applyThemeToDocument(normalized)
    if (persistServer) {
      await persistRemotePreference('theme', normalized)
    }
    return normalized
  }

  async function setLanguage(nextLanguage, { persistServer = false } = {}) {
    const normalized = normalizeLocale(nextLanguage)
    language.value = normalized
    persistLocal(LANGUAGE_STORAGE_KEY, normalized)
    setLocale(normalized)
    if (persistServer) {
      await persistRemotePreference('language', normalized)
    }
    return normalized
  }

  async function setMarketColorScheme(nextValue, { persistServer = false } = {}) {
    const normalized = normalizeMarketColorScheme(nextValue)
    marketColorScheme.value = normalized
    persistLocal(MARKET_COLOR_SCHEME_STORAGE_KEY, normalized)
    applyMarketColorsToDocument(normalized)
    if (persistServer) {
      await persistRemotePreference('market_color_scheme', normalized)
    }
    return normalized
  }

  return {
    theme,
    language,
    marketColorScheme,
    initialized,
    initialize,
    applyServerSettings,
    syncFromServer,
    setTheme,
    setLanguage,
    setMarketColorScheme,
    supportedThemes: SUPPORTED_THEMES.slice(),
    supportedLanguages: getSupportedLanguages(),
    supportedMarketColorSchemes: SUPPORTED_MARKET_COLOR_SCHEMES.slice(),
  }
})
