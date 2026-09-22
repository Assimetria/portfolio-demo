// @system — Admin financials API (ported from Simtria)
// MRR calculation, new subscriptions, cancellation breakdown, revenue per period
// Uses raw SQL (pg-promise), NOT Sequelize.
'use strict'

const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const db = require('../../../lib/@system/PostgreSQL')
const { adminReadLimiter } = require('../../../lib/@system/RateLimit')

const guard = [authenticate, requireAdmin, adminReadLimiter]
const TIMEOUT = "SET LOCAL statement_timeout = '10s'"
const { resolveCancellationRange } = require('./cancellationWindow')

// ── MRR (Monthly Recurring Revenue) ──────────────────────────────────────────

// GET /api/admin/financials/mrr
router.get('/admin/financials/mrr', ...guard, async (_req, res, next) => {
  try {
    const result = await db.task(async (t) => {
      await t.none(TIMEOUT)

      // MRR = sum of monthly-normalized prices for all active subscriptions
      const mrr = await t.one(`
        SELECT COALESCE(SUM(
          CASE
            WHEN periodicity = 'year' THEN price / 12
            WHEN periodicity = 'month' THEN price
            ELSE 0
          END
        ), 0)::int AS mrr_cents
        FROM subscriptions
        WHERE status IN ('active', 'trialing')
          AND stripe_subscription_id IS NOT NULL
      `)

      // MRR from previous month (for comparison)
      const prevMrr = await t.one(`
        SELECT COALESCE(SUM(
          CASE
            WHEN periodicity = 'year' THEN price / 12
            WHEN periodicity = 'month' THEN price
            ELSE 0
          END
        ), 0)::int AS mrr_cents
        FROM subscriptions
        WHERE status IN ('active', 'trialing')
          AND stripe_subscription_id IS NOT NULL
          AND created_at < date_trunc('month', now())
      `)

      return {
        mrr: mrr.mrr_cents,
        previousMrr: prevMrr.mrr_cents,
      }
    })

    res.json({
      mrr: result.mrr,
      mrrFormatted: `$${(result.mrr / 100).toFixed(2)}`,
      previousMrr: result.previousMrr,
      growth: result.previousMrr > 0
        ? Math.round(((result.mrr - result.previousMrr) / result.previousMrr) * 100)
        : null,
    })
  } catch (err) {
    next(err)
  }
})

// ── New subscriptions ────────────────────────────────────────────────────────

// GET /api/admin/financials/new-subscriptions?period=today|week|month
router.get('/admin/financials/new-subscriptions', ...guard, async (req, res, next) => {
  try {
    const period = req.query.period || 'today'
    let interval
    switch (period) {
      case 'week': interval = '7 days'; break
      case 'month': interval = '30 days'; break
      default: interval = '1 day'
    }

    const result = await db.task(async (t) => {
      await t.none(TIMEOUT)
      return t.one(`
        SELECT COUNT(*)::int AS count,
               COALESCE(SUM(price), 0)::int AS revenue_cents
        FROM subscriptions
        WHERE stripe_subscription_id IS NOT NULL
          AND created_at >= now() - interval '${interval}'
      `)
    })

    res.json({
      period,
      count: result.count,
      revenue: result.revenue_cents,
      revenueFormatted: `$${(result.revenue_cents / 100).toFixed(2)}`,
    })
  } catch (err) {
    next(err)
  }
})

// ── Cancellations with reason breakdown ──────────────────────────────────────

// GET /api/admin/financials/cancellations?period=week|month|all
router.get('/admin/financials/cancellations', ...guard, async (req, res, next) => {
  try {
    const period = req.query.period || 'month'
    // Explicit global start/end take precedence over the named period so pages
    // wired to useGlobalDateRange() get true server-side filtering.
    const { startDate, endDate } = req.query
    const range = resolveCancellationRange({ period, startDate, endDate })

    let dateFilter = ''
    let dateParams = []
    if (range.apply) {
      dateFilter = 'AND updated_at >= $1 AND updated_at <= $2'
      dateParams = [range.start, range.end]
    }

    const result = await db.task(async (t) => {
      await t.none(TIMEOUT)

      const total = await t.one(
        `SELECT COUNT(*)::int AS count
         FROM subscriptions
         WHERE status = 'cancelled' OR status = 'canceled'
         ${dateFilter}`,
        dateParams
      )

      // Breakdown by cancellation reason (stored in metadata)
      const reasons = await t.any(
        `SELECT
           COALESCE(metadata->>'cancellation_type', 'unknown') AS cancellation_type,
           COALESCE(metadata->>'cancellation_reason', 'unknown') AS cancellation_reason,
           COUNT(*)::int AS count
         FROM subscriptions
         WHERE (status = 'cancelled' OR status = 'canceled')
         ${dateFilter}
         GROUP BY cancellation_type, cancellation_reason
         ORDER BY count DESC`,
        dateParams
      )

      return { total: total.count, reasons }
    })

    res.json({
      period,
      total: result.total,
      reasons: result.reasons,
      ...(range.explicit
        ? { startDate: range.startDate, endDate: range.endDate }
        : {}),
    })
  } catch (err) {
    next(err)
  }
})

// ── Revenue per period ───────────────────────────────────────────────────────

// GET /api/admin/financials/revenue?groupBy=day|week|month&since=2024-01-01
router.get('/admin/financials/revenue', ...guard, async (req, res, next) => {
  try {
    const groupBy = req.query.groupBy || 'day'
    const since = req.query.since || null
    const trunc = groupBy === 'week' ? 'week' : groupBy === 'month' ? 'month' : 'day'

    const result = await db.task(async (t) => {
      await t.none(TIMEOUT)

      const sinceClause = since ? "AND created_at >= $1" : ''
      const params = since ? [new Date(since)] : []

      const periods = await t.any(`
        SELECT
          date_trunc('${trunc}', created_at) AS period,
          SUM(price)::int AS revenue_cents,
          COUNT(*)::int AS transaction_count
        FROM transactions
        WHERE status = 'paid'
        ${sinceClause}
        GROUP BY period
        ORDER BY period ASC
      `, params)

      const totals = await t.one(`
        SELECT
          COALESCE(SUM(price), 0)::int AS total_revenue,
          COUNT(*)::int AS total_transactions
        FROM transactions
        WHERE status = 'paid'
        ${sinceClause}
      `, params)

      return { periods, totals }
    })

    res.json({
      groupBy,
      since,
      periods: result.periods.map((p) => ({
        period: p.period,
        revenue: p.revenue_cents,
        revenueFormatted: `$${(p.revenue_cents / 100).toFixed(2)}`,
        transactions: p.transaction_count,
      })),
      totals: {
        revenue: result.totals.total_revenue,
        revenueFormatted: `$${(result.totals.total_revenue / 100).toFixed(2)}`,
        transactions: result.totals.total_transactions,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ── Overview ─────────────────────────────────────────────────────────────────

// GET /api/admin/financials/overview — quick snapshot
router.get('/admin/financials/overview', ...guard, async (_req, res, next) => {
  try {
    const result = await db.task(async (t) => {
      await t.none(TIMEOUT)

      const [active, canceled, totalRev, todayRev, credits] = await Promise.all([
        t.one("SELECT COUNT(*)::int AS count FROM subscriptions WHERE status IN ('active', 'trialing')"),
        t.one("SELECT COUNT(*)::int AS count FROM subscriptions WHERE status IN ('cancelled', 'canceled')"),
        t.one("SELECT COALESCE(SUM(price), 0)::int AS total FROM transactions WHERE status = 'paid'"),
        t.one("SELECT COALESCE(SUM(price), 0)::int AS total FROM transactions WHERE status = 'paid' AND created_at >= CURRENT_DATE"),
        t.one("SELECT COALESCE(SUM(amount), 0)::int AS total FROM credits"),
      ])

      return {
        activeSubscriptions: active.count,
        canceledSubscriptions: canceled.count,
        totalRevenue: totalRev.total,
        todayRevenue: todayRev.total,
        totalCreditsOutstanding: credits.total,
      }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

module.exports = router
