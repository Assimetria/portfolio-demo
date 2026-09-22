// @system — Migration: Full billing infrastructure
// Adds credits, transactions, collaborators, notifications tables
// Enriches subscriptions table with Simtria billing fields
'use strict'

const fs = require('fs')
const path = require('path')

module.exports = {
  name: '013_billing_infrastructure',

  async up(db) {
    // Run schema SQL files in order (tables must exist before ALTER)
    const schemasDir = path.join(__dirname, '../../schemas/@system')

    // 1. credits table
    const creditsSql = fs.readFileSync(path.join(schemasDir, 'credits.sql'), 'utf8')
    await db.none(creditsSql)

    // 2. transactions table
    const txSql = fs.readFileSync(path.join(schemasDir, 'transactions.sql'), 'utf8')
    await db.none(txSql)

    // 3. collaborators table
    const collabSql = fs.readFileSync(path.join(schemasDir, 'collaborators.sql'), 'utf8')
    await db.none(collabSql)

    // 4. notifications table
    const notifSql = fs.readFileSync(path.join(schemasDir, 'notifications.sql'), 'utf8')
    await db.none(notifSql)

    // 5. Enrich subscriptions table with billing fields (idempotent ALTERs)
    await db.none(`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS periodicity TEXT;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS utm_source TEXT;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS referrer TEXT;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_renew TIMESTAMPTZ;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    `)

    // 6. Add unique constraint on credits.user_id for ensureCreditsExist upsert
    await db.none(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_user_id_unique ON credits(user_id);
    `)

    console.log('[migration] 013_billing_infrastructure: done')
  },

  async down(db) {
    await db.none('DROP TABLE IF EXISTS notifications CASCADE')
    await db.none('DROP TABLE IF EXISTS collaborators CASCADE')
    await db.none('DROP TABLE IF EXISTS transactions CASCADE')
    await db.none('DROP TABLE IF EXISTS credits CASCADE')
    await db.none(`
      ALTER TABLE subscriptions DROP COLUMN IF EXISTS plan;
      ALTER TABLE subscriptions DROP COLUMN IF EXISTS price;
      ALTER TABLE subscriptions DROP COLUMN IF EXISTS periodicity;
      ALTER TABLE subscriptions DROP COLUMN IF EXISTS utm_source;
      ALTER TABLE subscriptions DROP COLUMN IF EXISTS referrer;
      ALTER TABLE subscriptions DROP COLUMN IF EXISTS last_renew;
      ALTER TABLE subscriptions DROP COLUMN IF EXISTS metadata;
    `)
    console.log('[migration] 013_billing_infrastructure: rolled back')
  },
}
