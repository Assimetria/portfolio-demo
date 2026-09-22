/**
 * @system Teams Router
 * Combines all team-related routes
 */

const express = require('express')
const router = express.Router()
const { authenticate, attachDatabase } = require('../../../lib/@system/Middleware')
const { validate } = require('../../../lib/@system/Validation')
const { InvitationTokenParams } = require('../../../lib/@system/Validation/schemas/@system/teams')

// Main teams routes
const teamsRoutes = require('./index')
const membersRoutes = require('./members')
const teamInvitationsRoutes = require('./invitations')
const activityRoutes = require('./activity')

// Attach req.db (teams, teamMembers, teamInvitations, teamActivityLog) for all team routes
router.use(attachDatabase)

// Register nested team routes
router.use('/teams', teamsRoutes)
router.use('/teams/:teamId/members', membersRoutes)
router.use('/teams/:teamId/invitations', teamInvitationsRoutes)
router.use('/teams/:teamId/activity', activityRoutes)

// Standalone invitation routes (at /api/invitations/*)
// These don't require a team context and are public endpoints (with auth)
router.post('/invitations/accept/:token', authenticate, validate({ params: InvitationTokenParams }), async (req, res, next) => {
  try {
    const { token } = req.params
    const userId = req.user.id

    // Validate invitation
    const invitation = await req.db.teamInvitations.findByToken(token)

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    if (invitation.accepted_at) {
      return res.status(400).json({ error: 'Invitation already accepted' })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' })
    }

    // Check if user's email matches invitation email
    if (req.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(400).json({ error: 'This invitation was sent to a different email address' })
    }

    // Check if already a member
    const isMember = await req.db.teamMembers.isMember(invitation.team_id, userId)
    if (isMember) {
      return res.status(400).json({ error: 'You are already a member of this team' })
    }

    // Accept invitation
    const acceptedInvitation = await req.db.teamInvitations.accept(token, userId)

    if (!acceptedInvitation) {
      return res.status(400).json({ error: 'Failed to accept invitation' })
    }

    // Add user as team member
    await req.db.teamMembers.create({
      team_id: invitation.team_id,
      user_id: userId,
      role: invitation.role,
      permissions: invitation.permissions
    })

    // Log activity
    await req.db.teamActivityLog.log({
      team_id: invitation.team_id,
      user_id: userId,
      action: 'member.joined',
      details: { role: invitation.role, via: 'invitation' },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    })

    // Get team details
    const team = await req.db.teams.findById(invitation.team_id)

    res.json({ 
      success: true,
      team,
      role: invitation.role
    })
  } catch (error) {
    next(error)
  }
})

router.get('/invitations/pending', authenticate, async (req, res, next) => {
  try {
    const email = req.user.email.toLowerCase()
    const invitations = await req.db.teamInvitations.findPendingByEmail(email)

    res.json({ invitations })
  } catch (error) {
    next(error)
  }
})

module.exports = router
