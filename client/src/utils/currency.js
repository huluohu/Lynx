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

/**
 * Get currency symbol for a given currency code
 * @param {string} currency - Currency code (CNY, USD, etc.)
 * @returns {string} Currency symbol
 */
export function currencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency || '¥'
}

/**
 * Format a monetary value with currency symbol
 * @param {number} value - The value to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted string like "¥1,234" or "$99.50"
 */
export function formatMoney(value, currency = 'CNY') {
  if (value === null || value === undefined) return '-'
  const symbol = currencySymbol(currency)
  const num = Number(value)
  if (isNaN(num)) return '-'
  return `${symbol}${formatNumber(Math.round(num), { maximumFractionDigits: 0 })}`
}

/**
 * Format price with appropriate decimal places
 * @param {number} value - The price
 * @param {string} currency - Currency code
 * @returns {string} Formatted price string
 */
export function formatPrice(value, currency = 'CNY') {
  if (value === null || value === undefined) return '-'
  const symbol = currencySymbol(currency)
  const num = Number(value)
  if (isNaN(num)) return '-'
  return `${symbol}${formatNumber(num, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
