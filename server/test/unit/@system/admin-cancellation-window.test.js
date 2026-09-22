/**
 * @system Tests for the admin cancellations report date window.
 *
 * Covers global-range handling: explicit YYYY-MM-DD bounds (used by
 * useGlobalDateRange) take precedence and become closed [00:00:00,
 * 23:59:59.999Z] server filters, while the legacy `period` fallback keeps the
 * previous rolling behaviour. Pure CommonJS — no database needed.
 */
'use strict'

const {
  resolveCancellationRange,
  isIsoDay,
} = require('../../../src/api/@system/admin/cancellationWindow')

const FIXED_NOW = new Date('2024-02-15T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

describe('resolveCancellationRange()', () => {
  describe('explicit global range (startDate/endDate)', () => {
    it('uses whole inclusive UTC days for an explicit range', () => {
      const result = resolveCancellationRange({
        startDate: '2024-01-10',
        endDate: '2024-01-19',
      })
      expect(result.apply).toBe(true)
      expect(result.explicit).toBe(true)
      expect(result.start.toISOString()).toBe('2024-01-10T00:00:00.000Z')
      expect(result.end.toISOString()).toBe('2024-01-19T23:59:59.999Z')
    })

    it('takes precedence over a requested period', () => {
      const result = resolveCancellationRange({
        period: 'week',
        startDate: '2024-01-05',
        endDate: '2024-01-09',
        now: FIXED_NOW,
      })
      expect(result.explicit).toBe(true)
      expect(result.start.toISOString()).toBe('2024-01-05T00:00:00.000Z')
      expect(result.end.toISOString()).toBe('2024-01-09T23:59:59.999Z')
    })

    it('exposes the original ISO strings for echoing back', () => {
      const result = resolveCancellationRange({ startDate: '2024-01-10', endDate: '2024-01-19' })
      expect(result.startDate).toBe('2024-01-10')
      expect(result.endDate).toBe('2024-01-19')
    })

    it('malformed explicit dates produce no filter instead of a wrong window', () => {
      expect(resolveCancellationRange({ startDate: 'not-a-date', endDate: '2024-01-10' }).apply).toBe(false)
      expect(resolveCancellationRange({ startDate: '2024-01-10', endDate: 'oops' }).apply).toBe(false)
    })
  })

  describe('legacy period fallback', () => {
    it('month spans the previous 30 days (inclusive of "now")', () => {
      const result = resolveCancellationRange({ period: 'month', now: FIXED_NOW })
      expect(result.apply).toBe(true)
      expect(result.explicit).toBe(false)
      expect(result.end.getTime()).toBe(FIXED_NOW.getTime())
      expect(result.start.getTime()).toBe(FIXED_NOW.getTime() - 30 * DAY_MS)
    })

    it('week spans the previous 7 days', () => {
      const result = resolveCancellationRange({ period: 'week', now: FIXED_NOW })
      expect(result.apply).toBe(true)
      expect(result.start.getTime()).toBe(FIXED_NOW.getTime() - 7 * DAY_MS)
    })

    it('all disables filtering entirely', () => {
      const result = resolveCancellationRange({ period: 'all', now: FIXED_NOW })
      expect(result.apply).toBe(false)
    })

    it('defaults unnamed periods to the month window', () => {
      const result = resolveCancellationRange({ now: FIXED_NOW })
      expect(result.apply).toBe(true)
      expect(result.start.getTime()).toBe(FIXED_NOW.getTime() - 30 * DAY_MS)
    })

    it('falls back to month when given an unknown period key', () => {
      const result = resolveCancellationRange({ period: 'decade', now: FIXED_NOW })
      expect(result.start.getTime()).toBe(FIXED_NOW.getTime() - 30 * DAY_MS)
    })
  })
})

describe('isIsoDay()', () => {
  it('accepts calendar-only strings', () => {
    expect(isIsoDay('2024-02-11')).toBe(true)
    expect(isIsoDay('2000-01-01')).toBe(true)
  })

  it('rejects non calendar-only strings', () => {
    expect(isIsoDay('2024-2-11')).toBe(false)
    expect(isIsoDay('garbage')).toBe(false)
    expect(isIsoDay('2024-02-11T00:00:00Z')).toBe(false)
  })
})
