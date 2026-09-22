// password-validator.js — shared server-side password strength validation
// Used by: POST /api/users (register), POST /api/users/me/password, POST /api/users/password/reset

const RULES = [
  { key: 'minLength',  test: (p) => p.length >= 12,                        message: 'Password must be at least 12 characters' },
  { key: 'uppercase',  test: (p) => /[A-Z]/.test(p),                      message: 'Password must contain at least one uppercase letter' },
  { key: 'number',     test: (p) => /[0-9]/.test(p),                      message: 'Password must contain at least one number' },
  { key: 'special',    test: (p) => /[^A-Za-z0-9]/.test(p),               message: 'Password must contain at least one special character' },
]

/**
 * Validates a password against the minimum required rules.
 * Returns { valid: true } or { valid: false, message: string }
 */
function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, message: 'Password is required' }
  }

  for (const rule of RULES) {
    if (!rule.test(password)) {
      return { valid: false, message: rule.message }
    }
  }

  return { valid: true }
}

/**
 * Express middleware that validates req.body.password.
 * Responds 400 with message on failure; calls next() on success.
 */
function validatePasswordMiddleware(req, res, next) {
  const password = req.body?.password ?? req.body?.newPassword
  const result = validatePassword(password)
  if (!result.valid) {
    return res.status(400).json({ message: result.message })
  }
  next()
}

module.exports = { validatePassword, validatePasswordMiddleware, RULES }
