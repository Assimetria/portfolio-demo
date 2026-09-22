#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — container entrypoint (runs under tini as PID 1's child)
#
# 1. Verify the built client exists (fail fast, clear message)
# 2. Derive VERSION / CSRF_SECRET / JWT keys when not provided
# 3. Inject runtime placeholders into client/dist/index.html (APP_URL,
#    Plausible domain, Sentry DSN, brand identity)
# 4. Run DB migrations once, then tell the server not to run them again
#    (SKIP_STARTUP_MIGRATIONS=1). Unreachable DB → degraded boot; reachable DB
#    with a failed migration → fatal unless ALLOW_MIGRATION_FAILURE=1.
# 5. exec node — the server replaces this shell so signals reach it directly
#
# App Runner sets PORT=3000 and the runtime env (DATABASE_URL, APP_URL, …).
# ─────────────────────────────────────────────────────────────────────────────
set -eu

log() { echo "[start] $*"; }

APP_ROOT="${APP_ROOT:-/app}"
export PORT="${PORT:-3000}"
export SPA_HTML_DIR="${SPA_HTML_DIR:-${APP_ROOT}/client/dist}"
INDEX_HTML="${SPA_HTML_DIR}/index.html"
BRAND_JSON="${APP_ROOT}/brand.json"

# ── 1. Built client must exist ───────────────────────────────────────────────
if [ ! -f "$INDEX_HTML" ]; then
    echo "[start] FATAL: ${INDEX_HTML} not found — the image has no built client." >&2
    echo "[start]        The Dockerfile 'builder' stage must produce client/dist (npm run build)." >&2
    echo "[start]        Running outside Docker? Run 'npm run build' first or set SPA_HTML_DIR." >&2
    exit 1
fi

# ── 2a. VERSION for /api/health ──────────────────────────────────────────────
if [ -z "${VERSION:-}" ] && [ -f "${APP_ROOT}/VERSION" ]; then
    VERSION=$(cat "${APP_ROOT}/VERSION")
    export VERSION
    log "VERSION=${VERSION}"
fi

# ── 2b. CSRF secret (ephemeral when not configured) ──────────────────────────
if [ -z "${CSRF_SECRET:-}" ]; then
    CSRF_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    export CSRF_SECRET
    log "CSRF_SECRET not set — generated an ephemeral secret (rotates on restart)."
fi

# ── 2c. RS256 JWT keys (ephemeral when not configured) ───────────────────────
if [ -z "${JWT_PRIVATE_KEY:-}" ] && [ -z "${JWT_PRIVATE_KEY_FILE:-}" ]; then
    log "JWT keys not set — generating an ephemeral RSA-2048 pair (sessions reset on restart)."
    node -e "
const crypto = require('crypto'), fs = require('fs');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
fs.writeFileSync('/tmp/jwt-private.pem', privateKey, { mode: 0o600 });
fs.writeFileSync('/tmp/jwt-public.pem', publicKey);
"
    export JWT_PRIVATE_KEY_FILE=/tmp/jwt-private.pem
    export JWT_PUBLIC_KEY_FILE=/tmp/jwt-public.pem
fi

# ── 3a. APP_URL — honour the custom-domain gate from brand.json ──────────────
brand_field() {
    # brand_field <primaryKey> [<fallbackKey>] → prints the value or nothing
    [ -f "$BRAND_JSON" ] || return 0
    node -e "
const b = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
const v = b[process.argv[2]] ?? (process.argv[3] ? b[process.argv[3]] : undefined);
if (v !== undefined && v !== null) process.stdout.write(String(v));
" "$BRAND_JSON" "$@" 2>/dev/null || true
}

if [ -n "${APP_URL:-}" ]; then
    _cdc=$(brand_field customDomainConfigured custom_domain_configured)
    if [ "$_cdc" = "false" ]; then
        log "brand.json customDomainConfigured=false — APP_URL cleared until the domain is live."
        unset APP_URL
    fi
fi

# Placeholder replacement helper (index.html is owned by nodeapp)
inject() { sed -i "s|$1|$2|g" "$INDEX_HTML"; }

if [ -n "${APP_URL:-}" ]; then
    log "Injecting APP_URL=${APP_URL}"
    inject "__APP_URL__" "${APP_URL}"
fi

# ── 3b. Plausible analytics domain ───────────────────────────────────────────
PLAUSIBLE_DOMAIN="${PLAUSIBLE_DOMAIN:-}"
if [ -z "$PLAUSIBLE_DOMAIN" ]; then
    _cdc=$(brand_field customDomainConfigured custom_domain_configured)
    _domain=$(brand_field domain)
    if [ "$_cdc" = "true" ] && [ -n "$_domain" ]; then
        PLAUSIBLE_DOMAIN="$_domain"
    elif [ -n "${APP_URL:-}" ]; then
        PLAUSIBLE_DOMAIN=$(echo "$APP_URL" | sed 's|https\?://||;s|/.*||')
    fi
fi
if [ -n "$PLAUSIBLE_DOMAIN" ]; then
    log "Analytics: Plausible domain ${PLAUSIBLE_DOMAIN}"
    inject "__PLAUSIBLE_DOMAIN__" "${PLAUSIBLE_DOMAIN}"
else
    log "Analytics: PLAUSIBLE_DOMAIN not set — client-side analytics disabled."
    sed -i 's|<script[^>]*data-domain="__PLAUSIBLE_DOMAIN__"[^>]*></script>||g' "$INDEX_HTML"
fi

# ── 3c. Sentry DSN ───────────────────────────────────────────────────────────
SENTRY_DSN_VALUE="${SENTRY_DSN:-${ERROR_TRACKING_DSN:-}}"
if [ -n "$SENTRY_DSN_VALUE" ]; then
    log "Error tracking: Sentry DSN injected."
    inject "__SENTRY_DSN__" "${SENTRY_DSN_VALUE}"
else
    log "Error tracking: SENTRY_DSN not set — client-side error tracking disabled."
    sed -i 's|<meta name="sentry-dsn"[^>]*>||g' "$INDEX_HTML"
fi

# ── 3d. Brand identity — brand.json may change after the image was built ─────
if [ -f "$BRAND_JSON" ]; then
    BRAND_NAME=$(brand_field companyName name)
    BRAND_TAGLINE=$(brand_field tagline)
    BRAND_COLOR=$(brand_field primaryColor brand_color)
    BRAND_ACCENT=$(brand_field accentColor accent_color)
    if [ -n "$BRAND_NAME" ]; then
        log "Brand: ${BRAND_NAME}"
        inject "__BRAND_NAME__" "${BRAND_NAME}"
        inject "__BRAND_TAGLINE__" "${BRAND_TAGLINE}"
        inject "__BRAND_COLOR__" "${BRAND_COLOR}"
        inject "__BRAND_ACCENT__" "${BRAND_ACCENT}"
        # Titles/meta baked with an empty or template name
        inject "<title> - </title>" "<title>${BRAND_NAME} - ${BRAND_TAGLINE}</title>"
        inject "<title>Product Template - </title>" "<title>${BRAND_NAME} - ${BRAND_TAGLINE}</title>"
        inject "content=\" - \"" "content=\"${BRAND_NAME} - ${BRAND_TAGLINE}\""
        if [ "$BRAND_NAME" != "Product Template" ]; then
            inject "content=\"Product Template" "content=\"${BRAND_NAME}"
            inject "ProductTemplate" "${BRAND_NAME}"
        fi
    fi
fi

# ── 3e. Sanity: lazy chunks present? ─────────────────────────────────────────
CHUNK_COUNT=$(ls "${SPA_HTML_DIR}"/js/*.chunk.js 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHUNK_COUNT" -gt 0 ]; then
    log "Client bundle OK: ${CHUNK_COUNT} lazy chunks."
else
    log "Client bundle: no lazy chunks (pages bundled into main.js)."
fi

# ── 4. Database migrations — exactly once, here ──────────────────────────────
# Two distinct failure modes, handled differently on purpose:
#   a) database unreachable  → migrations are not attempted; the server boots
#      degraded (health: db=disconnected) and /api/health keeps probing. This
#      is App Runner's first minutes while RDS is still provisioning, and what
#      scripts/ci/docker-smoke.sh exercises.
#   b) database reachable but a migration FAILED → the schema is not what the
#      code expects (e.g. contact_submissions missing). Serving traffic would
#      fail silently on every form submit, so this is FATAL. Set
#      ALLOW_MIGRATION_FAILURE=1 only as a deliberate, temporary operator
#      override while fixing the schema by hand (docs/RUNBOOK.md section 2).
db_reachable() {
    # Exit 0 when a trivial query succeeds within 15 s; the pool's own connect
    # timeout is shorter, this is only a backstop for a black-holed host.
    node -e "
const db = require(process.argv[1]);
const done = (code) => { try { db.pgp.end(); } catch (_) {} process.exit(code); };
setTimeout(() => { console.error('[start] db probe: timed out after 15s'); done(1); }, 15000).unref();
db.one('SELECT 1 AS ok')
  .then(() => done(0))
  .catch((e) => { console.error('[start] db probe: ' + e.message); done(1); });
" "${APP_ROOT}/server/src/lib/@system/PostgreSQL"
}

if [ -n "${DATABASE_URL:-}" ] || [ -n "${PGHOST:-}" ]; then
    if db_reachable; then
        log "Database reachable — running pre-migration checks..."
        if node "${APP_ROOT}/server/src/db/migrations/@system/precheck.js"; then
            log "Pre-migration checks passed."
        else
            log "WARNING: pre-migration checks failed — continuing to migrations."
        fi
        log "Running DB migrations..."
        if node "${APP_ROOT}/server/src/db/migrations/@system/run.js"; then
            log "Migrations complete."
        elif [ "${ALLOW_MIGRATION_FAILURE:-0}" = "1" ]; then
            log "WARNING: migrations FAILED but ALLOW_MIGRATION_FAILURE=1 — starting anyway. Fix the schema and unset the override."
        else
            echo "[start] FATAL: database migrations failed (database was reachable)." >&2
            echo "[start]        The schema does not match this build; refusing to serve traffic." >&2
            echo "[start]        Inspect the migration output above, fix it (docs/RUNBOOK.md section 2)," >&2
            echo "[start]        or set ALLOW_MIGRATION_FAILURE=1 to boot degraded on purpose." >&2
            exit 1
        fi
    else
        log "WARNING: database unreachable — migrations not attempted; server will start degraded (health: db=disconnected)."
    fi
else
    log "No DATABASE_URL/PGHOST — skipping migrations; server will start degraded (health: db=disconnected)."
fi
# The server's own startup migration step must not run a second time.
export SKIP_STARTUP_MIGRATIONS=1

# ── 5. Start Express ─────────────────────────────────────────────────────────
log "Starting Express on port ${PORT} (NODE_ENV=${NODE_ENV:-production})..."
exec node "${APP_ROOT}/server/src/index.js"
