// @custom — Portfolio Projects CRUD API (feature: Portfolio Projects)
const express = require('express')
const router = express.Router()

const {
  authenticate,
  asyncHandler,
  validateIdParam,
  successResponse,
  errorResponse,
  extractAllowedFields,
} = require('../../lib/@system/Helpers')

const db = require('../../lib/@system/PostgreSQL')

// ───────────────────────────────────────────────────────────────────────────
// LIST - GET /api/portfolio-projects
// GET ?q=search&category=x&status=published&sort=title&order=asc
// ───────────────────────────────────────────────────────────────────────────

router.get(
  '/portfolio-projects',
  authenticate,
  asyncHandler(async (req, res) => {
    const { q, category, status, sort, order } = req.query
    const allowedSort = ['title', 'created_at', 'updated_at', 'category']
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at'
    const sortDir = order === 'asc' ? 'ASC' : 'DESC'

    const conditions = []
    const params = []
    let idx = 1

    if (q) {
      conditions.push(`(LOWER(title) ILIKE $${idx} OR LOWER(description) ILIKE $${idx})`)
      params.push(`%${q.toLowerCase()}%`)
      idx++
    }

    if (category) {
      conditions.push(`category = $${idx}`)
      params.push(category)
      idx++
    }

    if (status) {
      conditions.push(`status = $${idx}`)
      params.push(status)
      idx++
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const rows = await db.any(
      `SELECT id, user_id, title, description, category, tags, project_url, image_url, status, featured, sort_order, created_at, updated_at
       FROM portfolio_projects ${whereClause}
       ORDER BY sort_order ASC, ${sortCol} ${sortDir}`,
      params
    )

    res.json(successResponse(rows, { dataKey: 'projects' }))
  })
)

// ───────────────────────────────────────────────────────────────────────────
// GET ONE - GET /api/portfolio-projects/:id
// ───────────────────────────────────────────────────────────────────────────

router.get(
  '/portfolio-projects/:id',
  authenticate,
  validateIdParam('integer'),
  asyncHandler(async (req, res) => {
    const row = await db.oneOrNone(
      'SELECT id, user_id, title, description, category, tags, project_url, image_url, status, featured, sort_order, created_at, updated_at FROM portfolio_projects WHERE id = $1',
      [req.params.id]
    )

    if (!row) {
      return res.status(404).json(errorResponse('Portfolio project not found'))
    }

    res.json(successResponse(row, { dataKey: 'project' }))
  })
)

// ───────────────────────────────────────────────────────────────────────────
// CREATE - POST /api/portfolio-projects
// ───────────────────────────────────────────────────────────────────────────

router.post(
  '/portfolio-projects',
  authenticate,
  asyncHandler(async (req, res) => {
    const allowed = extractAllowedFields(req.body, [
      'title',
      'description',
      'category',
      'tags',
      'project_url',
      'image_url',
      'status',
      'featured',
      'sort_order',
    ])

    if (!allowed.title || allowed.title.trim().length === 0) {
      return res.status(400).json(errorResponse('Title is required'))
    }

    // Parse tags from CSV string if needed
    let tags = allowed.tags
    if (typeof tags === 'string') {
      tags = tags.split(',').map((t) => t.trim()).filter(Boolean)
    }

    const row = await db.one(
      `INSERT INTO portfolio_projects (user_id, title, description, category, tags, project_url, image_url, status, featured, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, title, description, category, tags, project_url, image_url, status, featured, sort_order, created_at, updated_at`,
      [
        req.user.id,
        allowed.title.trim(),
        allowed.description || null,
        allowed.category || null,
        JSON.stringify(tags || []),
        allowed.project_url || null,
        allowed.image_url || null,
        allowed.status || 'draft',
        allowed.featured === true || allowed.featured === 'true',
        allowed.sort_order != null ? parseInt(allowed.sort_order, 10) : 0,
      ]
    )

    res.status(201).json(successResponse(row, { dataKey: 'project' }))
  })
)

// ───────────────────────────────────────────────────────────────────────────
// UPDATE - PATCH /api/portfolio-projects/:id
// ───────────────────────────────────────────────────────────────────────────

router.patch(
  '/portfolio-projects/:id',
  authenticate,
  validateIdParam('integer'),
  asyncHandler(async (req, res) => {
    const existing = await db.oneOrNone(
      'SELECT id, user_id FROM portfolio_projects WHERE id = $1',
      [req.params.id]
    )

    if (!existing) {
      return res.status(404).json(errorResponse('Portfolio project not found'))
    }

    const allowed = extractAllowedFields(req.body, [
      'title',
      'description',
      'category',
      'tags',
      'project_url',
      'image_url',
      'status',
      'featured',
      'sort_order',
    ])

    // Build SET clause dynamically
    const setClauses = []
    const params = []
    let idx = 1

    if (allowed.title !== undefined) {
      setClauses.push(`title = $${idx}`)
      params.push(allowed.title.trim())
      idx++
    }

    if (allowed.description !== undefined) {
      setClauses.push(`description = $${idx}`)
      params.push(allowed.description)
      idx++
    }

    if (allowed.category !== undefined) {
      setClauses.push(`category = $${idx}`)
      params.push(allowed.category)
      idx++
    }

    if (allowed.tags !== undefined) {
      let tags = allowed.tags
      if (typeof tags === 'string') {
        tags = tags.split(',').map((t) => t.trim()).filter(Boolean)
      }
      setClauses.push(`tags = $${idx}`)
      params.push(JSON.stringify(tags))
      idx++
    }

    if (allowed.project_url !== undefined) {
      setClauses.push(`project_url = $${idx}`)
      params.push(allowed.project_url)
      idx++
    }

    if (allowed.image_url !== undefined) {
      setClauses.push(`image_url = $${idx}`)
      params.push(allowed.image_url)
      idx++
    }

    if (allowed.status !== undefined) {
      setClauses.push(`status = $${idx}`)
      params.push(allowed.status)
      idx++
    }

    if (allowed.featured !== undefined) {
      setClauses.push(`featured = $${idx}`)
      params.push(allowed.featured === true || allowed.featured === 'true')
      idx++
    }

    if (allowed.sort_order !== undefined) {
      setClauses.push(`sort_order = $${idx}`)
      params.push(parseInt(allowed.sort_order, 10))
      idx++
    }

    if (setClauses.length === 0) {
      return res.status(400).json(errorResponse('No fields to update'))
    }

    setClauses.push(`updated_at = now()`)
    params.push(req.params.id)

    const updated = await db.one(
      `UPDATE portfolio_projects SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, user_id, title, description, category, tags, project_url, image_url, status, featured, sort_order, created_at, updated_at`,
      params
    )

    res.json(successResponse(updated, { dataKey: 'project' }))
  })
)
// ───────────────────────────────────────────────────────────────────────────
// DELETE - DELETE /api/portfolio-projects/:id
// ───────────────────────────────────────────────────────────────────────────

router.delete(
  '/portfolio-projects/:id',
  authenticate,
  validateIdParam('integer'),
  asyncHandler(async (req, res) => {
    const existing = await db.oneOrNone(
      'SELECT id, user_id FROM portfolio_projects WHERE id = $1',
      [req.params.id]
    )

    if (!existing) {
      return res.status(404).json(errorResponse('Portfolio project not found'))
    }

    await db.result('DELETE FROM portfolio_projects WHERE id = $1', [req.params.id])

    res.json(successResponse(null, { message: 'Portfolio project deleted successfully' }))
  })
)

module.exports = router