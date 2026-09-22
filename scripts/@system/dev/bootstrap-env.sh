#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# @system/dev/bootstrap-env.sh
#
# Creates .env files for the server and client by copying their respective
# .env.example files (if .env does not already exist).
#
# Usage:
#   bash scripts/@system/dev/bootstrap-env.sh [--force]
#
# Options:
#   --force   Overwrite existing .env files (use with caution).
#
# After this script runs you should generate cryptographic keys:
#   npm run generate-keys
#
# Or run both steps together:
#   npm run bootstrap
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

copy_env() {
  local example_path="$1"
  local target_path="$2"
  local label="$3"

  if [ ! -f "$example_path" ]; then
    echo "[bootstrap-env] WARNING: $example_path not found — skipping $label"
    return
  fi

  if [ -f "$target_path" ] && [ "$FORCE" = false ]; then
    echo "[bootstrap-env] $target_path already exists — skipping (use --force to overwrite)"
    return
  fi

  cp "$example_path" "$target_path"
  echo "[bootstrap-env] Created $target_path"
}

# ── Main ─────────────────────────────────────────────────────────────────────

echo ""
echo "Bootstrap .env files"
echo "──────────────────────────────────────────────"

copy_env \
  "$PROJECT_ROOT/server/.env.example" \
  "$PROJECT_ROOT/server/.env" \
  "server"

copy_env \
  "$PROJECT_ROOT/client/.env.example" \
  "$PROJECT_ROOT/client/.env" \
  "client"

echo ""
echo "✓  Env files ready."
echo ""
echo "Next step: fill in the required values in server/.env and client/.env"
echo "Then run:  npm run generate-keys   (generates RSA + encryption keys)"
