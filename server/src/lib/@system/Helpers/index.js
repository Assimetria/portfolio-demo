/**
 * @system Helpers
 * 
 * Reusable utilities for building APIs with common patterns
 */

const auth = require('./auth')
const jwt = require('./jwt')
const crud = require('./crud')
const search = require('./search')
const response = require('./response')
const queryBuilder = require('./query-builder')
const passwordValidator = require('./password-validator')
const apiUtils = require('./api-utils')
const middleware = require('../Middleware')
const BaseRepository = require('./base-repository')
const tokens = require('./tokens')
const date = require('./date')
const network = require('./network')

module.exports = {
  // Auth helpers
  ...auth,

  // JWT helpers
  ...jwt,

  // CRUD helpers
  ...crud,

  // Search helpers
  ...search,

  // Response helpers
  ...response,

  // Query builder helpers
  ...queryBuilder,

  // API utilities
  ...apiUtils,

  // Date/calendar utilities
  ...date,

  // Network/IP utilities
  ...network,

  // Base Repository class
  BaseRepository,

  // Password validation
  validatePassword: passwordValidator.validatePassword,

  // Token utilities
  ...tokens,

  // Middleware (re-exported for convenience)
  pagination: middleware.pagination,
  sorting: middleware.sorting,
  multiSort: middleware.multiSort,
  filtering: middleware.filtering,
  advancedFiltering: middleware.advancedFiltering,
  formatPaginatedResponse: middleware.formatPaginatedResponse,
  formatSortClause: middleware.formatSortClause,
}
