/**
 * Response Helpers
 * 
 * Standard response formatters for consistent API responses
 */

/**
 * Success response
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
function success(res, data, message, statusCode = 200) {
  const response = { success: true }
  
  if (message) response.message = message
  if (data !== undefined) response.data = data
  
  return res.status(statusCode).json(response)
}

/**
 * Created response (201)
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Optional message
 */
function created(res, data, message = 'Resource created') {
  return success(res, data, message, 201)
}

/**
 * No content response (204)
 * 
 * @param {Object} res - Express response object
 */
function noContent(res) {
  return res.status(204).end()
}

/**
 * Error response
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {Object} errors - Optional validation errors object
 */
function error(res, message, statusCode = 400, errors = null) {
  const response = {
    success: false,
    message,
  }
  
  if (errors) response.errors = errors
  
  return res.status(statusCode).json(response)
}

/**
 * Not found response (404)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Not found message
 */
function notFound(res, message = 'Resource not found') {
  return error(res, message, 404)
}

/**
 * Unauthorized response (401)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, 401)
}

/**
 * Forbidden response (403)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function forbidden(res, message = 'Forbidden') {
  return error(res, message, 403)
}

/**
 * Validation error response (422)
 * 
 * @param {Object} res - Express response object
 * @param {Object} errors - Validation errors object
 * @param {string} message - Error message
 */
function validationError(res, errors, message = 'Validation failed') {
  return error(res, message, 422, errors)
}

/**
 * Conflict response (409)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function conflict(res, message = 'Resource already exists') {
  return error(res, message, 409)
}

/**
 * Too many requests response (429)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} retryAfter - Seconds until client can retry
 */
function tooManyRequests(res, message = 'Too many requests', retryAfter = null) {
  if (retryAfter) {
    res.set('Retry-After', String(retryAfter))
  }
  return error(res, message, 429)
}

/**
 * Internal server error response (500)
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function serverError(res, message = 'Internal server error') {
  return error(res, message, 500)
}

module.exports = {
  success,
  created,
  noContent,
  error,
  notFound,
  unauthorized,
  forbidden,
  validationError,
  conflict,
  tooManyRequests,
  serverError,
}
