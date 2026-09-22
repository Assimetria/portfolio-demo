const {
  buildSearchCondition,
  parseSearchQuery,
  buildWhereClause,
  sanitizeSearchQuery,
  buildOrderByClause,
} = require('../../../src/lib/@system/Helpers/search')

describe('search helpers', () => {
  describe('buildSearchCondition', () => {
    it('returns empty for missing query or columns', () => {
      expect(buildSearchCondition('', ['name'])).toEqual({ condition: '', params: [] })
      expect(buildSearchCondition('foo', [])).toEqual({ condition: '', params: [] })
    })

    it('builds case-insensitive contains ILIKE across columns', () => {
      const { condition, params } = buildSearchCondition('Hello', ['name', 'email'])
      expect(condition).toBe('(LOWER(name) ILIKE $1 OR LOWER(email) ILIKE $2)')
      expect(params).toEqual(['%hello%', '%hello%'])
    })

    it('supports starts_with mode', () => {
      const { params } = buildSearchCondition('foo', ['name'], { mode: 'starts_with' })
      expect(params).toEqual(['foo%'])
    })

    it('supports exact mode with = operator', () => {
      const { condition, params } = buildSearchCondition('foo', ['slug'], { mode: 'exact' })
      expect(condition).toBe('(LOWER(slug) = $1)')
      expect(params).toEqual(['foo'])
    })

    it('supports case-sensitive LIKE', () => {
      const { condition, params } = buildSearchCondition('X', ['name'], {
        caseSensitive: true,
      })
      expect(condition).toBe('(name LIKE $1)')
      expect(params).toEqual(['%X%'])
    })

    it('honors paramOffset', () => {
      const { condition } = buildSearchCondition('x', ['a', 'b'], { paramOffset: 5 })
      expect(condition).toBe('(LOWER(a) ILIKE $5 OR LOWER(b) ILIKE $6)')
    })
  })

  describe('parseSearchQuery', () => {
    it('parses q and fields from query', () => {
      const parsed = parseSearchQuery(
        { q: '  hello ', fields: 'name, email' },
        { defaultFields: ['name'] }
      )
      expect(parsed.query).toBe('hello')
      expect(parsed.fields).toEqual(['name', 'email'])
      expect(parsed.isEmpty).toBe(false)
    })

    it('falls back to defaultFields when fields empty', () => {
      const parsed = parseSearchQuery({ q: 'x' }, { defaultFields: ['title'] })
      expect(parsed.fields).toEqual(['title'])
    })

    it('reports isEmpty when q missing', () => {
      const parsed = parseSearchQuery({}, { defaultFields: ['name'] })
      expect(parsed.isEmpty).toBe(true)
      expect(parsed.query).toBe('')
    })

    it('honors custom queryParam/fieldsParam', () => {
      const parsed = parseSearchQuery(
        { term: 'a', cols: 'x,y' },
        { queryParam: 'term', fieldsParam: 'cols', defaultFields: [] }
      )
      expect(parsed.query).toBe('a')
      expect(parsed.fields).toEqual(['x', 'y'])
    })
  })

  describe('buildWhereClause', () => {
    it('returns empty WHERE when no search/filters', () => {
      expect(buildWhereClause({})).toEqual({ whereClause: '', params: [] })
    })

    it('combines search + equality filters', () => {
      const { whereClause, params } = buildWhereClause({
        searchQuery: 'foo',
        searchFields: ['name'],
        filters: { status: 'active' },
      })
      expect(whereClause).toBe('WHERE (LOWER(name) ILIKE $1) AND status = $2')
      expect(params).toEqual(['%foo%', 'active'])
    })

    it('uses IN clause for array filter values', () => {
      const { whereClause, params } = buildWhereClause({
        filters: { role: ['admin', 'user'] },
      })
      expect(whereClause).toBe('WHERE role IN ($1, $2)')
      expect(params).toEqual(['admin', 'user'])
    })

    it('skips null/undefined/empty filter values', () => {
      const { whereClause, params } = buildWhereClause({
        filters: { a: null, b: undefined, c: '', d: 'x' },
      })
      expect(whereClause).toBe('WHERE d = $1')
      expect(params).toEqual(['x'])
    })
  })

  describe('sanitizeSearchQuery', () => {
    it('returns empty string for falsy input', () => {
      expect(sanitizeSearchQuery('')).toBe('')
      expect(sanitizeSearchQuery(null)).toBe('')
      expect(sanitizeSearchQuery(undefined)).toBe('')
    })

    it('strips risky characters', () => {
      expect(sanitizeSearchQuery("bob'; DROP TABLE users;--")).toBe(
        'bob DROP TABLE users--'
      )
    })

    it('normalizes whitespace', () => {
      expect(sanitizeSearchQuery('  a   b\tc  ')).toBe('a b c')
    })

    it('limits length to 200 characters', () => {
      const long = 'x'.repeat(500)
      expect(sanitizeSearchQuery(long).length).toBe(200)
    })
  })

  describe('buildOrderByClause', () => {
    it('uses default sort when sortBy not allowed', () => {
      expect(buildOrderByClause({ sortBy: 'evil', allowedFields: ['name'] })).toBe(
        'ORDER BY created_at DESC'
      )
    })

    it('honors allowed sortBy and asc direction', () => {
      expect(
        buildOrderByClause({
          sortBy: 'name',
          sortOrder: 'asc',
          allowedFields: ['name'],
        })
      ).toBe('ORDER BY name ASC')
    })

    it('defaults to DESC for unknown direction', () => {
      expect(
        buildOrderByClause({
          sortBy: 'name',
          sortOrder: 'sideways',
          allowedFields: ['name'],
        })
      ).toBe('ORDER BY name DESC')
    })

    it('honors custom defaultSort', () => {
      expect(buildOrderByClause({ defaultSort: 'updated_at' })).toBe(
        'ORDER BY updated_at DESC'
      )
    })
  })
})
