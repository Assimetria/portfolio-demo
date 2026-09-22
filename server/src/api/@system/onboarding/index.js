// @system — onboarding API
// GET  /api/onboarding          — get current user's onboarding status
// POST /api/onboarding/complete — mark onboarding as complete

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const db = require('../../../lib/@system/PostgreSQL')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const { CompleteOnboardingBody } = require('../../../lib/@system/Validation/schemas/@system/onboarding')

// GET /api/onboarding — return whether the current user has completed onboarding
router.get('/onboarding', authenticate, async (req, res, next) => {
  try {
    const row = await db.oneOrNone(
      'SELECT onboarding_completed, onboarding_completed_at FROM users WHERE id = $1',
      [req.user.id]
    )
    res.json({
      completed: row?.onboarding_completed ?? false,
      completedAt: row?.onboarding_completed_at ?? null,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/onboarding/complete — mark onboarding as done, optionally save profile data
// Body: { name?: string, useCase?: string, referralSource?: string }
router.post('/onboarding/complete', authenticate, validate({ body: CompleteOnboardingBody }), async (req, res, next) => {
  try {
    const { name, useCase, referralSource } = req.body

    // Optionally update the user's name if provided
    if (name && typeof name === 'string' && name.trim().length > 0) {
      await db.none(
        'UPDATE users SET name = $2, updated_at = now() WHERE id = $1',
        [req.user.id, name.trim()]
      )
    }

    // Mark onboarding complete
    const updated = await db.one(
      `UPDATE users
         SET onboarding_completed = true,
             onboarding_completed_at = now(),
             updated_at = now()
       WHERE id = $1
       RETURNING id, email, name, role, onboarding_completed, onboarding_completed_at`,
      [req.user.id]
    )

    logger.info(
      { userId: req.user.id, useCase, referralSource },
      'onboarding completed'
    )

    res.json({
      message: 'Onboarding complete',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        onboardingCompleted: updated.onboarding_completed,
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
