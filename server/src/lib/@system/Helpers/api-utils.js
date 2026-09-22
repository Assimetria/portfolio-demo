/**
 * API Utilities
 * 
 * Additional convenience helpers for common API patterns
 */

/**
 * Async route handler wrapper
 * Automatically catches errors and passes to next()
 * 
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Create a resource not found handler
 * 
 * @param {string} resourceName - Name of the resource (e.g., 'Product')
 * @returns {Function} Middleware function
 */
function createNotFoundHandler(resourceName) {
  return (req, res) => {
    res.status(404).json({
      message: `${resourceName} not found`,
      resource: resourceName.toLowerCase(),
      id: req.params.id,
    })
  }
}

/**
 * Require fields in request body
 * Returns 400 if any required fields are missing
 * 
 * @param {Array<string>} fields - Required field names
 * @returns {Function} Middleware function
 */
function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const value = req.body[field]
      return value === undefined || value === null || value === ''
    })

    if (missing.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        missing,
      })
    }

    next()
  }
}

/**
 * Parse boolean query parameters
 * Converts 'true'/'false' strings to actual booleans
 * 
 * @param {Object} query - req.query object
 * @param {Array<string>} boolFields - Field names that should be booleans
 * @returns {Object} Query with parsed booleans
 */
function parseBooleanParams(query, boolFields) {
  const parsed = { ...query }
  
  boolFields.forEach((field) => {
    if (query[field] !== undefined) {
      parsed[field] = query[field] === 'true' || query[field] === '1'
    }
  })
  
  return parsed
}

/**
 * Parse array query parameters
 * Converts comma-separated strings to arrays
 * 
 * @param {Object} query - req.query object
 * @param {Array<string>} arrayFields - Field names that should be arrays
 * @returns {Object} Query with parsed arrays
 */
function parseArrayParams(query, arrayFields) {
  const parsed = { ...query }
  
  arrayFields.forEach((field) => {
    if (query[field] !== undefined && typeof query[field] === 'string') {
      parsed[field] = query[field].split(',').map((v) => v.trim()).filter(Boolean)
    }
  })
  
  return parsed
}

/**
 * Parse integer query parameters
 * Converts string numbers to integers, with validation
 * 
 * @param {Object} query - req.query object
 * @param {Array<string>} intFields - Field names that should be integers
 * @param {Object} options - Options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @returns {Object} Query with parsed integers
 */
function parseIntParams(query, intFields, options = {}) {
  const { min, max } = options
  const parsed = { ...query }
  
  intFields.forEach((field) => {
    if (query[field] !== undefined) {
      const value = parseInt(query[field], 10)
      
      if (!isNaN(value)) {
        let finalValue = value
        if (min !== undefined) finalValue = Math.max(min, finalValue)
        if (max !== undefined) finalValue = Math.min(max, finalValue)
        parsed[field] = finalValue
      }
    }
  })
  
  return parsed
}

/**
 * Extract allowed fields from request body
 * Whitelist approach to prevent mass assignment
 * 
 * @param {Object} body - req.body object
 * @param {Array<string>} allowedFields - Allowed field names
 * @returns {Object} Filtered body with only allowed fields
 */
function extractAllowedFields(body, allowedFields) {
  const filtered = {}
  
  allowedFields.forEach((field) => {
    if (body.hasOwnProperty(field)) {
      filtered[field] = body[field]
    }
  })
  
  return filtered
}

/**
 * Build success response
 * 
 * @param {*} data - Response data
 * @param {Object} options - Options
 * @param {string} options.message - Success message
 * @param {Object} options.meta - Additional metadata
 * @returns {Object} Formatted success response
 */
function successResponse(data, options = {}) {
  const response = { success: true }
  
  if (options.message) {
    response.message = options.message
  }
  
  if (data !== undefined) {
    response.data = data
  }
  
  if (options.meta) {
    response.meta = options.meta
  }
  
  return response
}

/**
 * Build error response
 * 
 * @param {string} message - Error message
 * @param {Object} options - Options
 * @param {number} options.code - Error code
 * @param {Object} options.details - Additional error details
 * @returns {Object} Formatted error response
 */
function errorResponse(message, options = {}) {
  const response = {
    success: false,
    message,
  }
  
  if (options.code) {
    response.code = options.code
  }
  
  if (options.details) {
    response.details = options.details
  }
  
  return response
}

/**
 * Validate ID parameter
 * Ensures ID is a valid positive integer or UUID
 * 
 * @param {string} type - 'integer' or 'uuid'
 * @returns {Function} Middleware function
 */
function validateIdParam(type = 'integer') {
  return (req, res, next) => {
    const id = req.params.id
    
    if (!id) {
      return res.status(400).json(errorResponse('ID parameter is required'))
    }
    
    if (type === 'integer') {
      const numId = parseInt(id, 10)
      if (isNaN(numId) || numId <= 0) {
        return res.status(400).json(errorResponse('Invalid ID format. Expected positive integer'))
      }
      req.params.id = numId // Convert to number
    } else if (type === 'uuid') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        return res.status(400).json(errorResponse('Invalid ID format. Expected UUID'))
      }
    }
    
    next()
  }
}

/**
 * Add timestamp to request body
 * Useful for created_at/updated_at
 * 
 * @param {Array<string>} fields - Field names to populate with timestamp
 * @returns {Function} Middleware function
 */
function addTimestamp(...fields) {
  return (req, res, next) => {
    const timestamp = new Date().toISOString()
    fields.forEach((field) => {
      req.body[field] = timestamp
    })
    next()
  }
}

/**
 * Rate limit per user
 * Simple in-memory rate limiting (use Redis in production)
 * 
 * @param {Object} options - Rate limit options
 * @param {number} options.maxRequests - Max requests per window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {Function} options.keyGenerator - Function to generate rate limit key (default: req.user.id)
 * @returns {Function} Middleware function
 */
function rateLimitPerUser(options = {}) {
  const {
    maxRequests = 100,
    windowMs = 60000, // 1 minute
    keyGenerator = (req) => req.user?.id || req.ip,
  } = options
  
  const requests = new Map()
  
  // Clean up old entries every minute
  setInterval(() => {
    const now = Date.now()
    for (const [key, data] of requests.entries()) {
      if (now - data.resetTime > windowMs) {
        requests.delete(key)
      }
    }
  }, windowMs)
  
  return (req, res, next) => {
    const key = keyGenerator(req)
    const now = Date.now()
    
    let userData = requests.get(key)
    
    if (!userData || now - userData.resetTime > windowMs) {
      userData = {
        count: 0,
        resetTime: now,
      }
      requests.set(key, userData)
    }
    
    userData.count++
    
    if (userData.count > maxRequests) {
      return res.status(429).json(
        errorResponse('Too many requests. Please try again later.', {
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            limit: maxRequests,
            window: `${windowMs / 1000}s`,
          },
        })
      )
    }
    
    next()
  }
}

/**
 * Conditional middleware
 * Only runs middleware if condition is met
 * 
 * @param {Function} condition - Function that returns true/false
 * @param {Function} middleware - Middleware to run conditionally
 * @returns {Function} Middleware function
 */
function conditionalMiddleware(condition, middleware) {
  return (req, res, next) => {
    if (condition(req)) {
      return middleware(req, res, next)
    }
    next()
  }
}

/**
 * Merge pagination, search, and filter params
 * Convenience function to parse all common query params at once
 * 
 * @param {Object} req - Express request
 * @param {Object} options - Configuration
 * @param {Array<string>} options.searchFields - Default search fields
 * @param {Array<string>} options.sortableFields - Allowed sortable fields
 * @param {Array<string>} options.filterFields - Filter field names
 * @param {Array<string>} options.booleanFields - Boolean filter fields
 * @param {Array<string>} options.arrayFields - Array filter fields
 * @returns {Object} Parsed query configuration
 */
function parseQueryParams(req, options = {}) {
  const {
    searchFields = [],
    sortableFields = [],
    filterFields = [],
    booleanFields = [],
    arrayFields = [],
  } = options
  
  const { parseSearchQuery, buildWhereClause, buildOrderByClause } = require('./search')
  
  // Parse search
  const search = parseSearchQuery(req.query, {
    defaultFields: searchFields,
  })
  
  // Parse filters
  let parsedQuery = { ...req.query }
  
  if (booleanFields.length > 0) {
    parsedQuery = parseBooleanParams(parsedQuery, booleanFields)
  }
  
  if (arrayFields.length > 0) {
    parsedQuery = parseArrayParams(parsedQuery, arrayFields)
  }
  
  const filters = extractAllowedFields(parsedQuery, filterFields)
  
  // Build WHERE clause
  const { whereClause, params } = buildWhereClause({
    searchQuery: search.query,
    searchFields: search.fields,
    filters,
  })
  
  // Build ORDER BY
  const orderBy = buildOrderByClause({
    sortBy: req.query.sort,
    sortOrder: req.query.order,
    allowedFields: sortableFields,
  })
  
  return {
    search,
    filters,
    whereClause,
    params,
    orderBy,
    pagination: req.pagination,
  }
}

module.exports = {
  asyncHandler,
  createNotFoundHandler,
  requireFields,
  parseBooleanParams,
  parseArrayParams,
  parseIntParams,
  extractAllowedFields,
  successResponse,
  errorResponse,
  validateIdParam,
  addTimestamp,
  rateLimitPerUser,
  conditionalMiddleware,
  parseQueryParams,
}
