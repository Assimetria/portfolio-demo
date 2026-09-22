const express = require('express')
const router = express.Router()
const { generateCsrfToken } = require('../../lib/@system/Middleware')

/**
 * GET /csrf-token
 * 
 * Returns a CSRF token that must be included in subsequent state-changing requests.
 * 
 * The token is also set as an httpOnly cookie and must be sent back in the
 * X-CSRF-Token header for POST/PUT/PATCH/DELETE requests to protected endpoints.
 * 
 * @route GET /api/csrf-token
 * @returns {object} 200 - CSRF token
 * @returns {object} 500 - Internal server error
 */
router.get('/csrf-token', generateCsrfToken)

module.exports = router
