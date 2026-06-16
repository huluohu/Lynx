const SQLITE_UTC_DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
const EXPLICIT_TIMEZONE_RE = /(?:Z|[+-]\d{2}:\d{2})$/i

function buildUtcIsoString(parts) {
  const [, date, hour, minute, second = '00', millisecond] = parts
  const time = `${hour}:${minute}:${second}`
  const fraction = millisecond ? `.${millisecond.padEnd(3, '0')}` : ''
  return `${date}T${time}${fraction}Z`
}

export function normalizeApiTimestamp(value, { assumeUtcWhenNoTimezone = false } = {}) {
  if (value === null || value === undefined || value === '') return value ?? null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    if (EXPLICIT_TIMEZONE_RE.test(trimmed)) {
      const date = new Date(trimmed)
      return Number.isNaN(date.getTime()) ? value : date.toISOString()
    }

    if (assumeUtcWhenNoTimezone) {
      const parts = trimmed.match(SQLITE_UTC_DATETIME_RE)
      if (parts) return buildUtcIsoString(parts)
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

export function normalizeApiTimestampFields(row, fields, options) {
  if (!row) return row
  const next = { ...row }
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      next[field] = normalizeApiTimestamp(next[field], options)
    }
  }
  return next
}
