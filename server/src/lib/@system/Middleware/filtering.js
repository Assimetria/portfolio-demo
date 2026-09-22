/**
 * Filtering middleware
 * 
 * Parses and validates filter query parameters
 * Supports multiple data types and operators
 * Attaches parsed filters to req.filters
 * 
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.allowedFields - Whitelist of filterable fields (required)
 * @param {Object} options.fieldTypes - Field type mappings { fieldName: 'string'|'number'|'boolean'|'date'|'array' }
 * @param {Array<string>} options.booleanFields - Fields that should be parsed as booleans
 * @param {Array<string>} options.numberFields - Fields that should be parsed as numbers
 * @param {Array<string>} options.arrayFields - Fields that accept comma-separated arrays
 * @param {Array<string>} options.dateFields - Fields that should be parsed as dates
 */
function filtering(options = {}) {
  const {
    allowedFields = [],
    fieldTypes = {},
    booleanFields = [],
    numberFields = [],
    arrayFields = [],
    dateFields = [],
  } = options

  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    throw new Error('filtering middleware requires allowedFields array')
  }

  return (req, res, next) => {
    const filters = {}
    const errors = []

    // Process each allowed field
    allowedFields.forEach((field) => {
      const value = req.query[field]
      
      if (value === undefined || value === null || value === '') {
        return
      }

      try {
        // Determine field type
        const type = fieldTypes[field] ||
          (booleanFields.includes(field) ? 'boolean' :
           numberFields.includes(field) ? 'number' :
           arrayFields.includes(field) ? 'array' :
           dateFields.includes(field) ? 'date' :
           'string')

        // Parse based on type
        switch (type) {
          case 'boolean':
            filters[field] = parseBoolean(value)
            break
          
          case 'number':
            filters[field] = parseNumber(value, field, errors)
            break
          
          case 'array':
            filters[field] = parseArray(value)
            break
          
          case 'date':
            filters[field] = parseDate(value, field, errors)
            break
          
          case 'string':
          default:
            filters[field] = String(value).trim()
            break
        }
      } catch (err) {
        errors.push({ field, message: err.message })
      }
    })

    // Check for filter errors
    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Invalid filter parameters',
        errors,
      })
    }

    // Attach to request
    req.filters = filters

    next()
  }
}

/**
 * Advanced filtering with operators
 * Supports operators like: gt, gte, lt, lte, ne, in, like
 * Query format: ?field[operator]=value
 * Examples:
 *   ?price[gte]=100&price[lte]=500
 *   ?name[like]=laptop
 *   ?status[in]=active,pending
 * 
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.allowedFields - Whitelist of filterable fields (required)
 * @param {Array<string>} options.allowedOperators - Allowed operators (default: all)
 * @param {Object} options.fieldTypes - Field type mappings
 */
function advancedFiltering(options = {}) {
  const {
    allowedFields = [],
    allowedOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'like', 'ilike'],
    fieldTypes = {},
  } = options

  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    throw new Error('advancedFiltering middleware requires allowedFields array')
  }

  // Operator to SQL mapping
  const operatorMap = {
    eq: '=',
    ne: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    in: 'IN',
    nin: 'NOT IN',
    like: 'LIKE',
    ilike: 'ILIKE',
  }

  return (req, res, next) => {
    const filters = []
    const params = []
    const errors = []

    allowedFields.forEach((field) => {
      // Check for simple field (no operator)
      if (req.query[field] !== undefined) {
        const value = req.query[field]
        params.push(value)
        filters.push({
          field,
          operator: '=',
          value,
          sql: `${field} = $${params.length}`,
        })
        return
      }

      // Check for operator-based filters
      Object.keys(req.query).forEach((key) => {
        const match = key.match(new RegExp(`^${field}\\[(.+)\\]$`))
        if (!match) return

        const operator = match[1]
        const value = req.query[key]

        // Validate operator
        if (!allowedOperators.includes(operator)) {
          errors.push({ field, message: `Operator "${operator}" not allowed` })
          return
        }

        const sqlOperator = operatorMap[operator]

        try {
          // Parse value based on field type
          const type = fieldTypes[field] || 'string'
          let parsedValue = value

          if (operator === 'in' || operator === 'nin') {
            // Parse array for IN/NOT IN
            parsedValue = parseArray(value)
            const placeholders = parsedValue.map((_, i) => `$${params.length + i + 1}`).join(', ')
            params.push(...parsedValue)
            filters.push({
              field,
              operator: sqlOperator,
              value: parsedValue,
              sql: `${field} ${sqlOperator} (${placeholders})`,
            })
          } else if (operator === 'like' || operator === 'ilike') {
            // Add wildcards for LIKE
            parsedValue = `%${value}%`
            params.push(parsedValue)
            filters.push({
              field,
              operator: sqlOperator,
              value: parsedValue,
              sql: `${field} ${sqlOperator} $${params.length}`,
            })
          } else {
            // Standard comparison operators
            if (type === 'number') {
              parsedValue = parseNumber(value, field, errors)
            } else if (type === 'date') {
              parsedValue = parseDate(value, field, errors)
            }
            
            params.push(parsedValue)
            filters.push({
              field,
              operator: sqlOperator,
              value: parsedValue,
              sql: `${field} ${sqlOperator} $${params.length}`,
            })
          }
        } catch (err) {
          errors.push({ field, message: err.message })
        }
      })
    })

    // Check for errors
    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Invalid filter parameters',
        errors,
      })
    }

    // Build WHERE clause
    const whereClause = filters.length > 0
      ? filters.map((f) => f.sql).join(' AND ')
      : ''

    // Attach to request
    req.filters = {
      filters,
      params,
      whereClause,
    }

    next()
  }
}

/**
 * Helper: Parse boolean value
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  const str = String(value).toLowerCase()
  return str === 'true' || str === '1' || str === 'yes'
}

/**
 * Helper: Parse number value
 */
function parseNumber(value, field, errors) {
  const num = Number(value)
  if (isNaN(num)) {
    errors.push({ field, message: `Invalid number value: ${value}` })
    return null
  }
  return num
}

/**
 * Helper: Parse array value (comma-separated)
 */
function parseArray(value) {
  if (Array.isArray(value)) return value
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/**
 * Helper: Parse date value
 */
function parseDate(value, field, errors) {
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    errors.push({ field, message: `Invalid date value: ${value}` })
    return null
  }
  return date.toISOString()
}

module.exports = {
  filtering,
  advancedFiltering,
  parseBoolean,
  parseNumber,
  parseArray,
  parseDate,
}
