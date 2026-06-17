/**
 * Currency formatting utilities
 */

import { formatNumber } from './formatters.js'

const CURRENCY_SYMBOLS = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  USDT: 'USDT',
  BTC: '₿',
  ETH: 'Ξ',
}

const CURRENCY_DISPLAY_NAMES = {
  CNY: 'CNY',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  USDT: 'USDT',
  BTC: 'BTC',
  ETH: 'ETH',
}

/**
 * Get currency symbol for a given currency code
 * @param {string} currency - Currency code (CNY, USD, etc.)
 * @returns {string} Currency symbol
 */
export function currencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency || '¥'
}

export function currencyDisplayName(currency) {
  return CURRENCY_DISPLAY_NAMES[currency] || currency || 'CNY'
}

export function currencyInputLabel(label, currency = 'CNY') {
  return `${label} (${currencyDisplayName(currency)})`
}

function joinCurrencyAndAmount(symbol, amount) {
  return /^[A-Z]{2,}$/.test(symbol) ? `${symbol} ${amount}` : `${symbol}${amount}`
}

export function formatCurrencyAmount(value, currency = 'CNY', numberOptions = {}) {
  if (value === null || value === undefined || value === '') return '-'
  const symbol = currencySymbol(currency)
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return joinCurrencyAndAmount(symbol, formatNumber(num, numberOptions))
}

export function formatSignedCurrencyAmount(value, currency = 'CNY', numberOptions = {}) {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  const sign = num > 0 ? '+' : (num < 0 ? '-' : '')
  return `${sign}${formatCurrencyAmount(Math.abs(num), currency, numberOptions)}`
}

/**
 * Format a monetary value with currency symbol
 * @param {number} value - The value to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted string like "¥1,234" or "$99.50"
 */
export function formatMoney(value, currency = 'CNY') {
  return formatCurrencyAmount(value, currency, { maximumFractionDigits: 0 })
}

/**
 * Format price with appropriate decimal places
 * @param {number} value - The price
 * @param {string} currency - Currency code
 * @returns {string} Formatted price string
 */
export function formatPrice(value, currency = 'CNY') {
  return formatCurrencyAmount(value, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
