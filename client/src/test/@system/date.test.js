/**
 * @system — Tests for the client date helpers (lib/@system/date.js)
 *
 * Exercises parsing, day/month boundaries, whole-day maths, formatting and
 * relative-time rendering. The module is otherwise dependency-free, so this
 * file runs cleanly in the jsdom test environment.
 */
import { describe, it, expect } from 'vitest'
import {
  toDate,
  isValidDate,
  startOfDay,
  endOfDay,
  isSameDay,
  addDays,
  subDays,
  dateDiffDays,
  toISODate,
  formatDate,
  formatDateTime,
  relativeTime,
  startOfMonth,
  endOfMonth,
} from '@/app/lib/@system/date'

function local(y, m, d, h = 0, min = 0, s = 0, ms = 0) {
  return new Date(y, m, d, h, min, s, ms)
}

describe('parsing & validity', () => {
  it('accepts Date instances and ISO-like strings', () => {
    const d = new Date()
    expect(toDate(d)).toBe(d)
    expect(toDate(d.toISOString())).toBeInstanceOf(Date)
  })

  it('returns null for invalid input', () => {
    expect(toDate(undefined)).toBeNull()
    expect(toDate('')).toBeNull()
    expect(toDate('bogus')).toBeNull()
  })

  it('isValidDate reflects parseability', () => {
    expect(isValidDate('2024-05-06')).toBe(true)
    expect(isValidDate('nope')).toBe(false)
  })
})

describe('day/month boundaries', () => {
  it('startOfDay zeroes the clock', () => {
    const start = startOfDay(local(2024, 6, 4, 18, 30, 20, 100))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getMonth()).toBe(6)
    expect(start.getDate()).toBe(4)
  })

  it('endOfDay stays within the same day', () => {
    const end = endOfDay(local(2024, 6, 4, 1))
    expect(end.getHours()).toBe(23)
    expect(end.getDate()).toBe(4)
  })

  it('startOfMonth is day 1 and endOfMonth is the final day', () => {
    const start = startOfMonth(local(2024, 1, 18))
    expect(start.getDate()).toBe(1)
    expect(start.getMonth()).toBe(1)

    const end = endOfMonth(local(2024, 1, 18))
    expect(end.getMonth()).toBe(1)
    expect(end.getDate()).toBe(29) // leap-year February 2024
  })
})

describe('day arithmetic & comparison', () => {
  it('addDays / subDays keep local calendar semantics', () => {
    const plus = addDays(local(2024, 0, 31), 1)
    expect(plus.getMonth()).toBe(1)
    expect(plus.getDate()).toBe(1)

    const minus = subDays(local(2024, 0, 1), 1)
    expect(minus.getFullYear()).toBe(2023)
    expect(minus.getMonth()).toBe(11)
    expect(minus.getDate()).toBe(31)
  })

  it('isSameDay compares calendar days only', () => {
    expect(isSameDay(local(2024, 0, 5, 23), local(2024, 0, 5, 0))).toBe(true)
    expect(isSameDay(local(2024, 0, 5), local(2024, 0, 6))).toBe(false)
  })

  it('dateDiffDays returns whole-day difference', () => {
    expect(dateDiffDays(local(2024, 2, 1), local(2024, 1, 28))).toBe(2)
  })
})

describe('serialisation', () => {
  it('toISODate emits yyyy-MM-dd', () => {
    expect(toISODate(local(2024, 6, 4))).toBe('2024-07-04')
    expect(toISODate('bad')).toBe('')
  })
})

describe('formatting & relative time', () => {
  it('formatDate renders a dated label without throwing', () => {
    const out = formatDate(local(2024, 2, 1, 12))
    expect(typeof out).toBe('string')
    expect(out).toContain('2024')
  })

  it('formatDateTime includes a time component', () => {
    const out = formatDateTime(local(2024, 2, 1, 15, 30))
    expect(out).toContain('2024')
    expect(out).toContain('3:')
  })

  it('formatDate returns "" for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('')
  })

  it('relativeTime describes the past and future', () => {
    const past = relativeTime(new Date(Date.now() - 3 * 86400000))
    const future = relativeTime(new Date(Date.now() + 3 * 86400000))
    expect(past).toMatch(/ago/)
    expect(future).toMatch(/in/)
  })
})
