// @system — GDPR compliance API
// POST   /api/gdpr/consent    — record cookie consent choice (GDPR Art. 7, no auth required)
// GET    /api/gdpr/my-data    — export all personal data for the current user (Art. 15)
// DELETE /api/gdpr/my-data    — erase all personal data for the current user (Art. 17)
// Request bodies are validated with zod (Validation/schemas/@system/gdpr.js).

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const db = require('../../../lib/@system/PostgreSQL')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const { GdprConsentBody } = require('../../../lib/@system/Validation/schemas/@system/gdpr')
const { isEnabled: isModuleEnabled } = require('../../../lib/@system/Helpers/modules')

// Feature modules: the teams / apiKeys / webhooks tables only exist when their
// module is enabled (their migrations are skipped otherwise), so the export
// and erasure below must not touch them when the module is off.
const EMPTY = Promise.resolve([])
function whenModule(key, query) {
  return isModuleEnabled(key) ? query() : EMPTY
}

// ── POST /api/gdpr/consent ────────────────────────────────────────────────────
// Records the user's consent choice in gdpr_consent_log.
// No authentication required — consent is given before/without login.

router.post('/gdpr/consent', validate({ body: GdprConsentBody }), async (req, res, next) => {
  try {
    const { consent_value, session_id } = req.body

    if (!consent_value || !['essential', 'all'].includes(consent_value)) {
      return res.status(400).json({ message: 'consent_value must be "essential" or "all"' })
    }

    const analyticsConsent = consent_value === 'all'
    const marketingConsent = consent_value === 'all'

    await db.none(
      `INSERT INTO gdpr_consent_log
         (session_id, user_id, analytics_consent, marketing_consent, consent_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        session_id ?? null,
        req.user?.id ?? null,
        analyticsConsent,
        marketingConsent,
        consent_value,
        req.ip ?? null,
        req.headers['user-agent']?.slice(0, 512) ?? null,
      ]
    )

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/gdpr/my-data ─────────────────────────────────────────────────────
// Returns all personal data held for the authenticated user (GDPR Art. 15).

router.get('/gdpr/my-data', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id

    const [
      user, sessions, consentLog, auditLogs, subscriptions,
      teamMemberships, notifications, communicationPreferences,
      credits, transactions, apiKeys, webhooks, oauthAccounts,
    ] = await Promise.all([
      db.oneOrNone(
        `SELECT id, email, name, role, created_at, updated_at, email_verified_at
         FROM users WHERE id = $1`,
        [userId]
      ),
      db.any(
        `SELECT id, created_at, expires_at
         FROM sessions WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [userId]
      ),
      db.any(
        `SELECT consent_value, analytics_consent, marketing_consent, created_at
         FROM gdpr_consent_log WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [userId]
      ),
      db.any(
        `SELECT id, action, resource_type, resource_id, ip_address, user_agent, created_at
         FROM audit_logs WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 200`,
        [userId]
      ),
      db.any(
        `SELECT id, plan, status, price, periodicity, current_period_start,
                current_period_end, cancel_at_period_end, created_at, updated_at
         FROM subscriptions WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      ),
      whenModule('teams', () => db.any(
        `SELECT tm.id, tm.role, tm.joined_at, t.name AS team_name, t.slug AS team_slug
         FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE tm.user_id = $1
         ORDER BY tm.joined_at DESC`,
        [userId]
      )),
      db.any(
        `SELECT id, title, message, type, seen_at, created_at
         FROM notifications WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 100`,
        [userId]
      ),
      db.oneOrNone(
        `SELECT email_marketing, product_updates, weekly_digest,
                in_app_notifications, sms_notifications, gdpr_consent, gdpr_consent_at,
                created_at, updated_at
         FROM communication_preferences WHERE user_id = $1`,
        [userId]
      ),
      db.any(
        `SELECT id, amount, type, description, created_at
         FROM credits WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 100`,
        [userId]
      ),
      db.any(
        `SELECT id, type, amount, status, created_at
         FROM transactions WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 100`,
        [userId]
      ),
      whenModule('apiKeys', () => db.any(
        `SELECT id, name, key_prefix, scopes, last_used_at, expires_at, created_at
         FROM api_keys WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      )),
      whenModule('webhooks', () => db.any(
        `SELECT id, url, events, description, active, created_at, updated_at
         FROM webhooks WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      )),
      db.any(
        `SELECT id, provider, provider_id, email, created_at
         FROM oauth_accounts WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      ),
    ])

    res.json({
      exported_at: new Date().toISOString(),
      user,
      sessions,
      consent_history: consentLog,
      audit_logs: auditLogs,
      subscriptions,
      team_memberships: teamMemberships,
      notifications,
      communication_preferences: communicationPreferences,
      credits,
      transactions,
      api_keys: apiKeys,
      webhooks,
      oauth_accounts: oauthAccounts,
    })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/gdpr/my-data ──────────────────────────────────────────────────
// Erases all personal data for the authenticated user (GDPR Art. 17).
// Anonymises the users row rather than hard-deleting to preserve FK integrity.

router.delete('/gdpr/my-data', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    const anonEmail = `deleted_${userId}@gdpr.invalid`

    await db.tx(async (t) => {
      // Revoke all API keys (cascades to api_key_usage)
      if (isModuleEnabled('apiKeys')) await t.none('DELETE FROM api_keys WHERE user_id = $1', [userId])

      // Delete webhooks (cascades to webhook_deliveries)
      if (isModuleEnabled('webhooks')) await t.none('DELETE FROM webhooks WHERE user_id = $1', [userId])

      // Delete refresh tokens
      await t.none('DELETE FROM refresh_tokens WHERE user_id = $1', [userId])

      // Remove team memberships
      if (isModuleEnabled('teams')) await t.none('DELETE FROM team_members WHERE user_id = $1', [userId])

      // Cancel active subscriptions
      await t.none(
        `UPDATE subscriptions
         SET status = 'canceled', cancel_at_period_end = true, updated_at = now()
         WHERE user_id = $1 AND status NOT IN ('canceled', 'expired')`,
        [userId]
      )

      // Anonymise audit logs (keep records for compliance, remove PII)
      await t.none(
        'UPDATE audit_logs SET user_id = NULL, actor_email = NULL WHERE user_id = $1',
        [userId]
      )

      // Revoke all active sessions
      await t.none('DELETE FROM sessions WHERE user_id = $1', [userId])

      // Clear consent log user_id references (keep records, remove linkage)
      await t.none(
        'UPDATE gdpr_consent_log SET user_id = NULL WHERE user_id = $1',
        [userId]
      )

      // Anonymise the user row (last — after all FK references are handled)
      await t.none(
        `UPDATE users
         SET email = $2, name = 'Deleted User', password_hash = '',
             email_verified_at = NULL, updated_at = now()
         WHERE id = $1`,
        [userId, anonEmail]
      )
    })

    logger.info({ userId }, '[gdpr] user data erased (Art. 17)')
    res.json({ ok: true, message: 'Your data has been erased.' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
