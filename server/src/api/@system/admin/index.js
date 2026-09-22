// @system — admin API: user management, subscription stats, platform overview
// All routes require: authenticate + requireAdmin
const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const UserRepo = require('../../../db/repos/@system/UserRepo')
const SubscriptionRepo = require('../../../db/repos/@system/SubscriptionRepo')
const db = require('../../../lib/@system/PostgreSQL')
const { validate } = require('../../../lib/@system/Validation')
const { ListUsersQuery, UserIdParams, UpdateUserRoleBody, ListSubscriptionsQuery, FeatureFlagKeyParams, CreateFeatureFlagBody, UpdateFeatureFlagBody } = require('../../../lib/@system/Validation/schemas/@system/admin')
const { adminReadLimiter, adminWriteLimiter } = require('../../../lib/@system/RateLimit')
const FeatureFlagRepo = require('../../../db/repos/@system/FeatureFlagRepo')

const guard = [authenticate, requireAdmin]
const readGuard = [authenticate, requireAdmin, adminReadLimiter]
const writeGuard = [authenticate, requireAdmin, adminWriteLimiter]

// Statement timeout for admin list queries (5 seconds) — prevents slow queries from blocking the DB pool
const ADMIN_QUERY_TIMEOUT = "SET LOCAL statement_timeout = '5s'"

// ── Users ─────────────────────────────────────────────────────────────────

// GET /api/admin/users — paginated user list with optional search and status filter
router.get('/admin/users', ...readGuard, validate({ query: ListUsersQuery }), async (req, res, next) => {
  try {
    const { search, page, limit, status } = req.query
    const users = await db.task(async t => {
      await t.none(ADMIN_QUERY_TIMEOUT)
      if (search && search.length >= 2) {
        return UserRepo.search(search, { limit: Number(limit) })
      }
      const conditions = []
      const params = []
      if (status) {
        conditions.push(`status = $${params.length + 1}`)
        params.push(status)
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      return t.any(
        `SELECT id, email, name, role, created_at
         FROM users
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), (Number(page) - 1) * Number(limit)]
      )
    })
    res.json({ users })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/users/stats — registration counts and totals
router.get('/admin/users/stats', ...readGuard, async (req, res, next) => {
  try {
    const [total, todayRow, weekRow, monthRow] = await db.task(async t => {
      await t.none(ADMIN_QUERY_TIMEOUT)
      return Promise.all([
        t.one('SELECT COUNT(*) AS count FROM users'),
        t.one("SELECT COUNT(*) AS count FROM users WHERE created_at >= now() - interval '1 day'"),
        t.one("SELECT COUNT(*) AS count FROM users WHERE created_at >= now() - interval '7 days'"),
        t.one("SELECT COUNT(*) AS count FROM users WHERE created_at >= now() - interval '30 days'"),
      ])
    })
    res.json({
      total: Number(total.count),
      today: Number(todayRow.count),
      thisWeek: Number(weekRow.count),
      thisMonth: Number(monthRow.count),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/users/:id — single user details
router.get('/admin/users/:id', ...readGuard, validate({ params: UserIdParams }), async (req, res, next) => {
  try {
    const user = await UserRepo.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    const subscriptions = await SubscriptionRepo.findByUserId(user.id)
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at }, subscriptions })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/users/:id/role — change user role
router.patch('/admin/users/:id/role', ...writeGuard, validate({ params: UserIdParams, body: UpdateUserRoleBody }), async (req, res, next) => {
  try {
    const { role } = req.body
    const updated = await db.oneOrNone(
      'UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING id, email, name, role',
      [req.params.id, role]
    )
    if (!updated) return res.status(404).json({ message: 'User not found' })
    res.json({ user: updated })
  } catch (err) {
    next(err)
  }
})

// ── Subscriptions ─────────────────────────────────────────────────────────

// GET /api/admin/subscriptions — all subscriptions with user info
router.get('/admin/subscriptions', ...readGuard, validate({ query: ListSubscriptionsQuery }), async (req, res, next) => {
  try {
    const { page, limit, status } = req.query
    const conditions = status ? "WHERE s.status = $3" : ''
    const params = status
      ? [Number(limit), (Number(page) - 1) * Number(limit), status]
      : [Number(limit), (Number(page) - 1) * Number(limit)]

    const subscriptions = await db.task(async t => {
      await t.none(ADMIN_QUERY_TIMEOUT)
      return t.any(
        `SELECT s.*, u.email, u.name
         FROM subscriptions s
         JOIN users u ON u.id = s.user_id
         ${conditions}
         ORDER BY s.created_at DESC
         LIMIT $1 OFFSET $2`,
        params
      )
    })
    res.json({ subscriptions })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/subscriptions/stats — counts by status
router.get('/admin/subscriptions/stats', ...readGuard, async (req, res, next) => {
  try {
    const rows = await db.task(async t => {
      await t.none(ADMIN_QUERY_TIMEOUT)
      return t.any('SELECT status, COUNT(*) AS count FROM subscriptions GROUP BY status')
    })
    const stats = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]))
    res.json({ stats })
  } catch (err) {
    next(err)
  }
})

// ── Feature Flags ─────────────────────────────────────────────────────────

// GET /api/admin/feature-flags — list all flags
router.get('/admin/feature-flags', ...readGuard, async (req, res, next) => {
  try {
    const { category } = req.query
    const flags = await FeatureFlagRepo.findAll({ category: category || undefined })
    res.json({ flags })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/feature-flags/categories — list distinct categories
router.get('/admin/feature-flags/categories', ...readGuard, async (req, res, next) => {
  try {
    const categories = await FeatureFlagRepo.getCategories()
    res.json({ categories })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/feature-flags/:key — single flag
router.get('/admin/feature-flags/:key', ...readGuard, validate({ params: FeatureFlagKeyParams }), async (req, res, next) => {
  try {
    const flag = await FeatureFlagRepo.findByKey(req.params.key)
    if (!flag) return res.status(404).json({ message: 'Feature flag not found' })
    res.json({ flag })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/feature-flags/:key — toggle a flag
router.patch('/admin/feature-flags/:key', ...writeGuard, validate({ params: FeatureFlagKeyParams, body: UpdateFeatureFlagBody }), async (req, res, next) => {
  try {
    const { enabled } = req.body
    const flag = await FeatureFlagRepo.toggle(req.params.key, enabled, req.user.id)
    if (!flag) return res.status(404).json({ message: 'Feature flag not found' })
    res.json({ flag })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/feature-flags — create a new flag
router.post('/admin/feature-flags', ...writeGuard, validate({ body: CreateFeatureFlagBody }), async (req, res, next) => {
  try {
    const { key, label, description, category, enabled } = req.body
    const flag = await FeatureFlagRepo.create({ key, label, description, category, enabled })
    res.status(201).json({ flag })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `Feature flag "${req.body.key}" already exists` })
    }
    next(err)
  }
})

// DELETE /api/admin/feature-flags/:key — remove a flag
router.delete('/admin/feature-flags/:key', ...writeGuard, validate({ params: FeatureFlagKeyParams }), async (req, res, next) => {
  try {
    const flag = await FeatureFlagRepo.delete(req.params.key)
    if (!flag) return res.status(404).json({ message: 'Feature flag not found' })
    res.json({ message: 'Deleted', flag })
  } catch (err) {
    next(err)
  }
})

// ── Financials sub-router ─────────────────────────────────────────────────
router.use(require('./financials'))

// ── Cancellations dashboard & credits sub-router ─────────────────────────
router.use(require('./cancellation-dashboard'))

module.exports = router
