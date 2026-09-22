/**
 * @system Team Activity Log API
 * Team activity log endpoints
 */

const express = require('express')
const router = express.Router({ mergeParams: true })
const { authenticate } = require('../../../lib/@system/Middleware')
const { requireTeamMembership } = require('../../../lib/@system/permissions')

/**
 * GET /api/teams/:teamId/activity
 * Get activity log for a team
 */
router.get('/',
  authenticate,
  requireTeamMembership({ permission: 'activity.read' }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const { 
        limit = 50, 
        offset = 0, 
        action = null, 
        user_id = null 
      } = req.query

      const result = await req.db.teamActivityLog.findByTeamId(teamId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        action,
        user_id: user_id ? parseInt(user_id) : null
      })

      res.json(result)
    } catch (error) {
      next(error)
    }
  }
)

/**
 * GET /api/teams/:teamId/activity/recent
 * Get recent activity for a team
 */
router.get('/recent',
  authenticate,
  requireTeamMembership({ permission: 'activity.read' }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const { limit = 10 } = req.query

      const activities = await req.db.teamActivityLog.getRecent(
        teamId, 
        parseInt(limit)
      )

      res.json({ activities })
    } catch (error) {
      next(error)
    }
  }
)

module.exports = router
