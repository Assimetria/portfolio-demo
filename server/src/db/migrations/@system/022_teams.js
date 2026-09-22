'use strict'

/**
 * Migration 022 – Teams
 * Creates tables for multi-tenant team management:
 *   - teams              — workspaces that users can create and own
 *   - team_members       — many-to-many: users ↔ teams with roles
 *   - team_invitations   — pending invites scoped to a team
 *   - team_activity_log  — audit trail for team events
 *
 * Schema: server/src/db/schemas/@system/teams.sql
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const sql = fs.readFileSync(path.join(SCHEMAS_DIR, 'teams.sql'), 'utf8')
  await db.none(sql)
  console.log('[022_teams] applied schema: teams, team_members, team_invitations, team_activity_log')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS team_activity_log CASCADE')
  await db.none('DROP TABLE IF EXISTS team_invitations CASCADE')
  await db.none('DROP TABLE IF EXISTS team_members CASCADE')
  await db.none('DROP TABLE IF EXISTS teams CASCADE')
  console.log('[022_teams] rolled back teams schema')
}
