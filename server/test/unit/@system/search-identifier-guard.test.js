'use strict'

// Unit tests for the SQL identifier guard in Helpers/search.js — column names
// are the only interpolated part of the generated SQL and must be validated.

const {
  buildWhereClause,
  buildOrderByClause,
  buildSearchCondition,
  assertIdentifier,
  parseFilterKey,
} = require('../../../src/lib/@system/Helpers/search')

describe('assertIdentifier', () => {
  it('accepts plain and qualified identifiers', () => {
    expect(assertIdentifier('created_at')).toBe('created_at')
    expect(assertIdentifier('t.created_at')).toBe('t.created_at')
    expect(assertIdentifier('_x1')).toBe('_x1')
  })

  it('rejects anything else', () => {
    for (const bad of ['1abc', 'a b', 'a;', 'a--', "a'", 'a.b.c', '', null, undefined, 42, 'created_at DESC; DROP TABLE users']) {
      expect(() => assertIdentifier(bad)).toThrow(/Unsafe SQL/)
    }
  })
})

describe('parseFilterKey', () => {
  it('defaults to equality', () => {
    expect(parseFilterKey('status')).toEqual({ column: 'status', operator: '=' })
  })

  it('supports a whitelisted operator suffix', () => {
    expect(parseFilterKey('created_at >=')).toEqual({ column: 'created_at', operator: '>=' })
    expect(parseFilterKey('name ilike')).toEqual({ column: 'name', operator: 'ILIKE' })
  })

  it('rejects unknown operators and injection attempts', () => {
    expect(() => parseFilterKey('created_at BETWEEN')).toThrow(/Unsafe SQL filter key/)
    expect(() => parseFilterKey('id = 1 OR 1=1 --')).toThrow(/Unsafe SQL filter key/)
  })
})

describe('buildWhereClause guard', () => {
  it('throws on hostile filter keys instead of interpolating them', () => {
    expect(() => buildWhereClause({ filters: { 'id = 1 OR 1=1 --': 'x' } })).toThrow(/Unsafe SQL/)
    expect(() => buildWhereClause({ filters: { 'status; DROP TABLE users': 'x' } })).toThrow(/Unsafe SQL/)
  })

  it('renders operator-suffixed keys with bound values', () => {
    const { whereClause, params } = buildWhereClause({ filters: { 'created_at >=': '2026-01-01', status: 'active' } })
    expect(whereClause).toBe('WHERE created_at >= $1 AND status = $2')
    expect(params).toEqual(['2026-01-01', 'active'])
  })

  it('skips empty IN lists rather than emitting invalid SQL', () => {
    expect(buildWhereClause({ filters: { role: [] } })).toEqual({ whereClause: '', params: [] })
  })

  it('validates search columns too', () => {
    expect(() => buildSearchCondition('x', ['name) OR 1=1 --'])).toThrow(/Unsafe SQL search column/)
  })
})

describe('buildOrderByClause guard', () => {
  it('still whitelists sortBy and validates the default', () => {
    expect(buildOrderByClause({ sortBy: 'x; DROP', allowedFields: ['name'] })).toBe('ORDER BY created_at DESC')
    expect(() => buildOrderByClause({ defaultSort: 'created_at DESC; --' })).toThrow(/Unsafe SQL sort column/)
  })

  it('tolerates a non-string sortOrder', () => {
    expect(buildOrderByClause({ sortOrder: undefined })).toBe('ORDER BY created_at DESC')
  })
})
