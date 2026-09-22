// Re-export auth helpers — bridge between middleware path and canonical location
const auth = require('../../lib/@system/Helpers/auth')

module.exports = {
  ...auth,
  requireAuth: auth.authenticate // alias used by @custom routes
}
