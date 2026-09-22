#!/usr/bin/env bash
# scripts/ci/docker-smoke.sh — boot the production image with NO reachable
# database and verify it comes up degraded but healthy enough for App Runner:
#
#   GET /api/health  → HTTP 200, body.status == "degraded", body.db == "disconnected"
#   GET /api/ready   → HTTP 503, body.ready == false   (readiness must NOT lie)
#   GET /            → HTTP 200, SPA index.html with the brand <title>
#   GET /favicon.svg → 200; unknown SPA route → 404 (branded shell)
#
# DATABASE_URL points at 127.0.0.1:1 (nothing listens there) so the connection
# is refused instantly. This mirrors App Runner's first minutes when RDS or its
# credentials are not reachable yet. The variable is set rather than omitted
# because server/src/lib/@custom/Env requires DATABASE_URL and APP_URL in
# production by design (#276526) and Orkosi provisioning always sets both.
#
# Used by .github/workflows/ci.yml (docker-smoke job) and buildspec-ci.yml.
# Locally:  docker build -t pt . && bash scripts/ci/docker-smoke.sh pt
#
# Usage: docker-smoke.sh <image> [host-port]
set -euo pipefail

IMAGE="${1:?usage: docker-smoke.sh <image> [host-port]}"
HOST_PORT="${2:-3777}"
NAME="pt-smoke-$$"
TIMEOUT_S="${SMOKE_TIMEOUT:-90}"
UNREACHABLE_DB="${SMOKE_DATABASE_URL:-postgresql://smoke:smoke@127.0.0.1:1/smoke_unreachable}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "::error::$*"
  echo "--- container logs ---"
  docker logs "$NAME" 2>&1 | tail -80 || true
  exit 1
}

echo "[smoke] starting $IMAGE on :$HOST_PORT (NODE_ENV=production, unreachable DATABASE_URL)"
docker run -d --name "$NAME" \
  -p "127.0.0.1:${HOST_PORT}:3000" \
  -e NODE_ENV=production \
  -e APP_URL="http://localhost:${HOST_PORT}" \
  -e DATABASE_URL="$UNREACHABLE_DB" \
  "$IMAGE" >/dev/null

BASE="http://127.0.0.1:${HOST_PORT}"
deadline=$(( $(date +%s) + TIMEOUT_S ))
code=000
while [ "$(date +%s)" -lt "$deadline" ]; do
  if ! docker ps -q --no-trunc --filter "name=^/${NAME}$" | grep -q .; then
    fail "container exited before becoming healthy"
  fi
  code=$(curl -s -o /tmp/smoke-health.json -w '%{http_code}' "$BASE/api/health" || echo 000)
  [ "$code" = "200" ] && break
  sleep 2
done

[ "$code" = "200" ] || fail "/api/health did not return 200 within ${TIMEOUT_S}s (last: $code)"

body=$(cat /tmp/smoke-health.json)
echo "[smoke] /api/health → $body"

status=$(printf '%s' "$body" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
db=$(printf '%s' "$body" | sed -n 's/.*"db":"\([^"]*\)".*/\1/p')
[ "$db" = "disconnected" ] || fail "expected db=disconnected without a reachable database, got db=$db"
[ "$status" = "degraded" ] || fail "expected status=degraded without a reachable database, got status=$status"

# Readiness must report the truth: no database → 503 (this is what the deploy
# workflow verifies after a rollout, so a lying /api/ready would hide outages).
ready_code=$(curl -s -o /tmp/smoke-ready.json -w '%{http_code}' "$BASE/api/ready" || echo 000)
[ "$ready_code" = "503" ] || fail "expected /api/ready → 503 without a reachable database, got $ready_code"
ready_flag=$(sed -n 's/.*"ready":\([a-z]*\).*/\1/p' /tmp/smoke-ready.json)
[ "$ready_flag" = "false" ] || fail "expected /api/ready body.ready=false, got '$ready_flag'"
echo "[smoke] /api/ready → 503 (ready=false) as expected without a database"

# SPA is served by Express from client/dist
html_code=$(curl -s -o /tmp/smoke-index.html -w '%{http_code}' "$BASE/")
[ "$html_code" = "200" ] || fail "GET / returned $html_code (expected 200)"
grep -q '<div id="root"' /tmp/smoke-index.html || fail "GET / did not return the SPA shell (no #root)"
title=$(sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' /tmp/smoke-index.html | head -1)
[ -n "$title" ] || fail "GET / has no <title>"
grep -q '__PLAUSIBLE_DOMAIN__\|__SENTRY_DSN__\|__BRAND_NAME__' /tmp/smoke-index.html \
  && fail "GET / still contains unreplaced start.sh placeholders"
echo "[smoke] GET / → 200, <title>$title</title>"

# Static asset + unknown route (404 status, still serves the branded SPA shell)
asset_code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/favicon.svg")
[ "$asset_code" = "200" ] || fail "GET /favicon.svg returned $asset_code"
nf_code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/this-route-does-not-exist-xyz")
[ "$nf_code" = "404" ] || fail "unknown SPA route returned $nf_code (expected 404 with SPA shell)"

echo "[smoke] OK — image boots degraded without a reachable database and serves the SPA"
