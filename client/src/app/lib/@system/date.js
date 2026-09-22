/**
 * @system Client date helpers
 *
 * Lightweight, dependency-free date utilities for the client. They mirror the
 * shape of the server-side date helpers but add human-readable, locale-aware
 * formatting via the native `Intl` API — kept free of external imports so the
 * module is trivially unit-testable in the JS DOM test environment.
 *
 * All functions accept a `Date`, an ISO/date string, or an epoch millisecond
 * number; invalid values either return `null` or fall back gracefully rather
 * than throwing RangeErrors at runtime.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Convert flexible input to a real Date, or null when unparseable.
 *
 * @param {Date|string|number|null|undefined} value - Input date
 * @returns {Date|null} Valid Date or null.
 */
export function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (value == null || value === '') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Whether a value can be parsed as a date.
 *
 * @param {Date|string|number|null|undefined} value - Value to test
 * @returns {boolean} True when parseable.
 */
export function isValidDate(value) {
  return toDate(value) !== null
}

/**
 * Floor to the start of the local calendar day (00:00:00.000).
 *
 * @param {Date|string|number} date - Input date
 * @returns {Date} Start-of-day copy.
 */
export function startOfDay(date) {
  const d = toDate(date)
  if (!d) return null
  const result = new Date(d.getTime())
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Ceil to the end of the local calendar day (23:59:59.999).
 *
 * @param {Date|string|number} date - Input date
 * @returns {Date} End-of-day copy.
 */
export function endOfDay(date) {
  const d = toDate(date)
  if (!d) return null
  const result = new Date(d.getTime())
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * First day (00:00) of the month containing `date`.
 *
 * @param {Date|string|number} date - Input date
 * @returns {Date} Start-of-month copy.
 */
export function startOfMonth(date) {
  const d = toDate(date)
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

/**
 * Last day (23:59:59.999) of the month containing `date`.
 *
 * @param {Date|string|number} date - Input date
 * @returns {Date} End-of-month copy.
 */
export function endOfMonth(date) {
  const d = toDate(date)
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Shift a date by a whole number of calendar days (new instance).
 *
 * @param {Date|string|number} date - Input date
 * @param {number} amount - Days to add (may be negative)
 * @returns {Date|null} Shifted copy.
 */
export function addDays(date, amount) {
  const d = toDate(date)
  if (!d) return null
  const result = new Date(d.getTime())
  result.setDate(result.getDate() + Number(amount))
  return result
}

/**
 * Shift a date backwards by a whole number of days.
 *
 * @param {Date|string|number} date - Input date
 * @param {number} amount - Days to subtract
 * @returns {Date|null} Shifted copy.
 */
export function subDays(date, amount) {
  return addDays(date, -amount)
}

/**
 * Whether two values fall on the same local calendar day.
 *
 * @param {Date|string|number} a - First date
 * @param {Date|string|number} b - Second date
 * @returns {boolean} True when both are valid and represent the same day.
 */
export function isSameDay(a, b) {
  const da = toDate(a)
  const db = toDate(b)
  if (!da || !db) return false
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/**
 * Format a date with the given locale / Intl options. Never throws — invalid
 * input returns an empty string.
 *
 * @param {Date|string|number} value - Date to format
 * @param {object} [options] - Intl.DateTimeFormat options
 * @param {string} [options.locale='en-US'] - BCP-47 locale tag
 * @returns {string} Formatted date ('' when unparseable).
 */
export function formatDate(value, options = {}) {
  const { locale = 'en-US', ...formatOpts } = options
  const d = toDate(value)
  if (!d) return ''
  const resolvedOpts = Object.keys(formatOpts).length
    ? formatOpts
    : { year: 'numeric', month: 'short', day: 'numeric' }
  try {
    return new Intl.DateTimeFormat(locale, resolvedOpts).format(d)
  } catch {
    return String(d)
  }
}

/**
 * Format date + time for a value using the local timezone.
 *
 * @param {Date|string|number} value - Date to format
 * @param {object} [options] - Intl.DateTimeFormat options
 * @returns {string} Formatted date/time ('' when unparseable).
 */
export function formatDateTime(value, options = {}) {
  const { locale = 'en-US', ...formatOpts } = options
  const d = toDate(value)
  if (!d) return ''
  const resolvedOpts = Object.keys(formatOpts).length
    ? formatOpts
    : { dateStyle: 'medium', timeStyle: 'short' }
  try {
    return new Intl.DateTimeFormat(locale, resolvedOpts).format(d)
  } catch {
    return String(d)
  }
}

/**
 * Render a short, relative description of how long ago/pending a time is.
 *
 * @param {Date|string|number} value - The timestamp to describe
 * @param {Date|string|number} [now=new Date()] - Reference "now"
 * @param {object} [options] - { locale='en-US', numeric='auto' }
 * @returns {string} e.g. "3 days ago" / "in 2 hours" / "now" ('' if invalid).
 */
export function relativeTime(value, now, options = {}) {
  const d = toDate(value)
  const ref = toDate(now) || new Date()
  if (!d) return ''
  const { locale = 'en-US', numeric = 'auto' } = options
  const diffMs = d.getTime() - ref.getTime()
  const minutes = Math.round(diffMs / 60000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric })
  if (Math.abs(minutes) < 1) return numeric === 'always' ? rtf.format(0, 'minute') : 'now'
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return rtf.format(months, 'month')
  return rtf.format(Math.round(months / 12), 'year')
}

/**
 * Serialise a value to a `yyyy-MM-dd` calendar string (local time).
 *
 * @param {Date|string|number} value - Date to serialise
 * @returns {string} `yyyy-MM-dd` or '' when invalid.
 */
export function toISODate(value) {
  const d = toDate(value)
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Calendar-day difference between two values (a - b).
 *
 * @param {Date|string|number} later - Date to subtract from
 * @param {Date|string|number} earlier - Date being subtracted
 * @returns {number|null} Whole-day difference, or null when either is invalid.
 */
export function dateDiffDays(later, earlier) {
  const a = toDate(later)
  const b = toDate(earlier)
  if (!a || !b) return null
  const aLocal = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const bLocal = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((aLocal - bLocal) / DAY_MS)
}

