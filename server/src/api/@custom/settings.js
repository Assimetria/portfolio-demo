// @custom — settings overview route (feature #971: Settings & Profile)
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')

// GET /api/settings — authenticated user settings
router.get('/settings', authenticate, async (req, res, next) => {
  try {
    res.json({
      user_id: req.user.id,
      settings: {},
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
