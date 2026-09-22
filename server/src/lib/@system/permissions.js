/**
 * @system Permissions System
 * Role-based access control for teams
 */

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4
}

// Permission definitions
const PERMISSIONS = {
  // Team management
  'team.read': ['viewer', 'member', 'admin', 'owner'],
  'team.update': ['admin', 'owner'],
  'team.delete': ['owner'],
  
  // Member management
  'members.read': ['viewer', 'member', 'admin', 'owner'],
  'members.invite': ['admin', 'owner'],
  'members.remove': ['admin', 'owner'],
  'members.update_role': ['admin', 'owner'],
  
  // Invitation management
  'invitations.read': ['admin', 'owner'],
  'invitations.revoke': ['admin', 'owner'],
  'invitations.resend': ['admin', 'owner'],
  
  // Content management (example - customize for your product)
  'content.read': ['viewer', 'member', 'admin', 'owner'],
  'content.create': ['member', 'admin', 'owner'],
  'content.update': ['member', 'admin', 'owner'],
  'content.delete': ['admin', 'owner'],
  
  // Settings
  'settings.read': ['member', 'admin', 'owner'],
  'settings.update': ['admin', 'owner'],
  
  // Activity log
  'activity.read': ['admin', 'owner']
}

/**
 * Check if a role has a specific permission
 * @param {string} role - User's role
 * @param {string} permission - Permission to check
 * @param {Array} customPermissions - Optional custom permissions array
 * @returns {boolean} Has permission
 */
function hasPermission(role, permission, customPermissions = []) {
  // Check custom permissions first (granular overrides)
  if (customPermissions.includes(permission)) {
    return true
  }

  // Check role-based permissions
  const allowedRoles = PERMISSIONS[permission]
  if (!allowedRoles) {
    return false // Unknown permission
  }

  return allowedRoles.includes(role)
}

/**
 * Check if one role is higher than another
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean} Role1 > Role2
 */
function isRoleHigher(role1, role2) {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2]
}

/**
 * Check if one role is equal or higher than another
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean} Role1 >= Role2
 */
function isRoleEqualOrHigher(role1, role2) {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2]
}

/**
 * Get all permissions for a role
 * @param {string} role - User's role
 * @returns {Array} Array of permissions
 */
function getPermissionsForRole(role) {
  return Object.keys(PERMISSIONS).filter(permission => 
    hasPermission(role, permission)
  )
}

/**
 * Express middleware - Require team membership
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function requireTeamMembership(options = {}) {
  const { 
    teamIdParam = 'teamId',
    minRole = null,
    permission = null 
  } = options

  return async (req, res, next) => {
    try {
      const teamId = req.params[teamIdParam]
      const userId = req.user?.id

      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required' })
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Get team member info
      const teamMembersRepo = req.db.teamMembers
      const member = await teamMembersRepo.findByTeamAndUser(teamId, userId)

      if (!member) {
        return res.status(403).json({ error: 'Not a member of this team' })
      }

      // Check minimum role requirement
      if (minRole && !isRoleEqualOrHigher(member.role, minRole)) {
        return res.status(403).json({ error: `Requires ${minRole} role or higher` })
      }

      // Check specific permission
      if (permission && !hasPermission(member.role, permission, member.permissions)) {
        return res.status(403).json({ error: `Missing required permission: ${permission}` })
      }

      // Attach team member info to request
      req.teamMember = member
      req.teamRole = member.role
      req.teamPermissions = member.permissions

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Express middleware - Require team owner
 * @param {string} teamIdParam - Parameter name for team ID
 * @returns {Function} Express middleware
 */
function requireTeamOwner(teamIdParam = 'teamId') {
  return async (req, res, next) => {
    try {
      const teamId = req.params[teamIdParam]
      const userId = req.user?.id

      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required' })
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      // Get team
      const teamsRepo = req.db.teams
      const team = await teamsRepo.findById(teamId)

      if (!team) {
        return res.status(404).json({ error: 'Team not found' })
      }

      if (team.owner_id !== userId) {
        return res.status(403).json({ error: 'Only team owner can perform this action' })
      }

      req.team = team
      next()
    } catch (error) {
      next(error)
    }
  }
}

module.exports = {
  ROLE_HIERARCHY,
  PERMISSIONS,
  hasPermission,
  isRoleHigher,
  isRoleEqualOrHigher,
  getPermissionsForRole,
  requireTeamMembership,
  requireTeamOwner
}
