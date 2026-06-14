/**
 * Currency formatting utilities
 */

const CURRENCY_SYMBOLS = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
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
  return `${symbol}${Math.round(num).toLocaleString()}`
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
  return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
