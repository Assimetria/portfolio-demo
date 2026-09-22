/**
 * Sorting middleware
 * 
 * Parses sort and order query parameters
 * Validates against allowed fields
 * Attaches parsed sorting config to req.sorting
 * 
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.allowedFields - Whitelist of sortable fields (required)
 * @param {string} options.defaultField - Default sort field (default: 'created_at')
 * @param {string} options.defaultOrder - Default sort order (default: 'desc')
 * @param {string} options.fieldParam - Query param name for field (default: 'sort')
 * @param {string} options.orderParam - Query param name for order (default: 'order')
 */
function sorting(options = {}) {
  const {
    allowedFields = [],
    defaultField = 'created_at',
    defaultOrder = 'desc',
    fieldParam = 'sort',
    orderParam = 'order',
  } = options

  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    throw new Error('sorting middleware requires allowedFields array')
  }

  return (req, res, next) => {
    const { [fieldParam]: sortField, [orderParam]: sortOrder } = req.query

    let field = defaultField
    let order = defaultOrder.toLowerCase()

    // Validate and set sort field
    if (sortField && allowedFields.includes(sortField)) {
      field = sortField
    }

    // Validate and set sort order
    if (sortOrder) {
      const normalizedOrder = sortOrder.toLowerCase()
      if (normalizedOrder === 'asc' || normalizedOrder === 'ascending') {
        order = 'asc'
      } else if (normalizedOrder === 'desc' || normalizedOrder === 'descending') {
        order = 'desc'
      }
    }

    // Attach to request
    req.sorting = {
      field,
      order,
      clause: `${field} ${order.toUpperCase()}`,
    }

    next()
  }
}

/**
 * Parse multiple sort parameters
 * Supports sorting by multiple fields: ?sort=name:asc,price:desc
 * 
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.allowedFields - Whitelist of sortable fields (required)
 * @param {string} options.defaultSort - Default sort string (default: 'created_at:desc')
 * @param {string} options.sortParam - Query param name (default: 'sort')
 * @param {number} options.maxSorts - Maximum number of sort fields (default: 3)
 */
function multiSort(options = {}) {
  const {
    allowedFields = [],
    defaultSort = 'created_at:desc',
    sortParam = 'sort',
    maxSorts = 3,
  } = options

  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    throw new Error('multiSort middleware requires allowedFields array')
  }

  return (req, res, next) => {
    const sortParamValue = req.query[sortParam]

    if (!sortParamValue) {
      // Use default sort
      const [field, order = 'desc'] = defaultSort.split(':')
      req.sorting = {
        fields: [{ field, order: order.toLowerCase() }],
        clause: `${field} ${order.toUpperCase()}`,
      }
      return next()
    }

    // Parse multiple sorts
    const sorts = sortParamValue
      .split(',')
      .slice(0, maxSorts) // Limit number of sorts
      .map((s) => {
        const [field, order = 'desc'] = s.trim().split(':')
        return { field, order: order.toLowerCase() }
      })
      .filter((s) => allowedFields.includes(s.field)) // Only allowed fields

    if (sorts.length === 0) {
      // No valid sorts, use default
      const [field, order = 'desc'] = defaultSort.split(':')
      sorts.push({ field, order: order.toLowerCase() })
    }

    // Build ORDER BY clause
    const clause = sorts
      .map((s) => `${s.field} ${s.order.toUpperCase()}`)
      .join(', ')

    req.sorting = {
      fields: sorts,
      clause,
    }

    next()
  }
}

/**
 * Format sorting for SQL ORDER BY clause
 * 
 * @param {Object} sorting - Sorting config from req.sorting
 * @returns {string} SQL ORDER BY clause (without 'ORDER BY' keyword)
 */
function formatSortClause(sorting) {
  if (!sorting) return ''
  
  if (sorting.clause) {
    return sorting.clause
  }
  
  if (sorting.field && sorting.order) {
    return `${sorting.field} ${sorting.order.toUpperCase()}`
  }
  
  return ''
}

module.exports = {
  sorting,
  multiSort,
  formatSortClause,
}
