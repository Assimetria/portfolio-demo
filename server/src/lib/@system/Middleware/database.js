/**
 * @system Database Middleware
 * Attaches database repositories to req.db for easy access
 */

const db = require('../PostgreSQL')
const TeamsRepository = require('../../../db/repos/@system/teams')
const TeamMembersRepository = require('../../../db/repos/@system/team-members')
const TeamInvitationsRepository = require('../../../db/repos/@system/team-invitations')
const TeamActivityLogRepository = require('../../../db/repos/@system/team-activity-log')
const UserRepo = require('../../../db/repos/@system/UserRepo')

// Initialize repositories with the database instance
const teams = new TeamsRepository(db)
const teamMembers = new TeamMembersRepository(db)
const teamInvitations = new TeamInvitationsRepository(db)
const teamActivityLog = new TeamActivityLogRepository(db)

/**
 * Database middleware - attaches repositories to req.db
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function attachDatabase(req, res, next) {
  req.db = {
    teams,
    teamMembers,
    teamInvitations,
    teamActivityLog,
    users: UserRepo
  }
  next()
}

module.exports = attachDatabase
