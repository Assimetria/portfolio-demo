/**
 * @system Team Invitations API
 * Team invitation management endpoints
 */

const express = require('express')
const router = express.Router({ mergeParams: true })
const { authenticate } = require('../../../lib/@system/Middleware')
const { requireTeamMembership, hasPermission, isRoleHigher } = require('../../../lib/@system/permissions')
const Email = require('../../../lib/@system/Email')
const { validate } = require('../../../lib/@system/Validation')
const { TeamIdParams, TeamInvitationParams, CreateInvitationBody } = require('../../../lib/@system/Validation/schemas/@system/teams')

/**
 * GET /api/teams/:teamId/invitations
 * List all invitations for a team
 */
router.get('/',
  authenticate,
  requireTeamMembership({ permission: 'invitations.read' }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const { includeExpired = false } = req.query

      const invitations = await req.db.teamInvitations.findByTeamId(
        teamId, 
        includeExpired === 'true'
      )

      res.json({ invitations })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * POST /api/teams/:teamId/invitations
 * Invite a user to join the team
 */
router.post('/',
  authenticate,
  validate({ params: TeamIdParams, body: CreateInvitationBody }),
  requireTeamMembership({ permission: 'members.invite' }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const { email, role = 'member', permissions = [], expiresInDays = 7 } = req.body

      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' })
      }

      const emailLower = email.toLowerCase().trim()

      // Cannot invite yourself
      if (emailLower === req.user.email.toLowerCase()) {
        return res.status(400).json({ error: 'Cannot invite yourself' })
      }

      // Check if email already has pending invitation
      const existingPending = await req.db.teamInvitations.findPendingByEmail(emailLower)
      const alreadyInvited = existingPending.find(inv => inv.team_id === parseInt(teamId))
      
      if (alreadyInvited) {
        return res.status(400).json({ error: 'User already has pending invitation to this team' })
      }

      // Check if user is already a member
      const usersRepo = req.db.users || req.app.get('db').users
      const existingUser = await usersRepo.findByEmail(emailLower)
      
      if (existingUser) {
        const isMember = await req.db.teamMembers.isMember(teamId, existingUser.id)
        if (isMember) {
          return res.status(400).json({ error: 'User is already a member of this team' })
        }
      }

      // Cannot invite with role higher than your own
      if (role && !isRoleHigher(req.teamRole, role) && req.teamRole !== 'owner') {
        return res.status(403).json({ error: 'Cannot invite with role higher than your own' })
      }

      // Create invitation
      const invitation = await req.db.teamInvitations.create({
        team_id: teamId,
        email: emailLower,
        role,
        permissions,
        invited_by: req.user.id,
        expiresInDays
      })

      // Get team details for email
      const team = await req.db.teams.findById(teamId)

      // Send invitation email
      try {
        await Email.sendInvitationEmail({
          to: emailLower,
          inviterName: req.user.name || req.user.email,
          orgName: team.name,
          token: invitation.token,
          userId: null // Invitee might not be registered yet
        })
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError)
        // Continue anyway - invitation is created
      }

      // Log activity
      await req.db.teamActivityLog.log({
        team_id: teamId,
        user_id: req.user.id,
        action: 'invitation.sent',
        details: { email: emailLower, role, invitation_id: invitation.id },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      })

      res.status(201).json({ invitation })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * POST /api/teams/:teamId/invitations/:invitationId/resend
 * Resend invitation email
 */
router.post('/:invitationId/resend',
  authenticate,
  validate({ params: TeamInvitationParams }),
  requireTeamMembership({ permission: 'invitations.resend' }),
  async (req, res, next) => {
    try {
      const { teamId, invitationId } = req.params

      const invitation = await req.db.teamInvitations.findById(invitationId)
      
      if (!invitation || invitation.team_id !== parseInt(teamId)) {
        return res.status(404).json({ error: 'Invitation not found' })
      }

      if (invitation.accepted_at) {
        return res.status(400).json({ error: 'Invitation already accepted' })
      }

      // Resend (generates new token and expiry)
      const updatedInvitation = await req.db.teamInvitations.resend(invitationId)

      if (!updatedInvitation) {
        return res.status(400).json({ error: 'Failed to resend invitation' })
      }

      // Get team details
      const team = await req.db.teams.findById(teamId)

      // Send invitation email
      try {
        await Email.sendInvitationEmail({
          to: updatedInvitation.email,
          inviterName: req.user.name || req.user.email,
          orgName: team.name,
          token: updatedInvitation.token,
          userId: null
        })
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError)
      }

      // Log activity
      await req.db.teamActivityLog.log({
        team_id: teamId,
        user_id: req.user.id,
        action: 'invitation.resent',
        details: { invitation_id: invitationId, email: updatedInvitation.email },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      })

      res.json({ invitation: updatedInvitation })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * DELETE /api/teams/:teamId/invitations/:invitationId
 * Revoke (delete) an invitation
 */
router.delete('/:invitationId',
  authenticate,
  validate({ params: TeamInvitationParams }),
  requireTeamMembership({ permission: 'invitations.revoke' }),
  async (req, res, next) => {
    try {
      const { teamId, invitationId } = req.params

      const invitation = await req.db.teamInvitations.findById(invitationId)
      
      if (!invitation || invitation.team_id !== parseInt(teamId)) {
        return res.status(404).json({ error: 'Invitation not found' })
      }

      const success = await req.db.teamInvitations.revoke(invitationId)

      if (!success) {
        return res.status(400).json({ error: 'Failed to revoke invitation' })
      }

      // Log activity
      await req.db.teamActivityLog.log({
        team_id: teamId,
        user_id: req.user.id,
        action: 'invitation.revoked',
        details: { invitation_id: invitationId, email: invitation.email },
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
