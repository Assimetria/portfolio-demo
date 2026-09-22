// @system — Usage and cost tracking API
//
// GET /api/usage/dashboard      — Dashboard summary (today, this month, trends)
// GET /api/usage/history         — Historical usage data with filters
// GET /api/usage/breakdown       — Cost breakdown by service
// POST /api/usage/track          — Manual usage tracking (for internal use)
// GET /api/usage/limits          — User cost limits and current usage
//
// Request bodies are validated with zod (Validation/schemas/@system/usage.js).

const express = require('express')
const router = express.Router()

const { authenticate } = require('../../../lib/@system/Helpers/auth')
const { db } = require('../../../lib/@system/Database')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const { UsageTrackBody } = require('../../../lib/@system/Validation/schemas/@system/usage')

// ─── Dashboard Summary ───────────────────────────────────────────────────────

/**
 * GET /api/usage/dashboard
 * Returns: { today, thisMonth, yesterday, lastMonth, topServices, trends }
 */
router.get('/usage/dashboard', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

    // Today's costs
    const todayCost = await db('usage_events')
      .where({ user_id: userId })
      .whereBetween('created_at', [today, now.toISOString()])
      .sum('cost_usd as total')
      .first()

    // Yesterday's costs
    const yesterdayCost = await db('usage_events')
      .where({ user_id: userId })
      .whereBetween('created_at', [yesterday, today])
      .sum('cost_usd as total')
      .first()

    // This month's costs
    const thisMonthCost = await db('usage_events')
      .where({ user_id: userId })
      .whereBetween('created_at', [thisMonthStart, now.toISOString()])
      .sum('cost_usd as total')
      .first()

    // Last month's costs
    const lastMonthCost = await db('usage_events')
      .where({ user_id: userId })
      .whereBetween('created_at', [lastMonthStart, lastMonthEnd + 'T23:59:59'])
      .sum('cost_usd as total')
      .first()

    // Top services this month
    const topServices = await db('usage_events')
      .where({ user_id: userId })
      .whereBetween('created_at', [thisMonthStart, now.toISOString()])
      .select('service')
      .sum('cost_usd as cost')
      .count('* as requests')
      .groupBy('service')
      .orderBy('cost', 'desc')
      .limit(5)

    // Last 7 days trend
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      last7Days.push(date)
    }

    const trendData = await db('usage_events')
      .where({ user_id: userId })
      .whereBetween('created_at', [last7Days[0], now.toISOString()])
      .select(db.raw('DATE(created_at) as date'))
      .sum('cost_usd as cost')
      .groupBy(db.raw('DATE(created_at)'))

    const trends = last7Days.map(date => {
      const found = trendData.find(d => d.date.toISOString().split('T')[0] === date)
      return {
        date,
        cost: found ? parseFloat(found.cost) : 0
      }
    })

    // Get user limits
    const limits = await db('user_cost_limits')
      .where({ user_id: userId })
      .first()

    const response = {
      today: {
        cost: parseFloat(todayCost?.total || 0),
        currency: 'USD'
      },
      yesterday: {
        cost: parseFloat(yesterdayCost?.total || 0),
        change: calculateChange(todayCost?.total, yesterdayCost?.total)
      },
      thisMonth: {
        cost: parseFloat(thisMonthCost?.total || 0),
        currency: 'USD',
        limit: limits?.monthly_limit_usd ? parseFloat(limits.monthly_limit_usd) : null,
        percentUsed: limits?.monthly_limit_usd 
          ? (parseFloat(thisMonthCost?.total || 0) / parseFloat(limits.monthly_limit_usd) * 100).toFixed(1)
          : null
      },
      lastMonth: {
        cost: parseFloat(lastMonthCost?.total || 0),
        change: calculateChange(thisMonthCost?.total, lastMonthCost?.total)
      },
      topServices: topServices.map(s => ({
        service: s.service,
        cost: parseFloat(s.cost),
        requests: parseInt(s.requests)
      })),
      trends,
      limits: limits ? {
        monthly: parseFloat(limits.monthly_limit_usd),
        daily: parseFloat(limits.daily_limit_usd),
        alertThreshold: limits.alert_threshold_percent
      } : null
    }

    res.json({ ok: true, ...response })
  } catch (err) {
    logger.error('Failed to fetch usage dashboard', err)
    next(err)
  }
})

// ─── Usage History ───────────────────────────────────────────────────────────

/**
 * GET /api/usage/history?days=30&service=openai&limit=100
 * Returns: { events: [...], total, page, pages }
 */
router.get('/usage/history', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    const days = parseInt(req.query.days) || 30
    const service = req.query.service
    const limit = Math.min(parseInt(req.query.limit) || 50, 500)
    const page = parseInt(req.query.page) || 1
    const offset = (page - 1) * limit

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = db('usage_events')
      .where({ user_id: userId })
      .where('created_at', '>=', startDate)
      .orderBy('created_at', 'desc')

    if (service) {
      query = query.where({ service })
    }

    const [events, countResult] = await Promise.all([
      query.clone().limit(limit).offset(offset),
      query.clone().count('* as count').first()
    ])

    const total = parseInt(countResult.count)
    const pages = Math.ceil(total / limit)

    res.json({
      ok: true,
      events: events.map(e => ({
        id: e.id,
        service: e.service,
        operation: e.operation,
        model: e.model,
        cost: parseFloat(e.cost_usd),
        tokens: {
          input: e.tokens_input,
          output: e.tokens_output,
          total: e.tokens_total
        },
        bytes: e.bytes_processed,
        createdAt: e.created_at,
        metadata: e.metadata
      })),
      pagination: { total, page, pages, limit }
    })
  } catch (err) {
    logger.error('Failed to fetch usage history', err)
    next(err)
  }
})

// ─── Cost Breakdown ──────────────────────────────────────────────────────────

/**
 * GET /api/usage/breakdown?period=month
 * Returns: { byService, byModel, byDay, total }
 */
router.get('/usage/breakdown', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    const period = req.query.period || 'month' // 'day', 'week', 'month'
    
    let startDate
    const now = new Date()
    if (period === 'day') {
      startDate = now.toISOString().split('T')[0]
    } else if (period === 'week') {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    }

    // By service
    const byService = await db('usage_events')
      .where({ user_id: userId })
      .where('created_at', '>=', startDate)
      .select('service')
      .sum('cost_usd as cost')
      .count('* as requests')
      .groupBy('service')
      .orderBy('cost', 'desc')

    // By model (for AI services)
    const byModel = await db('usage_events')
      .where({ user_id: userId })
      .where('created_at', '>=', startDate)
      .whereNotNull('model')
      .select('service', 'model')
      .sum('cost_usd as cost')
      .count('* as requests')
      .groupBy('service', 'model')
      .orderBy('cost', 'desc')
      .limit(10)

    const total = byService.reduce((sum, s) => sum + parseFloat(s.cost), 0)

    res.json({
      ok: true,
      period,
      total,
      byService: byService.map(s => ({
        service: s.service,
        cost: parseFloat(s.cost),
        requests: parseInt(s.requests),
        percentage: ((parseFloat(s.cost) / total) * 100).toFixed(1)
      })),
      byModel: byModel.map(m => ({
        service: m.service,
        model: m.model,
        cost: parseFloat(m.cost),
        requests: parseInt(m.requests)
      }))
    })
  } catch (err) {
    logger.error('Failed to fetch cost breakdown', err)
    next(err)
  }
})

// ─── Track Usage (Internal) ──────────────────────────────────────────────────

/**
 * POST /api/usage/track
 * Body: { service, operation, model?, cost, tokens?, bytes?, metadata? }
 */
router.post('/usage/track', authenticate, validate({ body: UsageTrackBody }), async (req, res, next) => {
  try {
    const userId = req.user.id
    const {
      service,
      operation,
      model,
      cost,
      tokens,
      bytes,
      metadata
    } = req.body

    if (!service || !operation || cost === undefined) {
      return res.status(400).json({ message: 'service, operation, and cost are required' })
    }

    await db('usage_events').insert({
      user_id: userId,
      service,
      operation,
      model,
      cost_usd: cost,
      tokens_input: tokens?.input || 0,
      tokens_output: tokens?.output || 0,
      tokens_total: tokens?.total || (tokens?.input + tokens?.output) || 0,
      bytes_processed: bytes || 0,
      metadata: metadata ? JSON.stringify(metadata) : null
    })

    res.json({ ok: true, message: 'Usage tracked' })
  } catch (err) {
    logger.error('Failed to track usage', err)
    next(err)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateChange(current, previous) {
  if (!previous || previous == 0) return null
  const change = ((current - previous) / previous * 100).toFixed(1)
  return {
    value: Math.abs(parseFloat(change)),
    direction: change >= 0 ? 'up' : 'down'
  }
}

module.exports = router
