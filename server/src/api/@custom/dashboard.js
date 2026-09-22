// @custom — dashboard overview route (feature #968: Dashboard & Navigation)
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')

// GET /api/dashboard — authenticated dashboard summary
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
