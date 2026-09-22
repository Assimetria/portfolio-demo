// @system — Data retention policy (& manual purge), template-managed.
//
// Closes the retention "utility gap": a single read endpoint that exposes the
// platform's audit-log retention policy, plus an admin-guarded endpoint that
// manually triggers the AuditLog purge (see AuditLog.cleanOldLogs).
//
// The module deliberately exercises the shared date + network helpers so the
// helper layer is proven in production code, not just in unit tests.
// Request bodies are validated with zod (Validation/schemas/@system/retention.js).
'use strict'

const express = require('express')
const router = express.Router()

const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const { validate } = require('../../../lib/@system/Validation')
const { RetentionCleanupBody } = require('../../../lib/@system/Validation/schemas/@system/retention')
const {
  retentionCutoffDate,
  toISOString,
} = require('../../../lib/@system/Helpers/date')
const {
  getClientIp,
  sanitizeIp,
} = require('../../../lib/@system/Helpers/network')
const AuditLog = require('../../../lib/@system/AuditLog')
const { retentionLimiter } = require('../../../lib/@system/RateLimit')

/** Default retention window for audit logs when nothing is configured. */
const DEFAULT_RETENTION_DAYS = 90
/** Sensible clamp so an admin can never request absurd purge windows. */
const MAX_RETENTION_DAYS = 3650

/**
 * Resolve the active audit-log retention window.
 *
 * @returns {number} Configured (env) or default day count.
 */
function currentRetentionDays() {
  const fromEnv = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '', 10)
  if (Number.isInteger(fromEnv) && fromEnv > 0 && fromEnv <= MAX_RETENTION_DAYS) {
    return fromEnv
  }
  return DEFAULT_RETENTION_DAYS
}

/**
 * Build the serialised retention policy object.
 *
 * @returns {{scope: string, defaultDays: number, configuredDays: number, cutoffAt: string}} Policy.
 */
function buildPolicy() {
  const configuredDays = currentRetentionDays()
  const cutoff = retentionCutoffDate(configuredDays, new Date())
  return {
    scope: 'audit_logs',
    defaultDays: DEFAULT_RETENTION_DAYS,
    configuredDays,
    cutoffAt: toISOString(cutoff),
  }
}

// GET /api/retention — read the current audit-log retention policy.
router.get('/retention', authenticate, (req, res) => {
  res.json({ retention: buildPolicy() })
})

// POST /api/retention/cleanup — admin-triggered purge of log rows older than
// the retention window.  Optional `{ days }` body overrides the window.
router.post(
  '/retention/cleanup',
  authenticate,
  requireAdmin,
  retentionLimiter,
  validate({ body: RetentionCleanupBody }),
  async (req, res, next) => {
    try {
      let days = currentRetentionDays()
      if (req.body && req.body.days !== undefined) {
        const parsed = Number(req.body.days)
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RETENTION_DAYS) {
          return res.status(400).json({
            message: `days must be an integer between 1 and ${MAX_RETENTION_DAYS}`,
          })
        }
        days = parsed
      }

      const deleted = await AuditLog.cleanOldLogs(days)

      // Record who triggered the purge for the audit trail.
      const ip = sanitizeIp(getClientIp(req), 'unknown')
      await AuditLog.logAction({
        userId: req.user && req.user.id,
        action: 'retention.cleanup',
        resourceType: 'system',
        resourceId: null,
        details: { retentionDays: days, deleted, scope: 'audit_logs' },
        ipAddress: ip,
        userAgent: req.get && req.get('user-agent'),
        status: 'success',
      })

      res.json({
        message: 'Retention cleanup complete',
        cleanup: { scope: 'audit_logs', retentionDays: days, deleted },
      })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
