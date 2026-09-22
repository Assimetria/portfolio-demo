// @system — Admin cancellations dashboard & basic credits system API
//
// Requires an authenticated administrator on every route. All balance mutations
// are applied atomically in a single DB transaction so a credit adjustment and
// its matching transactions (ledger) row can never drift apart.
'use strict'

const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const db = require('../../../lib/@system/PostgreSQL')
const { adminReadLimiter, adminWriteLimiter } = require('../../../lib/@system/RateLimit')
const { validate } = require('../../../lib/@system/Validation')
const { CreditAdjustParams, CreditAdjustBody } = require('../../../lib/@system/Validation/schemas/@system/admin')

const readGuard = [authenticate, requireAdmin, adminReadLimiter]
const writeGuard = [authenticate, requireAdmin, adminWriteLimiter]
const TIMEOUT = "SET LOCAL statement_timeout = '10s'"

// CANCELLED covers both legacy spellings used across migrations/providers.
const CANCELLED = "(status = 'cancelled' OR status = 'canceled')"
const ACTIVE = "status IN ('active', 'trialing')"

// Normalise a price to its monthly-equivalent cents for MRR-style calculations.
function monthlyCentsSql(column) {
  return `CASE
    WHEN periodicity = 'year' THEN GREATEST(${column} / 12, 0)
    WHEN periodicity = 'month' THEN ${column}
    ELSE 0
  END`
}

function pct(part, whole) {
  if (!whole || whole <= 0) return 0
  return Math.round((part / whole) * 10000) / 100
}

function badRequest(message) {
  const err = new Error(message)
  err.status = 400
  return err
}


// ── Churn analysis ──────────────────────────────────────────────────────────
//
// GET /api/admin/churn?period=week|month|all&cohort=week|month
//
// Returns logo churn together with current vs. lost MRR so admins can reason
// about both customer and revenue retention in a single snapshot. When `cohort`
// is supplied the response also carries a time-bucketed trend series.
router.get('/admin/churn', ...readGuard, async (req, res, next) => {
  try {
    const period = String(req.query.period || 'month')
    if (!['week', 'month', 'all'].includes(period)) {
      throw badRequest('period must be one of: week, month, all')
    }
    const cohort = req.query.cohort ? String(req.query.cohort) : null
    if (cohort && !['week', 'month'].includes(cohort)) {
      throw badRequest('cohort must be one of: week, month')
    }

    const window = period === 'week'
      ? "now() - interval '7 days'"
      : period === 'month'
        ? "now() - interval '30 days'"
        : null

    // Churned = subscriptions raised into a cancelled state inside the window.
    const churnWhere = window ? `${CANCELLED} AND updated_at >= ${window}` : CANCELLED
    const mrrMonthlyCents = monthlyCentsSql('price')

    const result = await db.task(async (t) => {
      await t.none(TIMEOUT)

      const [active, activeMrr, churned, churnedMrr] = await Promise.all([
        t.one(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE ${ACTIVE}`),
        t.one(`SELECT COALESCE(SUM(${mrrMonthlyCents}), 0)::int AS cents FROM subscriptions WHERE ${ACTIVE}`),
        t.one(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE ${churnWhere}`),
        t.one(`SELECT COALESCE(SUM(${mrrMonthlyCents}), 0)::int AS cents FROM subscriptions WHERE ${churnWhere}`),
      ])

      let cohorts = []
      if (cohort) {
        const trunc = cohort // 'week' | 'month'
        const cohortWhere = `${CANCELLED} AND updated_at >= now() - interval '180 days'`
        const rows = await t.any(`
          SELECT
            date_trunc('${trunc}', updated_at) AS bucket,
            COUNT(*)::int AS churned,
            COALESCE(SUM(${mrrMonthlyCents}), 0)::int AS mrr_cents
          FROM subscriptions
          WHERE ${cohortWhere}
          GROUP BY bucket
          ORDER BY bucket ASC
        `)
        cohorts = rows.map((r) => ({
          label: r.bucket,
          churned: r.churned,
          churnRate: pct(r.churned, active.count + r.churned),
          mrrLost: r.mrr_cents,
        }))
      }

      return { active, activeMrr, churned, churnedMrr, cohorts }
    })

    const denominator = result.active.count + result.churned.count
    const mrrDenominator = result.activeMrr.cents + result.churnedMrr.cents

    res.json({
      period,
      cohort: cohort || undefined,
      activeCount: result.active.count,
      churnedCount: result.churned.count,
      churnRate: pct(result.churned.count, denominator),
      currentMrr: result.activeMrr.cents,
      churnedMrr: result.churnedMrr.cents,
      mrrChurnRate: pct(result.churnedMrr.cents, mrrDenominator),
      cohorts: result.cohorts || [],
    })
  } catch (err) {
    next(err)
  }
})

// ── Credits admin ───────────────────────────────────────────────────────────
//
// GET /api/admin/credits?page=1&limit=20 — paginated credit ledger overview.
router.get('/admin/credits', ...readGuard, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100)
    const offset = (page - 1) * limit

    const rows = await db.task(async (t) => {
      await t.none(TIMEOUT)
      return t.any(
        `SELECT u.id AS user_id, u.name, u.email,
                COALESCE(c.amount, 0)::int AS balance
         FROM users u
         LEFT JOIN credits c ON c.user_id = u.id
         ORDER BY c.amount DESC NULLS LAST, u.id ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      )
    })

    const total = await db.one('SELECT COUNT(*)::int AS count FROM users')

    res.json({
      page,
      limit,
      total: total.count,
      credits: rows,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/credits/:userId — a single user's balance + recent history.
router.get('/admin/credits/:userId', ...readGuard, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10)
    if (!Number.isInteger(userId) || userId <= 0) throw badRequest('userId must be a positive integer')

    const r = await db.task(async (t) => {
      await t.none(TIMEOUT)
      const [user, credit, txs] = await Promise.all([
        t.oneOrNone('SELECT id, name, email FROM users WHERE id = $1', [userId]),
        t.oneOrNone('SELECT * FROM credits WHERE user_id = $1', [userId]),
        t.any(
          `SELECT id, amount, type, credits, price, status, description, created_at
           FROM transactions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 25`,
          [userId],
        ),
      ])
      return { user, credit, txs }
    })

    if (!r.user) {
      const err = new Error('User not found')
      err.status = 404
      throw err
    }

    res.json({
      user: { id: r.user.id, name: r.user.name, email: r.user.email },
      balance: r.credit ? r.credit.amount : 0,
      transactions: r.txs,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/credits/:userId/adjust  { amount, note }
//
// Applies a signed credit adjustment and writes a matching ledger entry within a
// single transaction — admins can issue or claw back credits without double-entry
// risk. Amounts are integer credit units; a negative adjustment cannot push a
// balance below zero.
router.post('/admin/credits/:userId/adjust', ...writeGuard, validate({ params: CreditAdjustParams, body: CreditAdjustBody }), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10)
    if (!Number.isInteger(userId) || userId <= 0) throw badRequest('userId must be a positive integer')

    const rawAmount = req.body && req.body.amount
    const amount = Number(rawAmount)
    if (!Number.isInteger(amount) || amount === 0) {
      throw badRequest('amount must be a non-zero integer')
    }
    const note = req.body && req.body.note
    if (typeof note !== 'string' || !note.trim() || note.length > 500) {
      throw badRequest('note is required and must be under 500 characters')
    }

    // All mutations share one committed transaction: the balance update can never
    // go negative (guarded in SQL) and the ledger insert is coupled to it.
    const result = await db.tx(async (t) => {
      await t.none(TIMEOUT)

      const user = await t.oneOrNone('SELECT id FROM users WHERE id = $1', [userId])
      if (!user) {
        const err = new Error('User not found')
        err.status = 404
        throw err
      }

      // Ensure a credits row exists; create a zero-balance row when it does not.
      await t.none(
        `INSERT INTO credits (user_id, amount)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      )

      // Atomic update — the guard prevents a result below zero.
      const updated = await t.oneOrNone(
        `UPDATE credits
         SET amount = amount + $1, updated_at = now()
         WHERE user_id = $2 AND ($1 >= 0 OR amount >= -$1)
         RETURNING *`,
        [amount, userId],
      )
      if (!updated) {
        const err = new Error('Adjustment would drive the balance negative')
        err.status = 409
        throw err
      }

      const tx = await t.one(
        `INSERT INTO transactions
           (user_id, amount, type, credits, price, status, description, metadata)
         VALUES ($1, $2, 'credits', $3, 0, 'completed', $4, $5)
         RETURNING id, type, credits, status, description, created_at`,
        [userId, Math.abs(amount), amount, note.trim(), JSON.stringify({ admin: true })],
      )

      return { updated, tx }
    })

    res.status(201).json({
      userId,
      balance: result.updated.amount,
      adjustment: amount,
      transaction: {
        id: result.tx.id,
        type: result.tx.type,
        description: result.tx.description,
        credits: result.tx.credits,
        status: result.tx.status,
        createdAt: result.tx.created_at,
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router

