// @system — add stripe_customer_id to subscriptions table
module.exports = {
  name: '006_stripe_customer_id',
  async up(db) {
    // Guard: on a fresh DB the subscriptions table does not exist yet — it is created
    // by 012_stripe_subscriptions which runs after this migration in file-name order.
    // When subscriptions is absent we skip silently; the column will be included in
    // the CREATE TABLE statement inside 012_stripe_subscriptions.  Without this guard,
    // this migration throws "relation subscriptions does not exist", which causes
    // run.js to abort and prevents all subsequent @custom migrations (blog, pages,
    // clips, collaborators, teams) from running — fix for #19330.
    await db.none(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'subscriptions'
        ) THEN
          ALTER TABLE subscriptions
            ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

          CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
            ON subscriptions(stripe_customer_id);
        END IF;
      END $$;
    `)
  },
  async down(db) {
    await db.none(`DROP INDEX IF EXISTS idx_subscriptions_stripe_customer_id`)
    await db.none(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'subscriptions'
        ) THEN
          ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
        END IF;
      END $$;
    `)
  },
}
