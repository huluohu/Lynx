import { createI18n } from 'vue-i18n'
import zhCN from './messages/zh-CN.js'
import enUS from './messages/en-US.js'

export const FALLBACK_LOCALE = 'zh-CN'
const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US']

export function normalizeLocale(locale) {
  if (!locale) return FALLBACK_LOCALE
  const lower = String(locale).toLowerCase()
  if (lower.startsWith('zh')) return 'zh-CN'
  if (lower.startsWith('en')) return 'en-US'
  return FALLBACK_LOCALE
}

export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES.slice()
}

export function detectBrowserLocale() {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE
  return normalizeLocale(navigator.language)
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: FALLBACK_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export function getLocaleValue() {
  return i18n.global.locale.value
}

export function setLocale(locale) {
  const nextLocale = normalizeLocale(locale)
  i18n.global.locale.value = nextLocale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = nextLocale
  }
  return nextLocale
}

export default i18n
