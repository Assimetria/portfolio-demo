#!/usr/bin/env bash
# @system — post-deploy health check script
# Polls $DEPLOY_URL/api/ready (HTTP 200 only when the database answers) until it
# returns {status:'ok'} or max retries exceeded. With REQUIRE_DB=false it polls
# the liveness endpoint /api/health instead and accepts status=degraded.
# Optionally records the live URL in Assimetria OS if ASSIMETRIA_OS_URL and
# PRODUCT_SLUG are set.
#
# Usage:
#   DEPLOY_URL=https://acme.orkosi.app ./deploy-healthcheck.sh
#   ./deploy-healthcheck.sh https://acme.orkosi.app
#
# Env:
#   DEPLOY_URL        — deployed app base URL (APP_URL and legacy RAILWAY_URL accepted as fallbacks)
#   MAX_RETRIES       — default 10
#   RETRY_INTERVAL    — seconds between attempts, default 10
#   REQUIRE_DB        — "false" to accept status=degraded (db unreachable) as success; default "true"
#
# Exit codes:
#   0 — health check passed
#   1 — health check failed (timeout or non-ok status)

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
DEPLOY_URL="${DEPLOY_URL:-${APP_URL:-${RAILWAY_URL:-${1:-}}}}"
MAX_RETRIES="${MAX_RETRIES:-10}"
RETRY_INTERVAL="${RETRY_INTERVAL:-10}"
REQUIRE_DB="${REQUIRE_DB:-true}"

# ── Validate input ───────────────────────────────────────────────────────────
if [[ -z "$DEPLOY_URL" ]]; then
  echo "[healthcheck] ERROR: DEPLOY_URL is not set. Pass it as an env var or first argument." >&2
  exit 1
fi

# Strip trailing slash for consistent URL construction
DEPLOY_URL="${DEPLOY_URL%/}"
if [[ "$REQUIRE_DB" == "false" ]]; then
  HEALTH_URL="${DEPLOY_URL}/api/health"   # liveness: 200 even when degraded
else
  HEALTH_URL="${DEPLOY_URL}/api/ready"    # readiness: 503 until the DB answers
fi

# ── Poll health endpoint ─────────────────────────────────────────────────────
echo "[healthcheck] Polling ${HEALTH_URL} (max ${MAX_RETRIES} attempts, ${RETRY_INTERVAL}s interval)..."

attempt=0
success=false

while [[ $attempt -lt $MAX_RETRIES ]]; do
  attempt=$((attempt + 1))
  echo "[healthcheck] Attempt ${attempt}/${MAX_RETRIES}..."

  # Fetch with a 10s connect+read timeout; suppress progress output
  response=$(curl --silent --max-time 10 --write-out "\n%{http_code}" "${HEALTH_URL}" 2>/dev/null || true)

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" == "200" ]]; then
    status_field=$(echo "$body" | jq -r '.status' 2>/dev/null || echo "")
    if [[ "$status_field" == "ok" ]]; then
      echo "[healthcheck] Health check passed (status=ok)."
      success=true
      break
    elif [[ "$status_field" == "degraded" && "$REQUIRE_DB" == "false" ]]; then
      echo "[healthcheck] Health check passed (status=degraded accepted, REQUIRE_DB=false)."
      success=true
      break
    else
      echo "[healthcheck] HTTP 200 but status='${status_field}' — not ready yet. body: ${body}"
    fi
  else
    echo "[healthcheck] HTTP ${http_code} — server not ready yet."
  fi

  if [[ $attempt -lt $MAX_RETRIES ]]; then
    echo "[healthcheck] Waiting ${RETRY_INTERVAL}s before next attempt..."
    sleep "$RETRY_INTERVAL"
  fi
done

# ── Handle failure ───────────────────────────────────────────────────────────
if [[ "$success" != "true" ]]; then
  echo "[healthcheck] FAILED: service did not become healthy after ${MAX_RETRIES} attempts." >&2
  echo "[healthcheck] Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >&2
  exit 1
fi

# ── Optional: record the live URL in Assimetria OS ───────────────────────────
ASSIMETRIA_OS_URL="${ASSIMETRIA_OS_URL:-}"
PRODUCT_SLUG="${PRODUCT_SLUG:-}"

if [[ -n "$ASSIMETRIA_OS_URL" && -n "$PRODUCT_SLUG" ]]; then
  echo "[healthcheck] Recording live URL in Assimetria OS for product '${PRODUCT_SLUG}'..."

  patch_url="${ASSIMETRIA_OS_URL%/}/api/products/${PRODUCT_SLUG}"
  # products.railway_url is the historical column name for "live product URL"
  patch_body="{\"railway_url\": \"${DEPLOY_URL}\"}"

  patch_code=$(curl --silent --max-time 15 \
    --request PATCH \
    --header "Content-Type: application/json" \
    --data "$patch_body" \
    --write-out "%{http_code}" \
    --output /dev/null \
    "$patch_url" 2>/dev/null || echo "000")

  if [[ "$patch_code" =~ ^2 ]]; then
    echo "[healthcheck] Assimetria OS updated (HTTP ${patch_code})."
  else
    # Non-fatal: log a warning but do not fail the deploy
    echo "[healthcheck] WARNING: Assimetria OS PATCH returned HTTP ${patch_code}. Live URL may be stale." >&2
  fi
fi

# ── Success ──────────────────────────────────────────────────────────────────
echo "[healthcheck] Deployment verified. Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
exit 0
