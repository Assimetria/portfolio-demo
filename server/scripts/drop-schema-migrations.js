// scripts/drop-schema-migrations.js
// Used by index.js migration recovery: drops the schema_migrations table so
// migrations can be re-run from scratch. Extracted from inline spawnSync -e
// code in index.js to avoid the execSync/spawnSync template-string anti-pattern.
'use strict'

const { Client } = require('pg')

const ssl = process.env.NODE_ENV === 'production'
  ? (process.env.DB_SSL_CA ? { ca: require('fs').readFileSync(process.env.DB_SSL_CA) } : true)
  : undefined

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl })

client.connect()
  .then(() => client.query('DROP TABLE IF EXISTS schema_migrations'))
  .then(() => client.end())
  .catch((err) => {
    console.error('[drop-schema-migrations] error:', err.message)
    process.exit(1)
  })
