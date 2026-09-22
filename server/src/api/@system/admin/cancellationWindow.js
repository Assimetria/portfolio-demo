'use strict'

/**
 * @system Resolve the validated time-window used by the admin cancellations
 * report.
 *
 * The financials route previously accepted only a coarse `period`. Pages that
 * use the global date-range context send explicit `startDate`/`endDate`
 * (YYYY-MM-DD, inclusive calendar days in UTC). Preferring that explicit
 * honouring world bound keeps the server request filtered rather than simply
 * clipping on the client.
 *
 * Kept as a tiny pure module so the boundary logic can be unit-tested without
 * a database.
 *
 * returns:
 *   { apply:false }                       -> the whole history (no filter)
 *   { apply:true, start, end, explicit }  -> start/end are JS Date bounds for
 *                                             `updated_at >= $1 AND updated_at <= $2`
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

function isIsoDay(value) {
  return typeof value === 'string' && ISO_DAY.test(value)
}

function buildExplicit(startDate, endDate) {
  if (!isIsoDay(startDate) || !isIsoDay(endDate)) return null
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T23:59:59.999Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { apply: true, start, end, explicit: true, startDate, endDate }
}

/**
 * Resolve the window for a request.
 * @param {object} opts
 * @param {string} [opts.period] - 'week' | 'month' | 'all' fallback (default 'month')
 * @param {string} [opts.startDate] - optional YYYY-MM-DD (takes precedence)
 * @param {string} [opts.endDate] - optional YYYY-MM-DD
 * @param {Date}   [opts.now] - dependency injection for tests
 */
function resolveCancellationRange({ period, startDate, endDate, now } = {}) {
  if (startDate || endDate) {
    const explicit = buildExplicit(startDate, endDate)
    if (explicit) return explicit
    // Malformed explicit dates should not silently match everything — treat as
    // no filter so callers surface the error themselves.
    return { apply: false }
  }

  const p = period || 'month'
  if (p === 'all') return { apply: false }

  const anchor = now instanceof Date && !Number.isNaN(now.getTime())
    ? new Date(now.getTime())
    : new Date()
  const days = p === 'week' ? 7 : 30
  const start = new Date(anchor.getTime() - days * DAY_MS)
  return { apply: true, start, end: anchor, explicit: false }
}

// Exposed for unit tests.
module.exports = { resolveCancellationRange, isIsoDay }
