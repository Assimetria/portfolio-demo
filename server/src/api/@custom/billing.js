// @custom — billing overview route (feature #970: Billing & Subscriptions)
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')

// GET /api/billing — authenticated billing summary
router.get('/billing', authenticate, async (req, res, next) => {
  try {
    res.json({
      user_id: req.user.id,
      subscription: null,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
