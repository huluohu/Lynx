import { getLocaleValue } from '../i18n/index.js'

function resolveLocale() {
  return getLocaleValue() || 'zh-CN'
}

function parseLocalDateString(value) {
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    0,
    0,
    0,
    0
  )
  return Number.isNaN(date.getTime()) ? null : date
}

function parseUtcDateTimeString(value) {
  const match = String(value).trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  )
  if (!match) return null

  const [, year, month, day, hour, minute, second = '0', millisecond = '0'] = match
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, '0'))
  ))
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseDateTime(value) {
  if (value instanceof Date) return value
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const localDate = parseLocalDateString(trimmed)
    if (localDate) return localDate

    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)
    if (!hasExplicitTimezone) {
      const utcDate = parseUtcDateTimeString(trimmed)
      if (utcDate) return utcDate
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatNumber(value, options = {}) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return new Intl.NumberFormat(resolveLocale(), options).format(number)
}

export function formatDateTime(value, options = {}) {
  const date = parseDateTime(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(resolveLocale(), options).format(date)
}

export function formatDate(value, options = {}) {
  return formatDateTime(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  })
}

export function formatTime(value, options = {}) {
  return formatDateTime(value, {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}

export function formatRelativeTimeFromNow(value) {
  const date = parseDateTime(value)
  if (!date) return ''

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const formatter = new Intl.RelativeTimeFormat(resolveLocale(), { numeric: 'auto' })

  if (absMs < 60 * 60 * 1000) {
    return formatter.format(Math.round(diffMs / (60 * 1000)), 'minute')
  }
  if (absMs < 24 * 60 * 60 * 1000) {
    return formatter.format(Math.round(diffMs / (60 * 60 * 1000)), 'hour')
  }
  if (absMs < 7 * 24 * 60 * 60 * 1000) {
    return formatter.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), 'day')
  }
  return formatDateTime(date, { year: 'numeric', month: '2-digit', day: '2-digit' })
}
