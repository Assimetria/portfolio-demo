/**
 * @system Team Members API
 * Team member management endpoints
 */

const express = require('express')
const router = express.Router({ mergeParams: true })
const { authenticate } = require('../../../lib/@system/Middleware')
const { requireTeamMembership, hasPermission, isRoleHigher } = require('../../../lib/@system/permissions')
const { validate } = require('../../../lib/@system/Validation')
const { TeamIdParams, TeamMemberParams, UpdateTeamMemberBody } = require('../../../lib/@system/Validation/schemas/@system/teams')

/**
 * GET /api/teams/:teamId/members
 * List all members of a team
 */
router.get('/',
  authenticate,
  requireTeamMembership({ permission: 'members.read' }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const members = await req.db.teamMembers.findByTeamId(teamId)

      res.json({ members })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * GET /api/teams/:teamId/members/:userId
 * Get specific member details
 */
router.get('/:userId',
  authenticate,
  requireTeamMembership({ permission: 'members.read' }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = req.params
      const member = await req.db.teamMembers.findByTeamAndUser(teamId, userId)

      if (!member) {
        return res.status(404).json({ error: 'Member not found' })
      }

      res.json({ member })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * PATCH /api/teams/:teamId/members/:userId
 * Update member role/permissions
 */
router.patch('/:userId',
  authenticate,
  validate({ params: TeamMemberParams, body: UpdateTeamMemberBody }),
  requireTeamMembership({ permission: 'members.update_role' }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = req.params
      const { role, permissions } = req.body

      // Can't modify yourself
      if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'Cannot modify your own role' })
      }

      // Get target member
      const targetMember = await req.db.teamMembers.findByTeamAndUser(teamId, userId)
      if (!targetMember) {
        return res.status(404).json({ error: 'Member not found' })
      }

      // Cannot modify team owner
      const team = await req.db.teams.findById(teamId)
      if (team.owner_id === parseInt(userId)) {
        return res.status(400).json({ error: 'Cannot modify team owner role' })
      }

      // Cannot assign role higher than your own
      if (role && !isRoleHigher(req.teamRole, role) && req.teamRole !== role) {
        return res.status(403).json({ error: 'Cannot assign role higher than your own' })
      }

      // Cannot modify someone with higher role
      if (isRoleHigher(targetMember.role, req.teamRole)) {
        return res.status(403).json({ error: 'Cannot modify member with higher role' })
      }

      const updates = {}
      if (role !== undefined) updates.role = role
      if (permissions !== undefined) updates.permissions = permissions

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      const member = await req.db.teamMembers.update(teamId, userId, updates)

      // Log activity
      await req.db.teamActivityLog.log({
        team_id: teamId,
        user_id: req.user.id,
        action: 'member.role_updated',
        details: { target_user_id: userId, ...updates },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      })

      res.json({ member })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * DELETE /api/teams/:teamId/members/:userId
 * Remove member from team
 */
router.delete('/:userId',
  authenticate,
  validate({ params: TeamMemberParams }),
  requireTeamMembership({ permission: 'members.remove' }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = req.params

      // Cannot remove yourself (use leave endpoint instead)
      if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'Use /leave endpoint to leave team' })
      }

      // Get target member
      const targetMember = await req.db.teamMembers.findByTeamAndUser(teamId, userId)
      if (!targetMember) {
        return res.status(404).json({ error: 'Member not found' })
      }

      // Cannot remove team owner
      const team = await req.db.teams.findById(teamId)
      if (team.owner_id === parseInt(userId)) {
        return res.status(400).json({ error: 'Cannot remove team owner' })
      }

      // Cannot remove someone with higher role
      if (isRoleHigher(targetMember.role, req.teamRole)) {
        return res.status(403).json({ error: 'Cannot remove member with higher role' })
      }

      await req.db.teamMembers.delete(teamId, userId)

      // Log activity
      await req.db.teamActivityLog.log({
        team_id: teamId,
        user_id: req.user.id,
        action: 'member.removed',
        details: { target_user_id: userId, target_role: targetMember.role },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      })

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * POST /api/teams/:teamId/members/leave
 * Leave a team
 */
router.post('/leave',
  authenticate,
  validate({ params: TeamIdParams }),
  requireTeamMembership(),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const userId = req.user.id

      // Cannot leave if you're the owner
      const team = await req.db.teams.findById(teamId)
      if (team.owner_id === userId) {
        return res.status(400).json({ error: 'Team owner cannot leave. Transfer ownership or delete the team.' })
      }

      await req.db.teamMembers.delete(teamId, userId)

      // Log activity
      await req.db.teamActivityLog.log({
        team_id: teamId,
        user_id: userId,
        action: 'member.left',
        details: { user_id: userId },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      })

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  }
)

module.exports = router
