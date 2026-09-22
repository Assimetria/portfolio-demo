// @system — client-side environment variable validation
// Called once at app startup (main.jsx). Logs warnings for missing vars
// and throws in production to prevent silent misconfiguration.
//
// Usage:
//   import { validateEnv, env } from '@/app/lib/@system/env'
//   validateEnv()                       // call once at startup
//   const apiUrl = env('VITE_API_URL')  // typed accessor with fallback


const SCHEMA = [
  {
    key: 'VITE_APP_URL',
    required: false,
    default: 'http://localhost:5173',
    description: 'Public URL of this frontend app' },
  {
    key: 'VITE_APP_VERSION',
    required: false,
    default: '0.0.0',
    description: 'App version injected into error reports' },
  {
    key: 'VITE_API_URL',
    required: false,
    description: 'Backend API base URL (empty = use Vite proxy in dev)' },
  {
    key: 'VITE_ERROR_TRACKING_DSN',
    required: false,
    description: 'Sentry / error tracker DSN' },

  // ── Stripe ──────────────────────────────────────────────────────────────────
  {
    key: 'VITE_STRIPE_PUBLISHABLE_KEY',
    required: false,
    description: 'Stripe publishable key (pk_test_... or pk_live_...) — safe to expose in browser' },
]

// ── Validation ────────────────────────────────────────────────────────────────

export function validateEnv(){
  const isProd = import.meta.env.PROD
  const missing = []

  for (const spec of SCHEMA) {
    const value = import.meta.env[spec.key]

    if (spec.required && (value === undefined || value === '')) {
      missing.push(`  ✗  ${spec.key} — ${spec.description}`)
    }
  }

  if (missing.length === 0) return

  const message = [
    '[Env] Missing required environment variables:',
    ...missing,
    'Copy client/.env.example → client/.env and fill in the required values.',
  ].join('\n')

  if (isProd) {
    throw new Error(message)
  } else {
    console.warn(message)
  }
}

// ── Accessor ─────────────────────────────────────────────────────────────────

export function env(key, fallback){
  const value = import.meta.env[key]
  if (value !== undefined && value !== '') return value
  if (fallback !== undefined) return fallback
  throw new Error(
    `[Env] import.meta.env.${key} is not set. Add it to client/.env and client/.env.example.`
  )
}
