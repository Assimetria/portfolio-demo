/**
 * @system Date helpers
 *
 * Shared date/time utilities intended to close common "utility gaps":
 * safe ISO parsing, arithmetic (add/sub days), whole-day differences,
 * day/month boundaries and SQL-INTERVAL formatting for retention queries.
 *
 * Plain CommonJS module — mirrors the style of api-utils.js and response.js.
 * All calendar arithmetic is performed on real `Date` instances; day
 * differences are derived from UTC calendar dates so results are stable
 * regardless of the machine's local time-zone / DST offset.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Normalise arbitrary input into a Date instance.
 *
 * @param {Date|string|number|null|undefined} value - Date, ISO string, epoch ms or null
 * @returns {Date|null} Valid Date or null when the input cannot be parsed.
 */
function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Whether a value represents a real, parsable date.
 *
 * @param {Date|string|number|null|undefined} value - Value to test
 * @returns {boolean} True when the value parses to a valid Date.
 */
function isValidDate(value) {
  return toDate(value) !== null
}

/**
 * Safe ISO parser.
 *
 * Unlike `new Date(invalid)` (which returns NaN silently), this returns
 * `null` when the string is not a valid date so callers can react.
 *
 * @param {string} iso - ISO-8601 string (or empty)
 * @returns {Date|null} Parsed Date or null.
 */
function parseISO(iso) {
  return toDate(iso)
}

/**
 * Add days to a date, returning a new Date (input is not mutated).
 *
 * @param {Date|string} date - Base date
 * @param {number} amount - Number of days to add (may be negative)
 * @returns {Date} New date offset by `amount` calendar days.
 */
function addDays(date, amount) {
  const d = toDate(date)
  if (!d) throw new TypeError('addDays requires a valid date')
  const days = Number(amount)
  if (!Number.isFinite(days)) throw new TypeError('addDays requires a finite day amount')
  const result = new Date(d.getTime())
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Subtract days from a date, returning a new Date (input is not mutated).
 *
 * @param {Date|string} date - Base date
 * @param {number} amount - Number of days to subtract
 * @returns {Date} Date offset back by `amount` calendar days.
 */
function subDays(date, amount) {
  return addDays(date, -amount)
}

/**
 * Whole-day difference between two dates (lhs - rhs in calendar days).
 *
 * Uses UTC calendar dates so a "day" is always exactly one day — independent
 * of DST transitions or local timezone offsets.
 *
 * @param {Date|string} later - The date to subtract from
 * @param {Date|string} earlier - The date being subtracted
 * @returns {number} Difference in whole days (negative when earlier is after later).
 */
function dateDiffDays(later, earlier) {
  const a = toDate(later)
  const b = toDate(earlier)
  if (!a || !b) throw new TypeError('dateDiffDays requires valid dates')
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((aUtc - bUtc) / DAY_MS)
}

/**
 * Start of the calendar day for a date (00:00:00.000 local).
 *
 * @param {Date|string} date - Input date
 * @returns {Date} Copy set to the beginning of the day.
 */
function startOfDay(date) {
  const d = toDate(date)
  if (!d) throw new TypeError('startOfDay requires a valid date')
  const result = new Date(d.getTime())
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * End of the calendar day for a date (23:59:59.999 local).
 *
 * @param {Date|string} date - Input date
 * @returns {Date} Copy set to the last millisecond of the day.
 */
function endOfDay(date) {
  const d = toDate(date)
  if (!d) throw new TypeError('endOfDay requires a valid date')
  const result = new Date(d.getTime())
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * First millisecond of the month that contains `date`.
 *
 * @param {Date|string} date - Reference date
 * @returns {Date} Start of month boundary.
 */
function monthStart(date) {
  const d = toDate(date)
  if (!d) throw new TypeError('monthStart requires a valid date')
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

/**
 * Last millisecond of the month that contains `date`.
 *
 * @param {Date|string} date - Reference date
 * @returns {Date} End of month boundary (last day 23:59:59.999).
 */
function monthEnd(date) {
  const d = toDate(date)
  if (!d) throw new TypeError('monthEnd requires a valid date')
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/**
 * Inclusive [start, end] range for the month that contains `date`.
 *
 * @param {Date|string} date - Reference date
 * @param {boolean} [isoStrings=false] - Return ISO-8601 strings instead of Dates
 * @returns {{start: Date|string, end: Date|string}} Month boundaries.
 */
function getMonthRange(date, isoStrings = false) {
  const start = monthStart(date)
  const end = monthEnd(date)
  if (isoStrings) return { start: start.toISOString(), end: end.toISOString() }
  return { start, end }
}

/**
 * Format a date as a UTC ISO-8601 string.
 *
 * @param {Date|string} date - Date to serialise
 * @returns {string} ISO-8601 string with a trailing `Z`.
 */
function toISOString(date) {
  const d = toDate(date)
  if (!d) throw new TypeError('toISOString requires a valid date')
  return d.toISOString()
}

/**
 * Build a cut-off date `retentionDays` days before `from`.
 *
 * Useful when purging old rows: "keep everything created on/after this date".
 *
 * @param {number} retentionDays - How many days of history to retain
 * @param {Date|string} [from] - Reference "now". Defaults to current time.
 * @returns {Date} Cut-off date.
 */
function retentionCutoffDate(retentionDays, from) {
  const anchor = from ? toDate(from) : new Date()
  if (!anchor) throw new TypeError('retentionCutoffDate requires a valid base date')
  const days = Number(retentionDays)
  if (!Number.isFinite(days) || days < 0) {
    throw new TypeError('retentionCutoffDate requires a non-negative finite day count')
  }
  return subDays(anchor, days)
}

/**
 * Format a whole number of days as a safe PostgreSQL `INTERVAL` literal.
 *
 * The value is coerced & validated so it can never inject SQL — only `[0-9]+`
 * is ever emitted.
 *
 * @param {number|string} days - Day count
 * @returns {string} e.g. "90 days" — safe to embed in `INTERVAL '90 days'`.
 */
function toIntervalLiteral(days) {
  const n = Number(days)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new TypeError('toIntervalLiteral requires a non-negative whole number of days')
  }
  return `${n} days`
}

module.exports = {
  toDate,
  isValidDate,
  parseISO,
  addDays,
  subDays,
  dateDiffDays,
  startOfDay,
  endOfDay,
  monthStart,
  monthEnd,
  getMonthRange,
  toISOString,
  retentionCutoffDate,
  toIntervalLiteral,
}
