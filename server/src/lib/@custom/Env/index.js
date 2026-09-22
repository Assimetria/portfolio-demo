// @custom — product-specific environment variable validation.
// Runs at server startup after @system/Env. Fails fast (process.exit(1)) with
// a clear list of what's missing so misconfigured deploys never boot into a
// half-broken state (#276526).
//
// Add product-specific required vars to REQUIRED_VARS below. Optional vars go
// in OPTIONAL_VARS to get warn-on-missing behaviour without aborting startup.
//
// Usage: require('./lib/@custom/Env')  // validate and exit on error

// Vars whose absence must abort startup.
// `test` skips required checks so unit/CI runs don't need a full env.
const REQUIRED_VARS = [
  {
    key: 'DATABASE_URL',
    description: 'PostgreSQL connection string (postgresql://user:pass@host:5432/dbname)',
    envs: ['production'],
  },
  {
    key: 'APP_URL',
    description: 'Public frontend URL (used for CORS and email links)',
    envs: ['production'],
  },
  // CSRF_SECRET moved to OPTIONAL_VARS — csrf.js auto-generates a per-process
  // fallback, so missing CSRF_SECRET should not prevent the server from starting.
  // This avoids App Runner health-check failures during initial provisioning (#1007207).
]

// Vars that should be present but only warn — server can still boot.
const OPTIONAL_VARS = [
  { key: 'REDIS_URL', description: 'Redis (session blacklist) — logout will not invalidate tokens without it' },
  { key: 'ERROR_TRACKING_DSN', description: 'Sentry DSN — errors will not be reported' },
  {
    key: 'CSRF_SECRET',
    description: 'CSRF token signing secret — a random one is generated at startup if missing',
    minLength: 32,
  },
]

function validate() {
  const errors = []
  const warnings = []
  const env = process.env.NODE_ENV ?? 'development'

  for (const spec of REQUIRED_VARS) {
    if (spec.envs && !spec.envs.includes(env)) continue

    const value = process.env[spec.key]
    if (value === undefined || value === '') {
      errors.push(`  ✗  ${spec.key} — required but not set  (${spec.description})`)
      continue
    }
    if (spec.minLength && value.length < spec.minLength) {
      errors.push(`  ✗  ${spec.key} — must be at least ${spec.minLength} characters (got ${value.length})`)
    }
  }

  for (const spec of OPTIONAL_VARS) {
    const value = process.env[spec.key]
    if (value === undefined || value === '') {
      warnings.push(`  ⚠  ${spec.key} — not set  (${spec.description})`)
    }
  }

  return { errors, warnings }
}

function bootstrap() {
  const { errors, warnings } = validate()

  if (warnings.length) {
    console.warn('\n[Env:@custom] Warnings:\n' + warnings.join('\n') + '\n')
  }

  if (errors.length) {
    console.error('\n[Env:@custom] Startup aborted — required environment variables are missing:\n')
    console.error(errors.join('\n'))
    console.error('\nCopy .env.example → .env and fill in the required values.\n')
    process.exit(1)
  }
}

bootstrap()

module.exports = { validate, REQUIRED_VARS, OPTIONAL_VARS }
