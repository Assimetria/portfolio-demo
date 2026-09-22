/**
 * @system Teams API
 * Team management endpoints
 */

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Middleware')
const { requireTeamMembership, requireTeamOwner } = require('../../../lib/@system/permissions')
const { validate } = require('../../../lib/@system/Validation')
const { TeamIdParams, CreateTeamBody, UpdateTeamBody } = require('../../../lib/@system/Validation/schemas/@system/teams')

/**
 * Simple slugify function to create URL-friendly slugs
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '')             // Trim - from end of text
}

/**
 * GET /api/teams
 * List all teams for the authenticated user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    const { limit = 20, offset = 0, search } = req.query

    // Get teams where user is owner
    const ownedTeams = await req.db.teams.findByOwnerId(userId)

    // Get teams where user is a member
    const memberTeams = await req.db.teams.findByMemberId(userId)

    // Combine and deduplicate
    const allTeams = [...ownedTeams, ...memberTeams].reduce((acc, team) => {
      if (!acc.find(t => t.id === team.id)) {
        acc.push(team)
      }
      return acc
    }, [])

    // Apply search filter if provided
    let filteredTeams = allTeams
    if (search) {
      const searchLower = search.toLowerCase()
      filteredTeams = allTeams.filter(team => 
        team.name.toLowerCase().includes(searchLower) ||
        (team.description && team.description.toLowerCase().includes(searchLower))
      )
    }

    // Apply pagination
    const total = filteredTeams.length
    const paginatedTeams = filteredTeams.slice(offset, offset + parseInt(limit))

    res.json({
      teams: paginatedTeams,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/teams
 * Create a new team
 */
router.post('/', authenticate, validate({ body: CreateTeamBody }), async (req, res, next) => {
  try {
    const { name, description, settings = {} } = req.body
    const userId = req.user.id

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Team name is required' })
    }

    // Generate unique slug
    let slug = slugify(name, { lower: true, strict: true })
    let slugExists = await req.db.teams.findBySlug(slug)
    let counter = 1
    
    while (slugExists) {
      slug = `${slugify(name, { lower: true, strict: true })}-${counter}`
      slugExists = await req.db.teams.findBySlug(slug)
      counter++
    }

    // Create team
    const team = await req.db.teams.create({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      owner_id: userId,
      settings
    })

    // Add owner as team member with owner role
    await req.db.teamMembers.create({
      team_id: team.id,
      user_id: userId,
      role: 'owner'
    })

    // Log activity
    await req.db.teamActivityLog.log({
      team_id: team.id,
      user_id: userId,
      action: 'team.created',
      details: { name: team.name },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    })

    res.status(201).json({ team })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/teams/:teamId
 * Get team details
 */
router.get('/:teamId', 
  authenticate, 
  requireTeamMembership({ permission: 'team.read' }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const team = await req.db.teams.findById(teamId)

      if (!team) {
        return res.status(404).json({ error: 'Team not found' })
      }

      // Get member count
      const memberCount = await req.db.teams.getMemberCount(teamId)

      // Get member counts by role
      const roleStats = await req.db.teamMembers.getCountByRole(teamId)

      res.json({
        team: {
          ...team,
          member_count: memberCount,
          role_stats: roleStats,
          user_role: req.teamRole,
          user_permissions: req.teamPermissions
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * PATCH /api/teams/:teamId
 * Update team
 */
router.patch('/:teamId',
  authenticate,
  validate({ params: TeamIdParams, body: UpdateTeamBody }),
  requireTeamMembership({ permission: 'team.update' }),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId
      const { name, description, settings } = req.body

      const updates = {}
      if (name !== undefined) updates.name = name.trim()
      if (description !== undefined) updates.description = description?.trim() || null
      if (settings !== undefined) updates.settings = settings

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' })
      }

      const team = await req.db.teams.update(teamId, updates)

      // Log activity
      await req.db.teamActivityLog.log({
        team_id: teamId,
        user_id: req.user.id,
        action: 'team.updated',
        details: updates,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      })

      res.json({ team })
    } catch (error) {
      next(error)
    }
  }
)

/**
 * DELETE /api/teams/:teamId
 * Delete team (owner only)
 */
router.delete('/:teamId',
  authenticate,
  validate({ params: TeamIdParams }),
  requireTeamOwner(),
  async (req, res, next) => {
    try {
      const teamId = req.params.teamId

      await req.db.teams.delete(teamId)

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  }
)

module.exports = router
