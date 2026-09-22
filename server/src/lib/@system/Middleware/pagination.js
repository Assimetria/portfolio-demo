/**
 * Pagination middleware
 * 
 * Parses limit, offset, and page query parameters
 * Sets reasonable defaults and constraints
 * Attaches parsed pagination config to req.pagination
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.defaultLimit - Default page size (default: 20)
 * @param {number} options.maxLimit - Maximum allowed page size (default: 100)
 * @param {boolean} options.allowAll - Allow limit=-1 for all results (default: false)
 */
function pagination(options = {}) {
  const {
    defaultLimit = 20,
    maxLimit = 100,
    allowAll = false,
  } = options

  return (req, res, next) => {
    const { limit, offset, page } = req.query

    let parsedLimit = defaultLimit
    let parsedOffset = 0

    // Parse limit
    if (limit !== undefined) {
      const limitNum = parseInt(limit, 10)
      if (limitNum === -1 && allowAll) {
        parsedLimit = -1  // Special case: return all
      } else if (!isNaN(limitNum) && limitNum > 0) {
        parsedLimit = Math.min(limitNum, maxLimit)
      }
    }

    // Parse offset or page (page takes precedence)
    if (page !== undefined) {
      const pageNum = parseInt(page, 10)
      if (!isNaN(pageNum) && pageNum > 0) {
        parsedOffset = (pageNum - 1) * parsedLimit
      }
    } else if (offset !== undefined) {
      const offsetNum = parseInt(offset, 10)
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        parsedOffset = offsetNum
      }
    }

    // Attach to request
    req.pagination = {
      limit: parsedLimit,
      offset: parsedOffset,
      page: parsedLimit > 0 ? Math.floor(parsedOffset / parsedLimit) + 1 : 1,
    }

    next()
  }
}

/**
 * Format paginated response
 * 
 * @param {Array} data - The data items
 * @param {number} total - Total count of items
 * @param {Object} pagination - Pagination config from req.pagination
 * @returns {Object} Formatted response with pagination metadata
 */
function formatPaginatedResponse(data, total, pagination) {
  const { limit, offset, page } = pagination

  const response = {
    data,
    total,
    limit,
    offset,
  }

  // Add page metadata if using page-based pagination
  if (limit > 0) {
    response.page = page
    response.total_pages = Math.ceil(total / limit)
    response.has_more = offset + data.length < total
  }

  return response
}

module.exports = {
  pagination,
  formatPaginatedResponse,
}
