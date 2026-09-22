// @system — Collaborator repository (raw SQL / pg-promise)
const db = require('../../../lib/@system/PostgreSQL')

const CollaboratorRepo = {
  async findById(id) {
    return db.oneOrNone('SELECT * FROM collaborators WHERE id = $1', [id])
  },

  async findByBrandId(brandId) {
    return db.any(
      `SELECT c.*, u.email, u.name FROM collaborators c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.brand_id = $1 AND c.status IN ('active', 'pending')
       ORDER BY c.created_at ASC`,
      [brandId],
    )
  },

  async findByEmailAndBrandId(email, brandId) {
    return db.oneOrNone(
      'SELECT * FROM collaborators WHERE invite_email = $1 AND brand_id = $2',
      [email, brandId],
    )
  },

  async getPendingInvitations(brandId) {
    return db.any(
      "SELECT * FROM collaborators WHERE brand_id = $1 AND status = 'pending' ORDER BY created_at DESC",
      [brandId],
    )
  },

  async invite({ brand_id, user_id, invited_by, invite_email, role = 'editor' }) {
    return db.one(
      `INSERT INTO collaborators (brand_id, user_id, invited_by, invite_email, role, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [brand_id, user_id, invited_by, invite_email, role],
    )
  },

  async accept(id) {
    return db.oneOrNone(
      "UPDATE collaborators SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *",
      [id],
    )
  },

  async reject(id) {
    return db.oneOrNone(
      "UPDATE collaborators SET status = 'rejected', updated_at = now() WHERE id = $1 RETURNING *",
      [id],
    )
  },

  async remove(id, brandId) {
    return db.oneOrNone(
      "UPDATE collaborators SET status = 'inactive', updated_at = now() WHERE id = $1 AND brand_id = $2 RETURNING *",
      [id, brandId],
    )
  },

  async updateRole(id, brandId, newRole) {
    return db.oneOrNone(
      'UPDATE collaborators SET role = $3, updated_at = now() WHERE id = $1 AND brand_id = $2 RETURNING *',
      [id, brandId, newRole],
    )
  },

  async reactivate(id, invitedBy, role) {
    return db.oneOrNone(
      "UPDATE collaborators SET status = 'pending', invited_by = $2, role = $3, updated_at = now() WHERE id = $1 RETURNING *",
      [id, invitedBy, role],
    )
  },

  async countOwners(brandId) {
    const row = await db.one(
      "SELECT COUNT(*)::int AS count FROM collaborators WHERE brand_id = $1 AND role = 'owner' AND status = 'active'",
      [brandId],
    )
    return row.count
  },
}

module.exports = CollaboratorRepo
