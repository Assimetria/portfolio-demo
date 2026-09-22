// @custom — admin overview route (feature #973: Admin Panel)
const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../lib/@system/Helpers')

// GET /api/admin — authenticated admin overview
router.get('/admin', authenticate, requireAdmin, async (req, res, next) => {
  try {
    res.json({
      admin: true,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
