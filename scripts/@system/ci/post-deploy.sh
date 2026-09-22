#!/usr/bin/env bash
# @system — CI/CD post-deploy wrapper
# Runs deploy-healthcheck.sh and logs the final result.
# Call from GitHub Actions, CodeBuild or any pipeline right after a deployment.
#
# Required env vars (or pass DEPLOY_URL as first arg):
#   DEPLOY_URL           — deployed app base URL, e.g. https://acme.orkosi.app
#
# Optional env vars (passed through to deploy-healthcheck.sh):
#   ASSIMETRIA_OS_URL    — base URL of the Assimetria OS API
#   PRODUCT_SLUG         — product slug used to record the live URL in the OS DB
#   REQUIRE_DB           — "false" to accept a degraded (db unreachable) service

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="${DEPLOY_URL:-${APP_URL:-${1:-<unknown>}}}"

echo "[post-deploy] Starting post-deploy validation..."
echo "[post-deploy] Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Run the health check script; capture its exit code without triggering set -e
"${SCRIPT_DIR}/deploy-healthcheck.sh" "${1:-}"
healthcheck_exit=$?

if [[ $healthcheck_exit -eq 0 ]]; then
  echo ""
  echo "[post-deploy] Deployment verified successfully."
  echo "[post-deploy]   URL: ${URL}"
  exit 0
else
  echo "" >&2
  echo "[post-deploy] Deployment verification FAILED." >&2
  echo "[post-deploy]   URL: ${URL}" >&2
  echo "[post-deploy]   Investigate: ${URL}/api/ready (503 = database unreachable) and ${URL}/api/health" >&2
  echo "[post-deploy]   App Runner logs: AWS console → App Runner → service → Logs (application)" >&2
  echo "[post-deploy]   Check DATABASE_URL / APP_URL and the other runtime environment variables." >&2
  exit 1
fi
