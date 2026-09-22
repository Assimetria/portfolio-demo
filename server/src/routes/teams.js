/**
 * Teams scaffold — standalone teams API
 *
 * Self-contained teams router as an alternative to the @system teams module.
 * @system already ships a full teams implementation (server/src/api/@system/teams/).
 * Use this file when you need direct control without the @system middleware layer.
 *
 * Endpoints:
 *   GET    /teams                          — list user's teams
 *   POST   /teams                          — create team (creator becomes owner)
 *   GET    /teams/:id                      — get team with members
 *   PATCH  /teams/:id                      — update team (admin+)
 *   DELETE /teams/:id                      — delete team (owner only)
 *   GET    /teams/:id/members              — list members
 *   POST   /teams/:id/members              — add member
 *   PATCH  /teams/:id/members/:userId      — update member role
 *   DELETE /teams/:id/members/:userId      — remove member
 *   GET    /teams/:id/invitations          — list pending invitations
 *   POST   /teams/:id/invitations          — invite by email
 *   DELETE /teams/:id/invitations/:invId   — revoke invitation
 *   POST   /invitations/:token/accept      — accept invitation (auth required)
 *
 * To activate:
 *   1. Ensure migration 021_teams has been applied (server/src/db/migrations/@system/021_teams.js)
 *   2. Mount in server/src/routes/@custom/index.js:
 *        router.use(require('../../routes/teams'))
 */

const express = require('express')
const crypto = require('crypto')
const router = express.Router()

const { authenticate } = require('../lib/@system/Middleware')
const db = require('../lib/@system/PostgreSQL')

const VALID_ROLES = ['owner', 'admin', 'member', 'viewer']

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function getTeamMemberRole(teamId, userId) {
  const row = await db.oneOrNone(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  )
  return row ? row.role : null
}

async function countOwners(teamId) {
  const row = await db.one(
    "SELECT COUNT(*)::int AS cnt FROM team_members WHERE team_id = $1 AND role = 'owner'",
    [teamId]
  )
  return row.cnt
}

/**
 * Middleware: require team membership at a minimum role level.
 *   minRole = 'any'   → any member ('owner', 'admin', 'member', 'viewer')
 *   minRole = 'admin' → 'owner' or 'admin'
 *   minRole = 'owner' → 'owner' only
 */
function requireTeamAccess(minRole) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' })

      const teamId = parseInt(req.params.id, 10)
      if (isNaN(teamId)) return res.status(400).json({ error: 'Invalid team id' })

      const team = await db.oneOrNone('SELECT id FROM teams WHERE id = $1', [teamId])
      if (!team) return res.status(404).json({ error: 'Team not found' })

      const role = await getTeamMemberRole(teamId, req.user.id)
      if (!role) return res.status(403).json({ error: 'Not a member of this team' })

      if (minRole === 'owner' && role !== 'owner') {
        return res.status(403).json({ error: 'Team owner access required' })
      }
      if (minRole === 'admin' && !['owner', 'admin'].includes(role)) {
        return res.status(403).json({ error: 'Team admin access required' })
      }

      req.teamRole = role
      req.teamId = teamId
      next()
    } catch (err) {
      next(err)
    }
  }
}

// ── Teams CRUD ────────────────────────────────────────────────────────────────

// GET /teams — list teams the authenticated user belongs to
router.get('/teams', authenticate, async (req, res, next) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query
    const maxLimit = Math.min(parseInt(limit, 10) || 50, 200)
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0)

    let sql = `
      SELECT t.id, t.name, t.slug, t.description, t.owner_id, t.settings,
             t.created_at, t.updated_at, tm.role AS my_role,
             (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS member_count
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
    `
    const params = [req.user.id]

    if (search) {
      sql += ` WHERE (t.name ILIKE $${params.length + 1} OR t.description ILIKE $${params.length + 1})`
      params.push(`%${search}%`)
    }

    sql += ` ORDER BY t.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(maxLimit, safeOffset)

    const teams = await db.any(sql, params)
    res.json({ teams, total: teams.length, limit: maxLimit, offset: safeOffset })
  } catch (err) {
    next(err)
  }
})

// POST /teams — create a team
router.post('/teams', authenticate, async (req, res, next) => {
  try {
    const { name, description = null, settings = {} } = req.body || {}
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }

    // Generate unique slug
    let slug = slugify(name)
    let existing = await db.oneOrNone('SELECT id FROM teams WHERE slug = $1', [slug])
    let counter = 1
    while (existing) {
      slug = `${slugify(name)}-${counter++}`
      existing = await db.oneOrNone('SELECT id FROM teams WHERE slug = $1', [slug])
    }

    const team = await db.one(
      `INSERT INTO teams (name, slug, description, owner_id, settings)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), slug, description, req.user.id, settings]
    )

    // Auto-add creator as owner
    await db.none(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [team.id, req.user.id]
    )

    res.status(201).json({ team: { ...team, member_count: 1, my_role: 'owner' } })
  } catch (err) {
    next(err)
  }
})

// GET /teams/:id — team detail with members
router.get('/teams/:id', authenticate, requireTeamAccess('any'), async (req, res, next) => {
  try {
    const team = await db.one(
      `SELECT t.id, t.name, t.slug, t.description, t.owner_id, t.settings,
              t.created_at, t.updated_at,
              (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS member_count
       FROM teams t WHERE t.id = $1`,
      [req.teamId]
    )

    const members = await db.any(
      `SELECT tm.id, tm.user_id, u.name, u.email, tm.role, tm.joined_at
       FROM team_members tm
       INNER JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, tm.joined_at ASC`,
      [req.teamId]
    )

    res.json({ team: { ...team, my_role: req.teamRole, members } })
  } catch (err) {
    next(err)
  }
})

// PATCH /teams/:id — update team
router.patch('/teams/:id', authenticate, requireTeamAccess('admin'), async (req, res, next) => {
  try {
    const { name, description, settings } = req.body || {}
    const updates = []
    const values = []
    let p = 1

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'name cannot be empty' })
      updates.push(`name = $${p++}`)
      values.push(name.trim())
    }
    if (description !== undefined) { updates.push(`description = $${p++}`); values.push(description) }
    if (settings !== undefined)    { updates.push(`settings = $${p++}`);    values.push(settings) }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' })

    updates.push(`updated_at = now()`)
    values.push(req.teamId)

    const team = await db.one(
      `UPDATE teams SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    )
    res.json({ team })
  } catch (err) {
    next(err)
  }
})

// DELETE /teams/:id — delete team (owner only)
router.delete('/teams/:id', authenticate, requireTeamAccess('owner'), async (req, res, next) => {
  try {
    await db.none('DELETE FROM teams WHERE id = $1', [req.teamId])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Members ───────────────────────────────────────────────────────────────────

// GET /teams/:id/members
router.get('/teams/:id/members', authenticate, requireTeamAccess('any'), async (req, res, next) => {
  try {
    const members = await db.any(
      `SELECT tm.id, tm.user_id, u.name, u.email, tm.role, tm.permissions, tm.joined_at
       FROM team_members tm
       INNER JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, tm.joined_at ASC`,
      [req.teamId]
    )
    res.json({ members, total: members.length })
  } catch (err) {
    next(err)
  }
})

// POST /teams/:id/members — add or upsert a member
router.post('/teams/:id/members', authenticate, requireTeamAccess('admin'), async (req, res, next) => {
  try {
    const userId = parseInt(req.body.user_id, 10)
    const role = req.body.role || 'member'

    if (isNaN(userId) || userId <= 0) return res.status(400).json({ error: 'user_id must be a positive integer' })
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` })

    const user = await db.oneOrNone('SELECT id FROM users WHERE id = $1', [userId])
    if (!user) return res.status(404).json({ error: 'User not found' })

    const member = await db.one(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()
       RETURNING *`,
      [req.teamId, userId, role]
    )
    res.status(201).json({ member })
  } catch (err) {
    next(err)
  }
})

// PATCH /teams/:id/members/:userId — update member role
router.patch('/teams/:id/members/:userId', authenticate, requireTeamAccess('admin'), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10)
    const { role } = req.body || {}

    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' })
    if (!role || !VALID_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` })

    const existing = await db.oneOrNone(
      'SELECT id, role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [req.teamId, userId]
    )
    if (!existing) return res.status(404).json({ error: 'Member not found' })

    // Guard: cannot demote the last owner
    if (existing.role === 'owner' && role !== 'owner') {
      const ownerCount = await countOwners(req.teamId)
      if (ownerCount <= 1) return res.status(409).json({ error: 'Cannot demote the last owner' })
    }

    const member = await db.one(
      'UPDATE team_members SET role = $1, updated_at = now() WHERE team_id = $2 AND user_id = $3 RETURNING *',
      [role, req.teamId, userId]
    )
    res.json({ member })
  } catch (err) {
    next(err)
  }
})

// DELETE /teams/:id/members/:userId — remove member
router.delete('/teams/:id/members/:userId', authenticate, requireTeamAccess('admin'), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10)
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' })

    const existing = await db.oneOrNone(
      'SELECT id, role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [req.teamId, userId]
    )
    if (!existing) return res.status(404).json({ error: 'Member not found' })

    if (existing.role === 'owner') {
      const ownerCount = await countOwners(req.teamId)
      if (ownerCount <= 1) return res.status(409).json({ error: 'Cannot remove the last owner' })
    }

    await db.none('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [req.teamId, userId])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ── Invitations ───────────────────────────────────────────────────────────────

// GET /teams/:id/invitations — list pending invitations
router.get('/teams/:id/invitations', authenticate, requireTeamAccess('admin'), async (req, res, next) => {
  try {
    const invitations = await db.any(
      `SELECT ti.id, ti.team_id, ti.email, ti.role, ti.invited_by,
              ti.token, ti.accepted_at, ti.expires_at, ti.created_at,
              u.name AS inviter_name
       FROM team_invitations ti
       LEFT JOIN users u ON u.id = ti.invited_by
       WHERE ti.team_id = $1
       ORDER BY ti.created_at DESC`,
      [req.teamId]
    )
    res.json({ invitations, total: invitations.length })
  } catch (err) {
    next(err)
  }
})

// POST /teams/:id/invitations — invite by email
router.post('/teams/:id/invitations', authenticate, requireTeamAccess('admin'), async (req, res, next) => {
  try {
    const { email, role = 'member' } = req.body || {}
    if (!email || !email.trim()) return res.status(400).json({ error: 'email is required' })
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` })

    const normalizedEmail = email.trim().toLowerCase()
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const invitation = await db.one(
      `INSERT INTO team_invitations (team_id, email, role, invited_by, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.teamId, normalizedEmail, role, req.user.id, token, expiresAt]
    )

    res.status(201).json({ invitation })
  } catch (err) {
    next(err)
  }
})

// DELETE /teams/:id/invitations/:invId — revoke invitation
router.delete('/teams/:id/invitations/:invId', authenticate, requireTeamAccess('admin'), async (req, res, next) => {
  try {
    const invId = parseInt(req.params.invId, 10)
    if (isNaN(invId)) return res.status(400).json({ error: 'Invalid invitation id' })

    const inv = await db.oneOrNone(
      'SELECT id FROM team_invitations WHERE id = $1 AND team_id = $2 AND accepted_at IS NULL',
      [invId, req.teamId]
    )
    if (!inv) return res.status(404).json({ error: 'Invitation not found or already accepted' })

    await db.none('DELETE FROM team_invitations WHERE id = $1', [invId])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// POST /invitations/:token/accept — accept an invitation
router.post('/invitations/:token/accept', authenticate, async (req, res, next) => {
  try {
    const { token } = req.params

    const invitation = await db.oneOrNone(
      `SELECT ti.*, t.name AS team_name, t.slug AS team_slug
       FROM team_invitations ti
       INNER JOIN teams t ON t.id = ti.team_id
       WHERE ti.token = $1 AND ti.accepted_at IS NULL`,
      [token]
    )
    if (!invitation) return res.status(404).json({ error: 'Invitation not found or already accepted' })

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invitation has expired' })
    }

    if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Invitation was sent to a different email address' })
    }

    // Add to team (upsert in case previously removed)
    await db.none(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()`,
      [invitation.team_id, req.user.id, invitation.role]
    )

    await db.none(
      'UPDATE team_invitations SET accepted_at = now(), accepted_by = $1 WHERE id = $2',
      [req.user.id, invitation.id]
    )

    res.json({
      success: true,
      team: { id: invitation.team_id, name: invitation.team_name, slug: invitation.team_slug },
      role: invitation.role,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
