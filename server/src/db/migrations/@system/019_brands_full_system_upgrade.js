'use strict'

/**
 * Migration 012 – Brands → full @system upgrade
 *
 * Adds missing columns to the brands table created in 011:
 *   - subscription_id FK (Brand belongsTo Subscription)
 *   - external_id (for external integrations)
 *   - tags TEXT[] (array of string tags)
 *   - metadata JSONB (arbitrary key-value)
 *   - image_url (brand hero/cover image)
 *   - deleted_at (soft-delete timestamp)
 *   - status CHECK constraint expanded (active, draft, archived, deleted, inactive)
 *
 * Also adds brand_id FK to collaborators (Brand hasMany Collaborators).
 */

exports.up = async (db) => {
  // ── 1. Add new columns to brands (idempotent) ──────────────────────────────
  await db.none(`
    ALTER TABLE brands
      ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS external_id     TEXT,
      ADD COLUMN IF NOT EXISTS tags            TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS metadata        JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS image_url       TEXT,
      ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;
  `)
  console.log('[012] ✓ brands: added subscription_id, external_id, tags, metadata, image_url, deleted_at')

  // ── 2. Indexes on new columns ───────────────────────────────────────────────
  await db.none('CREATE INDEX IF NOT EXISTS idx_brands_subscription_id ON brands(subscription_id)')
  await db.none('CREATE INDEX IF NOT EXISTS idx_brands_external_id ON brands(external_id)')
  console.log('[012] ✓ brands: indexes created')

  // ── 3. Expand status constraint ─────────────────────────────────────────────
  // Drop old constraint if exists (may or may not exist depending on creation method)
  await db.none(`
    DO $$ BEGIN
      ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_status_check;
    EXCEPTION WHEN undefined_object THEN NULL;
    END $$;
  `)
  await db.none(`
    ALTER TABLE brands ADD CONSTRAINT brands_status_check
      CHECK (status IN ('active', 'draft', 'archived', 'deleted', 'inactive'));
  `)
  console.log('[012] ✓ brands: status constraint updated (active, draft, archived, deleted, inactive)')

  // ── 4. Brand hasMany Collaborators – add brand_id FK to collaborators ───────
  // collaborators is a @custom table (002_collaborators.js) that may not exist
  // yet on a fresh DB when @system migrations run first. Guard with IF EXISTS so
  // migration 012 does not abort the entire run on a clean installation.
  // The @custom 002_collaborators migration must re-apply this column/index when
  // it runs (it uses ADD COLUMN IF NOT EXISTS, so it is idempotent either way).
  await db.none(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'collaborators'
      ) THEN
        EXECUTE 'ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS brand_id INTEGER REFERENCES brands(id) ON DELETE CASCADE';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_collaborators_brand_id ON collaborators(brand_id)';
      END IF;
    END $$;
  `)
  console.log('[012] ✓ collaborators: added brand_id FK (skipped if table not yet created)')
}

exports.down = async (db) => {
  // Remove brand_id from collaborators (guard: table may not exist)
  await db.none(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'collaborators'
      ) THEN
        EXECUTE 'DROP INDEX IF EXISTS idx_collaborators_brand_id';
        EXECUTE 'ALTER TABLE collaborators DROP COLUMN IF EXISTS brand_id';
      END IF;
    END $$;
  `)

  // Drop new constraint, restore simple one
  await db.none(`
    DO $$ BEGIN
      ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_status_check;
    EXCEPTION WHEN undefined_object THEN NULL;
    END $$;
  `)

  // Remove new columns from brands
  await db.none('DROP INDEX IF EXISTS idx_brands_external_id')
  await db.none('DROP INDEX IF EXISTS idx_brands_subscription_id')
  await db.none(`
    ALTER TABLE brands
      DROP COLUMN IF EXISTS subscription_id,
      DROP COLUMN IF EXISTS external_id,
      DROP COLUMN IF EXISTS tags,
      DROP COLUMN IF EXISTS metadata,
      DROP COLUMN IF EXISTS image_url,
      DROP COLUMN IF EXISTS deleted_at;
  `)
  console.log('[012] ✗ reverted brands upgrade and collaborators.brand_id')
}
