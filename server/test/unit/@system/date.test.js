/**
 * @system Tests for the date utility helpers (Helpers/date.js)
 *
 * Covers parsing, whole-day arithmetic, calendar-day diffs, day/month
 * boundaries, ISO serialisation and the interval/cut-off builders.
 *
 * All fixtures are constructed with the `new Date(y, m, d, ...)` form so the
 * assertions are timezone-stable (helpers operate on the local calendar).
 */
'use strict'

const {
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
} = require('../../../src/lib/@system/Helpers/date')

describe('toDate / isValidDate / parseISO', () => {
  it('parses a real Date unchanged', () => {
    const d = new Date(2024, 0, 5, 10, 30)
    expect(toDate(d)).toBe(d)
  })

  it('returns null for invalid or empty input', () => {
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
    expect(toDate('')).toBeNull()
    expect(toDate('not-a-date')).toBeNull()
    expect(toDate(new Date('garbage'))).toBeNull()
  })

  it('isValidDate reports validity', () => {
    expect(isValidDate('2024-05-06')).toBe(true)
    expect(isValidDate('nope')).toBe(false)
  })

  it('parseISO behaves like toDate', () => {
    const d = parseISO('2024-05-06T12:00:00Z')
    expect(d).toBeInstanceOf(Date)
    expect(d.getUTCFullYear()).toBe(2024)
  })

  it('toDate accepts an epoch-millisecond number', () => {
    const fromDate = new Date(2024, 5, 1, 12, 0, 0)
    const parsed = toDate(fromDate.getTime())
    expect(parsed).toBeInstanceOf(Date)
    expect(parsed.toISOString()).toBe(fromDate.toISOString())
  })

  it('toDate returns null for an infeasible epoch', () => {
    expect(toDate(NaN)).toBeNull()
    expect(toDate(Infinity)).toBeNull()
  })
})

describe('addDays / subDays', () => {
  it('adds days across a month boundary', () => {
    const result = addDays(new Date(2024, 0, 31), 1)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(1)
  })

  it('handles negative amounts and year rollover', () => {
    const result = addDays(new Date(2024, 0, 1), -1)
    expect(result.getFullYear()).toBe(2023)
    expect(result.getMonth()).toBe(11)
    expect(result.getDate()).toBe(31)
  })

  it('subDays subtracts calendar days', () => {
    const result = subDays(new Date(2024, 2, 10), 5)
    expect(result.getDate()).toBe(5)
  })
})

describe('dateDiffDays', () => {
  it('computes positive whole-day differences', () => {
    const diff = dateDiffDays(new Date(2024, 2, 1), new Date(2024, 1, 28))
    expect(diff).toBe(2)
  })

  it('ignores time-of-day, returning calendar-day count', () => {
    const diff = dateDiffDays(
      new Date(2024, 2, 5, 23, 59, 59),
      new Date(2024, 2, 4, 0, 0, 0)
    )
    expect(diff).toBe(1)
  })

  it('returns negative when the second date is later', () => {
    expect(dateDiffDays(new Date(2024, 1, 28), new Date(2024, 2, 1))).toBe(-2)
  })
})

describe('startOfDay / endOfDay', () => {
  it('zeroes the clock for the start of day', () => {
    const start = startOfDay(new Date(2024, 6, 4, 15, 30, 45, 123))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(start.getMilliseconds()).toBe(0)
    expect(start.getDate()).toBe(4)
  })

  it('ceil to end of day keeps the last millisecond', () => {
    const end = endOfDay(new Date(2024, 6, 4, 9))
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
    expect(end.getMilliseconds()).toBe(999)
  })
})

describe('month boundaries', () => {
  it('monthStart is day 1 at the first millisecond', () => {
    const start = monthStart(new Date(2024, 1, 15))
    expect(start.getFullYear()).toBe(2024)
    expect(start.getMonth()).toBe(1)
    expect(start.getDate()).toBe(1)
    expect(start.getHours()).toBe(0)
  })

  it('monthEnd is the last day of the month', () => {
    const leapEnd = monthEnd(new Date(2024, 1, 15))
    expect(leapEnd.getMonth()).toBe(1)
    expect(leapEnd.getDate()).toBe(29) // 2024 is a leap year

    const nonLeapEnd = monthEnd(new Date(2023, 1, 15))
    expect(nonLeapEnd.getMonth()).toBe(1)
    expect(nonLeapEnd.getDate()).toBe(28)
  })

  it('keeps the end of day for the final second', () => {
    const end = monthEnd(new Date(2024, 1, 15))
    expect(end.getHours()).toBe(23)
    expect(end.getSeconds()).toBe(59)
  })
})

describe('getMonthRange', () => {
  it('returns inclusive Date boundaries for a month', () => {
    const { start, end } = getMonthRange(new Date(2024, 1, 15))
    expect(start.toISOString()).toBe(monthStart(new Date(2024, 1, 15)).toISOString())
    expect(end.toISOString()).toBe(monthEnd(new Date(2024, 1, 15)).toISOString())
  })

  it('returns ISO strings spanning the full local calendar month', () => {
    const { start, end } = getMonthRange(new Date(2024, 1, 15), true)
    expect(typeof start).toBe('string')
    expect(typeof end).toBe('string')
    expect(end.endsWith('Z')).toBe(true)
    // Absolute span Feb 1 00:00 -> Feb 29 23:59:59.999 = 29 days - 1 ms,
    // independent of the host timezone.
    expect(Date.parse(end) - Date.parse(start)).toBe(29 * 86400000 - 1)
  })

  it('keeps the boundary instants identical to monthStart/monthEnd', () => {
    const { start, end } = getMonthRange(new Date(2024, 6, 10, 18, 45))
    expect(start.getTime()).toBe(monthStart(new Date(2024, 6, 10, 18, 45)).getTime())
    expect(end.getTime()).toBe(monthEnd(new Date(2024, 6, 10, 18, 45)).getTime())
  })
})

describe('toISOString', () => {
  it('serialises a date as a UTC ISO string ending in Z', () => {
    const iso = toISOString(new Date(2024, 0, 1, 12, 0, 0))
    expect(iso.endsWith('Z')).toBe(true)
  })
})

describe('retentionCutoffDate', () => {
  it('subtracts the retention window from the reference date', () => {
    const from = new Date(2024, 5, 15, 10, 0, 0)
    const cutoff = retentionCutoffDate(30, from)
    const expected = subDays(from, 30)
    expect(cutoff.getTime()).toBe(expected.getTime())
  })

  it('zero-day window returns the same instant', () => {
    const from = new Date(2024, 5, 15)
    expect(retentionCutoffDate(0, from).getTime()).toBe(from.getTime())
  })

  it('throws on invalid day counts', () => {
    const from = new Date()
    expect(() => retentionCutoffDate(-1, from)).toThrow(TypeError)
    expect(() => retentionCutoffDate(Infinity, from)).toThrow(TypeError)
  })
})

describe('toIntervalLiteral', () => {
  it('formats non-negative whole days as POSTGRES-safe text', () => {
    expect(toIntervalLiteral(90)).toBe('90 days')
    expect(toIntervalLiteral('7')).toBe('7 days')
    expect(toIntervalLiteral(0)).toBe('0 days')
  })

  it('rejects fractional, negative and non-numeric values', () => {
    expect(() => toIntervalLiteral(1.5)).toThrow(TypeError)
    expect(() => toIntervalLiteral(-3)).toThrow(TypeError)
    expect(() => toIntervalLiteral('abc')).toThrow(TypeError)
    expect(() => toIntervalLiteral(NaN)).toThrow(TypeError)
  })
})

