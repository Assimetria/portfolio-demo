'use strict'

/**
 * Migration 014 – Feature Flags
 * Creates the feature_flags table for admin-managed toggles.
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  const sql = fs.readFileSync(path.join(SCHEMAS_DIR, 'feature_flags.sql'), 'utf8')
  await db.none(sql)

  // Seed default flags
  const defaults = [
    { key: 'require_email_verification', label: 'Require Email Verification', description: 'New users must verify their email before accessing the app.', category: 'auth', enabled: true },
    { key: 'email_notifications', label: 'Email Notifications', description: 'Send email notifications for account activity.', category: 'email', enabled: true },
    { key: 'marketing_emails', label: 'Marketing Emails', description: 'Allow marketing and promotional emails.', category: 'email', enabled: false },
    { key: 'digest_emails', label: 'Digest Emails', description: 'Send periodic digest emails to users.', category: 'email', enabled: true },
    { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the platform in maintenance mode. Users will see a maintenance page.', category: 'general', enabled: false },
    { key: 'user_registration', label: 'User Registration', description: 'Allow new user registrations.', category: 'auth', enabled: true },
    { key: 'api_keys_enabled', label: 'API Keys', description: 'Allow users to generate API keys.', category: 'general', enabled: true },
    { key: 'stripe_billing', label: 'Stripe Billing', description: 'Enable Stripe subscription billing.', category: 'billing', enabled: true },
  ]

  for (const flag of defaults) {
    await db.none(
      `INSERT INTO feature_flags (key, label, description, category, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO NOTHING`,
      [flag.key, flag.label, flag.description, flag.category, flag.enabled]
    )
  }

  console.log('[014_feature_flags] ✓ feature_flags table created with defaults')
}

exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS feature_flags CASCADE')
  console.log('[014_feature_flags] ✗ feature_flags table dropped')
}
