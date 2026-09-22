'use strict'

const db = require('../../../lib/@system/PostgreSQL')

class TenantRepo {
  static async findById(id) {
    return db.oneOrNone('SELECT * FROM tenants WHERE id = $1', [id])
  }

  static async findBySlug(slug) {
    return db.oneOrNone('SELECT * FROM tenants WHERE slug = $1', [slug])
  }

  static async listForUser(userId) {
    return db.manyOrNone(
      `SELECT t.*, m.role
         FROM tenants t
         JOIN tenant_members m ON m.tenant_id = t.id
        WHERE m.user_id = $1
        ORDER BY t.created_at ASC`,
      [userId]
    )
  }

  static async userIsMember(tenantId, userId) {
    const row = await db.oneOrNone(
      'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    )
    return row || null
  }

  static async create({ slug, name, ownerUserId }) {
    return db.tx(async (t) => {
      const tenant = await t.one(
        `INSERT INTO tenants (slug, name, owner_user_id)
              VALUES ($1, $2, $3) RETURNING *`,
        [slug, name, ownerUserId]
      )
      await t.none(
        `INSERT INTO tenant_members (tenant_id, user_id, role)
              VALUES ($1, $2, 'owner')`,
        [tenant.id, ownerUserId]
      )
      return tenant
    })
  }

  static async addMember(tenantId, userId, role = 'member') {
    return db.oneOrNone(
      `INSERT INTO tenant_members (tenant_id, user_id, role)
            VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING *`,
      [tenantId, userId, role]
    )
  }

  static async removeMember(tenantId, userId) {
    return db.none(
      'DELETE FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    )
  }
}

module.exports = TenantRepo
