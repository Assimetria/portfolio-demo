'use strict'

/**
 * Migration 011 – Brands → @system + Subscription Upgrades
 * - Creates brands table as @system (multi-brand support for every SaaS product)
 * - Adds brand_id, plan_name, payment_provider to subscriptions
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS_DIR = path.join(__dirname, '../../schemas/@system')

exports.up = async (db) => {
  // 1. Create brands table (from @system schema)
  const brandsSql = fs.readFileSync(path.join(SCHEMAS_DIR, 'brands.sql'), 'utf8')
  await db.none(brandsSql)
  console.log('[011] ✓ brands table created (@system)')

  // 2. Add new columns to subscriptions (idempotent)
  await db.none(`
    ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS plan_name TEXT,
      ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe';
  `)
  await db.none('CREATE INDEX IF NOT EXISTS idx_subscriptions_brand_id ON subscriptions(brand_id)')
  console.log('[011] ✓ subscriptions upgraded (brand_id, plan_name, payment_provider)')
}

exports.down = async (db) => {
  await db.none('ALTER TABLE subscriptions DROP COLUMN IF EXISTS brand_id')
  await db.none('ALTER TABLE subscriptions DROP COLUMN IF EXISTS plan_name')
  await db.none('ALTER TABLE subscriptions DROP COLUMN IF EXISTS payment_provider')
  await db.none('DROP TABLE IF EXISTS brands CASCADE')
  console.log('[011] ✗ brands table dropped, subscription columns removed')
}
