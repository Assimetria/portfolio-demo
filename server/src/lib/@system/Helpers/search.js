/**
 * @system — Search Helpers
 *
 * Reusable utilities for building search queries and handling search patterns
 * (PostgreSQL parameter syntax: $1, $2, …).
 *
 * Values are ALWAYS bound as parameters. Column/field names are interpolated,
 * so every identifier that reaches these helpers is checked against a strict
 * identifier pattern — callers must still whitelist which fields a client may
 * pick (see `allowedFields` / `filterFields`), this guard is defence in depth.
 */

/** `column` or `table.column` — nothing else is accepted as an identifier. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/
/** Optional comparison operator suffix on filter keys, e.g. `created_at >=`. */
const FILTER_KEY = /^([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)(?:\s+(=|!=|<>|<|<=|>|>=|LIKE|ILIKE))?$/i

/**
 * Throw unless `name` is a plain SQL identifier. Exported for repos that build
 * dynamic SET/ORDER BY fragments.
 */
function assertIdentifier(name, what = 'identifier') {
  if (typeof name !== 'string' || !IDENTIFIER.test(name)) {
    throw new Error(`Unsafe SQL ${what}: ${JSON.stringify(name)}`)
  }
  return name
}

/**
 * Split a filter key into `{ column, operator }`, validating the column.
 * `'status'` → `{ column: 'status', operator: '=' }`
 * `'created_at >='` → `{ column: 'created_at', operator: '>=' }`
 */
function parseFilterKey(key) {
  const m = typeof key === 'string' ? key.trim().match(FILTER_KEY) : null
  if (!m) throw new Error(`Unsafe SQL filter key: ${JSON.stringify(key)}`)
  return { column: m[1], operator: (m[2] || '=').toUpperCase() }
}

/**
 * Build a PostgreSQL full-text search condition
 * 
 * @param {string} query - Search query string
 * @param {Array<string>} columns - Column names to search
 * @param {Object} options - Search options
 * @param {boolean} options.caseSensitive - Use case-sensitive search (default: false)
 * @param {string} options.mode - Search mode: 'contains', 'starts_with', 'exact' (default: 'contains')
 * @param {number} options.paramOffset - Starting parameter index (default: 1)
 * @returns {Object} SQL condition and parameters
 */
function buildSearchCondition(query, columns, options = {}) {
  const {
    caseSensitive = false,
    mode = 'contains',
    paramOffset = 1,
  } = options

  if (!query || !columns || columns.length === 0) {
    return { condition: '', params: [] }
  }

  columns.forEach((col) => assertIdentifier(col, 'search column'))

  const searchTerm = caseSensitive ? query : query.toLowerCase()
  let pattern

  switch (mode) {
    case 'starts_with':
      pattern = `${searchTerm}%`
      break
    case 'exact':
      pattern = searchTerm
      break
    case 'contains':
    default:
      pattern = `%${searchTerm}%`
      break
  }

  const operator = mode === 'exact' ? '=' : (caseSensitive ? 'LIKE' : 'ILIKE')
  const conditions = columns.map((col, index) => {
    const paramNum = paramOffset + index
    return caseSensitive ? `${col} ${operator} $${paramNum}` : `LOWER(${col}) ${operator} $${paramNum}`
  })

  return {
    condition: `(${conditions.join(' OR ')})`,
    params: columns.map(() => pattern),
  }
}

/**
 * Parse search query parameters
 * 
 * @param {Object} query - Express req.query object
 * @param {Object} options - Configuration options
 * @param {string} options.queryParam - Name of the search query parameter (default: 'q')
 * @param {string} options.fieldsParam - Name of the fields parameter (default: 'fields')
 * @param {Array<string>} options.defaultFields - Default fields to search if none specified
 * @returns {Object} Parsed search configuration
 */
function parseSearchQuery(query, options = {}) {
  const {
    queryParam = 'q',
    fieldsParam = 'fields',
    defaultFields = [],
  } = options

  const searchQuery = query[queryParam]?.trim() || ''
  
  let fields = defaultFields
  if (query[fieldsParam]) {
    const requestedFields = query[fieldsParam].split(',').map((f) => f.trim()).filter(Boolean)
    if (requestedFields.length > 0) {
      fields = requestedFields
    }
  }

  return {
    query: searchQuery,
    fields,
    isEmpty: !searchQuery,
  }
}

/**
 * Build SQL WHERE clause with search and filters
 * 
 * @param {Object} options - Search and filter options
 * @param {string} options.searchQuery - Search term
 * @param {Array<string>} options.searchFields - Fields to search
 * @param {Object} options.filters - Key-value filter conditions
 * @param {string} options.searchMode - Search mode for buildSearchCondition
 * @returns {Object} SQL WHERE clause and parameters
 */
function buildWhereClause(options = {}) {
  const {
    searchQuery,
    searchFields = [],
    filters = {},
    searchMode = 'contains',
  } = options

  const conditions = []
  const params = []

  // Add search condition
  if (searchQuery && searchFields.length > 0) {
    const searchCondition = buildSearchCondition(searchQuery, searchFields, { 
      mode: searchMode,
      paramOffset: params.length + 1,
    })
    if (searchCondition.condition) {
      conditions.push(searchCondition.condition)
      params.push(...searchCondition.params)
    }
  }

  // Add filter conditions. Keys are `column` or `column <op>`; both parts are
  // validated — values are always bound as parameters.
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      const { column, operator } = parseFilterKey(key)
      if (Array.isArray(value)) {
        if (value.length === 0) return
        // Handle IN clause for arrays
        const placeholders = value.map((_, idx) => `$${params.length + idx + 1}`).join(', ')
        conditions.push(`${column} IN (${placeholders})`)
        params.push(...value)
      } else {
        // Handle single value
        params.push(value)
        conditions.push(`${column} ${operator} $${params.length}`)
      }
    }
  })

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return {
    whereClause,
    params,
  }
}

/**
 * Sanitize search query
 * Removes potentially harmful characters and normalizes whitespace
 * 
 * @param {string} query - Raw search query
 * @returns {string} Sanitized query
 */
function sanitizeSearchQuery(query) {
  if (!query) return ''
  
  return query
    .trim()
    .replace(/[;'"\\]/g, '')  // Remove SQL-injection risky chars
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .substring(0, 200)        // Limit length
}

/**
 * Build ORDER BY clause with sorting
 * 
 * @param {Object} options - Sorting options
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort direction: 'asc' or 'desc' (default: 'desc')
 * @param {Array<string>} options.allowedFields - Whitelist of sortable fields
 * @param {string} options.defaultSort - Default sort field
 * @returns {string} SQL ORDER BY clause
 */
function buildOrderByClause(options = {}) {
  const {
    sortBy,
    sortOrder = 'desc',
    allowedFields = [],
    defaultSort = 'created_at',
  } = options

  let field = defaultSort
  if (sortBy && allowedFields.includes(sortBy)) {
    field = sortBy
  }
  assertIdentifier(field, 'sort column')

  const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  return `ORDER BY ${field} ${direction}`
}

module.exports = {
  buildSearchCondition,
  parseSearchQuery,
  buildWhereClause,
  sanitizeSearchQuery,
  buildOrderByClause,
  assertIdentifier,
  parseFilterKey,
}
