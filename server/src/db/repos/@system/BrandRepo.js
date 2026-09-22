const db = require('../../../lib/@system/PostgreSQL')

const BRAND_COLUMNS = `
  id, name, slug, description, image_url, logo_url, website_url,
  primary_color, secondary_color, external_id, tags, metadata,
  status, settings, subscription_id, user_id,
  deleted_at, created_at, updated_at
`.trim()

const BrandRepo = {
  // ── Queries ────────────────────────────────────────────────────────────────

  async findAll({ status, user_id, subscription_id, limit = 50, offset = 0 } = {}) {
    const conditions = ['deleted_at IS NULL']
    const values = []
    let idx = 1

    if (status) { conditions.push(`status = $${idx++}`); values.push(status) }
    if (user_id) { conditions.push(`user_id = $${idx++}`); values.push(user_id) }
    if (subscription_id) { conditions.push(`subscription_id = $${idx++}`); values.push(subscription_id) }

    const where = `WHERE ${conditions.join(' AND ')}`
    values.push(limit, offset)

    return db.any(
      `SELECT ${BRAND_COLUMNS} FROM brands ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      values,
    )
  },

  async count({ status, user_id, subscription_id } = {}) {
    const conditions = ['deleted_at IS NULL']
    const values = []
    let idx = 1

    if (status) { conditions.push(`status = $${idx++}`); values.push(status) }
    if (user_id) { conditions.push(`user_id = $${idx++}`); values.push(user_id) }
    if (subscription_id) { conditions.push(`subscription_id = $${idx++}`); values.push(subscription_id) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const row = await db.one(`SELECT COUNT(*) FROM brands ${where}`, values)
    return parseInt(row.count, 10)
  },

  async findById(id) {
    return db.oneOrNone(
      `SELECT ${BRAND_COLUMNS} FROM brands WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
  },

  async findByIdIncludingDeleted(id) {
    return db.oneOrNone(`SELECT ${BRAND_COLUMNS} FROM brands WHERE id = $1`, [id])
  },

  async findBySlug(slug) {
    return db.oneOrNone(
      `SELECT ${BRAND_COLUMNS} FROM brands WHERE slug = $1 AND deleted_at IS NULL`,
      [slug],
    )
  },

  async findByExternalId(externalId) {
    return db.oneOrNone(
      `SELECT ${BRAND_COLUMNS} FROM brands WHERE external_id = $1 AND deleted_at IS NULL`,
      [externalId],
    )
  },

  async findBySubscriptionId(subscriptionId) {
    return db.any(
      `SELECT ${BRAND_COLUMNS} FROM brands WHERE subscription_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [subscriptionId],
    )
  },

  // ── Mutations ──────────────────────────────────────────────────────────────

  async create({
    name, slug, description, image_url, logo_url, website_url,
    primary_color, secondary_color, external_id, tags, metadata,
    status = 'active', settings, subscription_id, user_id,
  }) {
    return db.one(
      `INSERT INTO brands (
        name, slug, description, image_url, logo_url, website_url,
        primary_color, secondary_color, external_id, tags, metadata,
        status, settings, subscription_id, user_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14,$15)
      RETURNING *`,
      [
        name, slug,
        description ?? null, image_url ?? null, logo_url ?? null, website_url ?? null,
        primary_color ?? null, secondary_color ?? null, external_id ?? null,
        tags ?? [], metadata ? JSON.stringify(metadata) : '{}',
        status, settings ? JSON.stringify(settings) : null,
        subscription_id ?? null, user_id ?? null,
      ],
    )
  },

  async update(id, fields) {
    const sets = []
    const values = [id]
    let idx = 2

    const allowed = [
      'name', 'slug', 'description', 'image_url', 'logo_url', 'website_url',
      'primary_color', 'secondary_color', 'external_id', 'status', 'subscription_id',
    ]
    for (const col of allowed) {
      if (fields[col] !== undefined) {
        sets.push(`${col} = $${idx++}`)
        values.push(fields[col])
      }
    }
    // JSONB / array columns
    if (fields.tags !== undefined) {
      sets.push(`tags = $${idx++}`)
      values.push(fields.tags)
    }
    if (fields.metadata !== undefined) {
      sets.push(`metadata = $${idx++}::jsonb`)
      values.push(JSON.stringify(fields.metadata))
    }
    if (fields.settings !== undefined) {
      sets.push(`settings = $${idx++}::jsonb`)
      values.push(JSON.stringify(fields.settings))
    }

    if (sets.length === 0) return this.findById(id)

    sets.push('updated_at = now()')

    return db.oneOrNone(
      `UPDATE brands SET ${sets.join(', ')} WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      values,
    )
  },

  async updateStatus(id, status) {
    return db.oneOrNone(
      `UPDATE brands SET status = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, status],
    )
  },

  // ── Soft delete / restore ──────────────────────────────────────────────────

  async softDelete(id) {
    return db.oneOrNone(
      `UPDATE brands SET deleted_at = now(), status = 'deleted', updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id],
    )
  },

  async restore(id) {
    return db.oneOrNone(
      `UPDATE brands SET deleted_at = NULL, status = 'active', updated_at = now()
       WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
      [id],
    )
  },

  async findDeleted({ user_id, limit = 50, offset = 0 } = {}) {
    const conditions = ['deleted_at IS NOT NULL']
    const values = []
    let idx = 1

    if (user_id) { conditions.push(`user_id = $${idx++}`); values.push(user_id) }
    values.push(limit, offset)

    return db.any(
      `SELECT ${BRAND_COLUMNS} FROM brands
       WHERE ${conditions.join(' AND ')}
       ORDER BY deleted_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      values,
    )
  },

  async hardDelete(id) {
    return db.oneOrNone('DELETE FROM brands WHERE id = $1 RETURNING id', [id])
  },

  // ── Associations ───────────────────────────────────────────────────────────

  /** Brand belongsTo Subscription */
  async getSubscription(brandId) {
    return db.oneOrNone(
      `SELECT s.* FROM subscriptions s
       JOIN brands b ON b.subscription_id = s.id
       WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [brandId],
    )
  },

  /** Brand hasMany Collaborators */
  async getCollaborators(brandId, { limit = 50, offset = 0 } = {}) {
    return db.any(
      `SELECT c.* FROM collaborators c
       WHERE c.brand_id = $1
       ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`,
      [brandId, limit, offset],
    )
  },

  // ── Search ─────────────────────────────────────────────────────────────────

  async search(query, { limit = 20 } = {}) {
    return db.any(
      `SELECT ${BRAND_COLUMNS},
              ts_rank(
                to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(slug,'') || ' ' || COALESCE(description,'')),
                plainto_tsquery('english', $1)
              ) AS rank
       FROM brands
       WHERE deleted_at IS NULL
         AND to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(slug,'') || ' ' || COALESCE(description,''))
             @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC LIMIT $2`,
      [query, limit],
    )
  },
}

module.exports = BrandRepo
