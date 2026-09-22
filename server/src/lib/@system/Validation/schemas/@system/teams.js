// @system — zod request schemas for api/@system/teams (index.js, members.js, invitations.js, router.js)
// Route params are coerced to positive-integer DB ids so handlers can keep using parseInt()/=== on them.
// Bodies mirror exactly what each handler destructures from req.body; roles come from ROLE_HIERARCHY.
const { z } = require('zod')
const { ROLE_HIERARCHY } = require('../../../permissions')

const dbId = (label) =>
  z.coerce.number().int(`${label} must be an integer`).positive(`${label} must be a positive integer`)

const TeamRole = z.enum(Object.keys(ROLE_HIERARCHY))

// ── Params ────────────────────────────────────────────────────────────────
const TeamIdParams = z.object({
  teamId: dbId('teamId'),
})

const TeamMemberParams = z.object({
  teamId: dbId('teamId'),
  userId: dbId('userId'),
})

const TeamInvitationParams = z.object({
  teamId: dbId('teamId'),
  invitationId: dbId('invitationId'),
})

// Invitation tokens are 32 random bytes hex-encoded (64 chars); allow some slack for legacy rows.
const InvitationTokenParams = z.object({
  token: z.string().min(1, 'token is required').max(255, 'token is too long'),
})

// ── Bodies ────────────────────────────────────────────────────────────────
const CreateTeamBody = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(255, 'Team name must be at most 255 characters'),
  description: z.string().max(2000, 'description must be at most 2000 characters').nullable().optional(),
  settings: z.record(z.string(), z.any()).optional(),
})

const UpdateTeamBody = z.object({
  name: z.string().trim().min(1, 'Team name cannot be empty').max(255, 'Team name must be at most 255 characters').optional(),
  description: z.string().max(2000, 'description must be at most 2000 characters').nullable().optional(),
  settings: z.record(z.string(), z.any()).optional(),
})

const UpdateTeamMemberBody = z.object({
  role: TeamRole.optional(),
  permissions: z.array(z.string().min(1).max(100)).optional(),
})

const CreateInvitationBody = z.object({
  email: z.string().trim().min(1, 'Email is required').email('email must be a valid email address'),
  role: TeamRole.default('member'),
  permissions: z.array(z.string().min(1).max(100)).default([]),
  expiresInDays: z.coerce.number().int().min(1, 'expiresInDays must be at least 1').max(365, 'expiresInDays must be at most 365').default(7),
})

module.exports = {
  TeamRole,
  TeamIdParams,
  TeamMemberParams,
  TeamInvitationParams,
  InvitationTokenParams,
  CreateTeamBody,
  UpdateTeamBody,
  UpdateTeamMemberBody,
  CreateInvitationBody,
}
