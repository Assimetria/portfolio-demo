// @system — environment variable validation
// Called once at server startup. Fails fast with a clear error if required vars are missing.
// The schema itself (keys, defaults, requiredIn rules) lives in ./schema.js.
//
// Usage:
//   require('./lib/@system/Env')          // validate and exit on error
//   const { get } = require('./lib/@system/Env')
//   get('DATABASE_URL')                   // returns validated value

const { SCHEMA } = require('./schema')

// ── Validation ───────────────────────────────────────────────────────────────

function isTruthyFlag(value) {
  return value === '1' || value === 'true'
}

function validate() {
  const errors = []
  const warnings = []
  const env = process.env.NODE_ENV ?? 'development'
  const isProd = env === 'production'
  // Explicit escape hatch: lets production boot degraded (no DB / no JWT keys)
  // for troubleshooting. Anything that relies on it in steady state is a bug.
  const degradedBootAllowed = isTruthyFlag(process.env.ALLOW_DEGRADED_BOOT)
  if (isProd && degradedBootAllowed) {
    warnings.push('  ⚠  ALLOW_DEGRADED_BOOT is set — production is allowed to start without DATABASE_URL / JWT keys. Unset it once the incident is over.')
  }

  for (const spec of SCHEMA) {
    const raw = process.env[spec.key]

    // Apply default when missing
    if (raw === undefined && spec.default !== undefined) {
      process.env[spec.key] = spec.default
    }

    const value = process.env[spec.key]

    // Required check — always, or only in the listed environments
    const requiredHere = spec.required ||
      (Array.isArray(spec.requiredIn) && spec.requiredIn.includes(env) && !degradedBootAllowed)
    if (requiredHere && (value === undefined || value === '')) {
      const why = spec.required ? 'required' : `required when NODE_ENV=${env} (set ALLOW_DEGRADED_BOOT=1 to boot degraded on purpose)`
      errors.push(`  ✗  ${spec.key} — ${why} but not set  (${spec.description})`)
      continue
    }

    // Skip further checks when not set and not required
    if (value === undefined || value === '') continue

    // Type check
    if (spec.type === 'number' && isNaN(Number(value))) {
      errors.push(`  ✗  ${spec.key} — must be a number, got: "${value}"`)
    }

    // Allowed values check
    if (spec.allowed && !spec.allowed.includes(value)) {
      errors.push(`  ✗  ${spec.key} — must be one of [${spec.allowed.join(', ')}], got: "${value}"`)
    }

    // Min-length check
    if (spec.minLength && value.length < spec.minLength) {
      errors.push(`  ✗  ${spec.key} — must be at least ${spec.minLength} characters`)
    }

    // Prod-safety warning (e.g. still using placeholder values)
    if (isProd && spec.warnInProd && value.includes(spec.warnInProd)) {
      warnings.push(`  ⚠  ${spec.key} — looks like a placeholder value in production`)
    }
  }

  // Ensure at least one source is configured for each JWT key.
  //
  // Production: hard requirement. A production process without signing keys
  // cannot authenticate anyone, so booting "healthy" would only hide the
  // misconfiguration behind 401s. The historical rollback-loop concern
  // (#1007207 — container never up long enough to receive env updates) is
  // handled by start.sh, which generates an ephemeral pair BEFORE node starts
  // when none is configured; ALLOW_DEGRADED_BOOT=1 is the explicit override
  // for launches that bypass start.sh.
  // Dev/test: warn, so local development and QA can start without pre-
  // generating keys.
  const hasPrivateKey = !!(process.env.JWT_PRIVATE_KEY_FILE || process.env.JWT_PRIVATE_KEY)
  const hasPublicKey = !!(process.env.JWT_PUBLIC_KEY_FILE || process.env.JWT_PUBLIC_KEY)
  const jwtRequired = isProd && !degradedBootAllowed
  const jwtProblems = jwtRequired ? errors : warnings
  const jwtMark = jwtRequired ? '✗' : '⚠'
  const jwtHint = jwtRequired
    ? 'required in production (set ALLOW_DEGRADED_BOOT=1 to boot degraded on purpose)'
    : 'Run: npm run generate-keys'

  if (!hasPrivateKey) {
    jwtProblems.push(
      `  ${jwtMark}  JWT_PRIVATE_KEY_FILE (or JWT_PRIVATE_KEY) — not set. ${jwtHint}  (JWT signing will be unavailable)`
    )
  }
  if (!hasPublicKey) {
    jwtProblems.push(
      `  ${jwtMark}  JWT_PUBLIC_KEY_FILE (or JWT_PUBLIC_KEY) — not set. ${jwtHint}  (JWT verification will be unavailable)`
    )
  }

  // CSRF_SECRET outside production: warn when unset (csrf.js auto-generates a
  // per-process fallback). In production it is required by the SCHEMA above and
  // has already been reported as an error.
  const csrfSecret = process.env.CSRF_SECRET
  if (!isProd && (!csrfSecret || csrfSecret === '')) {
    warnings.push(
      '  ⚠  CSRF_SECRET — not set. A random secret will be generated at startup. ' +
      'Set CSRF_SECRET in env for persistence across restarts.'
    )
  }

  // In all non-test environments, verify the configured keys look like real PEM material
  if (env !== 'test') {
    const fs = require('fs')

    function readOrInline(fileVar, inlineVar, label) {
      const filePath = process.env[fileVar]
      if (filePath) {
        try {
          return fs.readFileSync(filePath, 'utf8')
        } catch (err) {
          errors.push(`  ✗  ${fileVar}="${filePath}" — cannot read file: ${err.message}`)
          return ''
        }
      }
      return (process.env[inlineVar] ?? '').replace(/\\n/g, '\n')
    }

    const privateKeyPem = readOrInline('JWT_PRIVATE_KEY_FILE', 'JWT_PRIVATE_KEY')
    const publicKeyPem = readOrInline('JWT_PUBLIC_KEY_FILE', 'JWT_PUBLIC_KEY')

    if (hasPrivateKey && (!privateKeyPem.includes('BEGIN') || !privateKeyPem.includes('PRIVATE KEY'))) {
      warnings.push('  ⚠  JWT_PRIVATE_KEY — does not look like a real PEM key (JWT signing will fail)')
    }
    if (hasPublicKey && (!publicKeyPem.includes('BEGIN') || !publicKeyPem.includes('PUBLIC KEY'))) {
      warnings.push('  ⚠  JWT_PUBLIC_KEY — does not look like a real PEM key (JWT verification will fail)')
    }
  }

  return { errors, warnings }
}

// ── Bootstrap (called at startup) ────────────────────────────────────────────

function bootstrap() {
  const { errors, warnings } = validate()

  if (warnings.length) {
    console.warn('\n[Env] Warnings:\n' + warnings.join('\n') + '\n')
  }

  if (errors.length) {
    console.error('\n[Env] Startup aborted — environment is misconfigured:\n')
    console.error(errors.join('\n'))
    console.error('\nCopy .env.example → .env and fill in the required values.\n')
    process.exit(1)
  }
}

// ── Accessor ─────────────────────────────────────────────────────────────────

function get(key) {
  const value = process.env[key]
  if (value === undefined) {
    throw new Error(`[Env] process.env.${key} is not set. Add it to .env and .env.example.`)
  }
  return value
}

// Run validation immediately on require()
bootstrap()

module.exports = { get, validate, SCHEMA }
