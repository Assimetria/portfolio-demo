// @system — environment variable schema (pure data, no side effects)
//
// Split out of ./index.js so modules that only need a documented default
// (e.g. the PORT fallback in OAuth callback URLs) can read it WITHOUT
// triggering the validation + process.exit bootstrap that ./index.js runs on
// require(). One schema, one set of defaults.
//
// Spec fields:
//   required    — always required
//   requiredIn  — required only in these NODE_ENVs (e.g. ['production']); the
//                 requirement is lifted when ALLOW_DEGRADED_BOOT=1 is set
//                 explicitly, which is the ONLY way to boot production without
//                 a database / JWT keys (troubleshooting, never steady state)
//   default, type ('number'), allowed [...], minLength, description

const SCHEMA = [
  // ── Core ──────────────────────────────────────────────────────────────────
  {
    key: 'NODE_ENV',
    required: false,
    default: 'development',
    allowed: ['development', 'test', 'production'],
    description: 'Runtime environment',
  },
  {
    // 3000 is the production contract: Dockerfile ENV PORT=3000, start.sh
    // PORT=${PORT:-3000}, App Runner service port 3000. Local development sets
    // PORT=3001 in server/.env (the Webpack dev server proxies to 3001).
    // index.js reads process.env.PORT without a second default — this is the
    // single source of truth.
    key: 'PORT',
    required: false,
    default: '3000',
    type: 'number',
    description: 'HTTP port the server listens on (3000 = Dockerfile / App Runner contract)',
  },
  {
    key: 'ALLOW_DEGRADED_BOOT',
    required: false,
    allowed: ['0', '1', 'false', 'true'],
    description: 'Set to 1 to let production start WITHOUT DATABASE_URL / JWT keys (degraded). Troubleshooting only — never leave it set.',
  },

  // ── Database ──────────────────────────────────────────────────────────────
  {
    key: 'DATABASE_URL',
    required: false,
    requiredIn: ['production'],
    description: 'PostgreSQL connection string  e.g. postgresql://user:pass@host:5432/dbname  (required in production; dev/test start degraded without it)',
  },
  {
    key: 'DB_POOL_MAX',
    required: false,
    default: '10',
    type: 'number',
    description: 'Maximum number of clients in the PostgreSQL connection pool',
  },
  {
    key: 'DB_POOL_IDLE_TIMEOUT',
    required: false,
    default: '30000',
    type: 'number',
    description: 'Milliseconds before an idle pool client is closed',
  },
  {
    key: 'DB_POOL_CONNECTION_TIMEOUT',
    required: false,
    default: '2000',
    type: 'number',
    description: 'Milliseconds to wait for an available pool client before throwing',
  },
  {
    key: 'DB_POOL_SSL',
    required: false,
    description: 'Set to "false" to disable SSL even in production (default: SSL on in production)',
  },

  // ── Redis ─────────────────────────────────────────────────────────────────
  {
    key: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL  e.g. redis://localhost:6379 — leave unset to disable Redis',
  },

  // ── Auth (RS256 asymmetric key pair) ─────────────────────────────────────
  // Provide EITHER the file path (preferred) OR the inline PEM — not both.
  // File-based is recommended: the raw key stays out of .env files.
  // In production inject the PEM via the App Runner runtime env (Orkosi
  // provisioning) or a secrets manager. One of each pair is REQUIRED in
  // production (see validate()); start.sh generates an ephemeral pair as a
  // last resort so the container still boots, at the cost of sessions
  // resetting on every restart.
  {
    key: 'JWT_PRIVATE_KEY_FILE',
    required: false,
    description: 'Path to RSA private key PEM file (preferred) — set by npm run generate-keys',
  },
  {
    key: 'JWT_PRIVATE_KEY',
    required: false,
    description: 'RSA private key PEM inline (with \\n line endings) — for runtime-env / secrets-manager injection',
  },
  {
    key: 'JWT_PUBLIC_KEY_FILE',
    required: false,
    description: 'Path to RSA public key PEM file (optional alternative to JWT_PUBLIC_KEY)',
  },
  {
    key: 'JWT_PUBLIC_KEY',
    required: false,
    description: 'RSA public key PEM (with \\n line endings) — used to verify JWT tokens',
  },

  // ── CSRF ──────────────────────────────────────────────────────────────────
  {
    key: 'CSRF_SECRET',
    required: false,
    // Mandatory in production: see Middleware/csrf.js — per-process secrets break
    // double-submit tokens across App Runner instances and restarts.
    requiredIn: ['production'],
    minLength: 32,
    description: 'Secret used to sign CSRF tokens — generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  },

  // ── App ───────────────────────────────────────────────────────────────────
  {
    key: 'APP_URL',
    required: false,
    default: 'http://localhost:5173',
    description: 'Public frontend URL (used for CORS)',
  },

  // ── OAuth ─────────────────────────────────────────────────────────────────
  {
    key: 'GOOGLE_CLIENT_ID',
    required: false,
    description: 'Google OAuth2 client ID (console.cloud.google.com)',
  },
  {
    key: 'GOOGLE_CLIENT_SECRET',
    required: false,
    description: 'Google OAuth2 client secret',
  },
  {
    key: 'GITHUB_CLIENT_ID',
    required: false,
    description: 'GitHub OAuth App client ID (github.com/settings/developers)',
  },
  {
    key: 'GITHUB_CLIENT_SECRET',
    required: false,
    description: 'GitHub OAuth App client secret',
  },
  {
    key: 'SERVER_URL',
    required: false,
    description: 'Public server URL — used to build OAuth callback URIs  e.g. https://api.example.com',
  },

  // ── Stripe ────────────────────────────────────────────────────────────────
  {
    key: 'STRIPE_SECRET_KEY',
    required: false,
    description: 'Stripe secret key (sk_live_... or sk_test_...)',
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook signing secret (whsec_...)',
  },

  // ── AWS / SES ─────────────────────────────────────────────────────────────
  {
    key: 'AWS_REGION',
    required: false,
    default: 'eu-west-1',
    description: 'AWS region for SES, S3 and other services',
  },
  {
    key: 'AWS_ACCESS_KEY_ID',
    required: false,
    description: 'AWS access key ID',
  },
  {
    key: 'AWS_SECRET_ACCESS_KEY',
    required: false,
    description: 'AWS secret access key',
  },
  {
    key: 'SES_FROM_EMAIL',
    required: false,
    description: 'Verified SES sender address  e.g. noreply@example.com',
  },

  // ── Email service ─────────────────────────────────────────────────────────
  {
    key: 'EMAIL_PROVIDER',
    required: false,
    allowed: ['ses', 'smtp', 'console'],
    description: 'Email transport: ses | smtp | console (auto-detected when absent)',
  },
  {
    key: 'EMAIL_FROM',
    required: false,
    description: 'Sender address used in From header  e.g. "App <noreply@example.com>"',
  },
  {
    key: 'APP_NAME',
    required: false,
    default: 'App',
    description: 'Product display name injected into email copy',
  },
  {
    key: 'SMTP_HOST',
    required: false,
    description: 'SMTP hostname  e.g. smtp.resend.com | smtp.sendgrid.net',
  },
  {
    key: 'SMTP_PORT',
    required: false,
    default: '587',
    type: 'number',
    description: 'SMTP port (587 = STARTTLS, 465 = SSL)',
  },
  {
    key: 'SMTP_USER',
    required: false,
    description: 'SMTP username / login',
  },
  {
    key: 'SMTP_PASS',
    required: false,
    description: 'SMTP password or API key',
  },
  {
    key: 'EMAIL_TRACKING_SECRET',
    required: false,
    description: 'Shared secret for the internal /api/email-logs ingest endpoint',
  },

  // ── AWS / S3 ──────────────────────────────────────────────────────────────
  {
    key: 'S3_BUCKET',
    required: false,
    description: 'Default S3 bucket name for file storage',
  },
  {
    key: 'S3_ENDPOINT',
    required: false,
    description: 'Custom S3 endpoint URL — for MinIO / LocalStack  e.g. http://localhost:9000',
  },

  // ── AI / LLM ──────────────────────────────────────────────────────────────
  {
    key: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key (sk-...) — enables /api/ai/openai/* routes',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    required: false,
    description: 'Anthropic API key (sk-ant-...) — enables /api/ai/anthropic/* routes',
  },

  // ── Observability ─────────────────────────────────────────────────────────
  {
    key: 'LOG_LEVEL',
    required: false,
    default: 'info',
    allowed: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
    description: 'Pino log level',
  },
  {
    key: 'SERVICE_NAME',
    required: false,
    default: 'server',
    description: 'Service name injected into every log line',
  },
  {
    key: 'ERROR_TRACKING_DSN',
    required: false,
    description: 'Sentry / error-tracker DSN (optional)',
  },

  // ── Ported from the informational template's schema (contact, modules, …) ──
  // ── Contact form (informational template) ─────────────────────────────────
  {
    key: 'CONTACT_NOTIFY_EMAIL',
    required: false,
    description: 'Recipient of contact-form notifications (defaults to EMAIL_FROM)',
  },
  {
    key: 'CONTACT_RETENTION_DAYS',
    required: false,
    type: 'number',
    description: 'Days to keep contact_submissions before the daily purge (brand.json site.contact.retentionDays wins; default 180)',
  },
  {
    key: 'TURNSTILE_SECRET_KEY',
    required: false,
    description: 'Cloudflare Turnstile secret — enforces anti-spam on POST /api/contact when brand.json site.contact.turnstile.siteKey is also set',
  },
]

/** Documented default for a schema key (undefined when the key has none). */
function defaultOf(key) {
  return SCHEMA.find((spec) => spec.key === key)?.default
}

module.exports = { SCHEMA, defaultOf }
