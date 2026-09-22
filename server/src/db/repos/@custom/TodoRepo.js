'use strict'

// @custom — Todo repository (tenant-scoped example)
//
// Every method takes the transaction `t` provided by `req.withTenant(fn)` as
// its first argument. Inside that transaction Postgres RLS (migration
// @custom/003_tenant_rls.js) already restricts rows to the current tenant; we
// still pass tenant_id explicitly on INSERT so the WITH CHECK policy passes
// and the row is attributed correctly. Never call these with the bare `db`
// object — without the tenant setting RLS returns/permits nothing.

const COLUMNS = 'id, tenant_id, user_id, title, description, priority, completed, created_at, updated_at'

class TodoRepo {
  /**
   * @param {object} t          pg-promise task/tx from withTenant()
   * @param {object} opts
   * @param {number} opts.limit
   * @param {number} opts.offset
   * @param {string} [opts.whereClause]  built by buildWhereClause (whitelisted keys)
   * @param {any[]}  [opts.params]
   * @param {string} [opts.orderBy]      built by buildOrderByClause (whitelisted)
   */
  static async findAll(t, { limit, offset, whereClause = '', params = [], orderBy = 'ORDER BY created_at DESC' }) {
    const sql = `SELECT ${COLUMNS} FROM todos ${whereClause} ${orderBy}
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    return t.any(sql, [...params, limit, offset])
  }

  static async count(t, { whereClause = '', params = [] } = {}) {
    const row = await t.one(`SELECT COUNT(*)::int AS count FROM todos ${whereClause}`, params)
    return row.count
  }

  static async findById(t, id) {
    return t.oneOrNone(`SELECT ${COLUMNS} FROM todos WHERE id = $1`, [id])
  }

  static async create(t, { tenant_id, user_id = null, title, description = null, priority = 'medium' }) {
    return t.one(
      `INSERT INTO todos (tenant_id, user_id, title, description, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [tenant_id, user_id, title, description, priority],
    )
  }

  /** Whitelisted column update — unknown keys are ignored, never interpolated. */
  static async update(t, id, data) {
    const allowed = ['title', 'description', 'priority', 'completed']
    const sets = []
    const params = []
    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key])
        sets.push(`${key} = $${params.length}`)
      }
    }
    if (sets.length === 0) return TodoRepo.findById(t, id)
    sets.push('updated_at = now()')
    params.push(id)
    return t.oneOrNone(
      `UPDATE todos SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${COLUMNS}`,
      params,
    )
  }

  static async delete(t, id) {
    const result = await t.result('DELETE FROM todos WHERE id = $1', [id])
    return result.rowCount
  }
}

module.exports = TodoRepo
