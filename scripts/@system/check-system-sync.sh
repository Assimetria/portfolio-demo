#!/usr/bin/env bash
# @system — pre-deploy check: verify ALL @system files/dirs match product-template
# Exits non-zero if any @system file or directory has diverged from the template.
# Run this in CI or before deploy to catch regressions from failed syncs.
#
# Usage:
#   ./scripts/@system/check-system-sync.sh [product-dir ...]
#   Exit 0 = all in sync.  Exit 1 = divergence detected.
#
# Note: This check DOES NOT repair divergence. Use:
#   ./scripts/@system/sync-upstream.sh [product-dir ...]
# to sync all @system directories from the template.
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# ALL @system directories that MUST be identical across all products.
# These are synced wholesale by sync-upstream.sh and checked here.
SYSTEM_DIRS=(
  "server/src/api/@system"
  "server/src/config/@system"
  "server/src/db/migrations/@system"
  "server/src/db/repos/@system"
  "server/src/db/schemas/@system"
  "server/src/graphql/@system"
  "server/src/lib/@system"
  "server/src/middleware/@system"
  "server/src/routes/@system"
  "server/src/scheduler/tasks/@system"
  "server/src/workers/@system"
  "server/test/api/@system"
  "server/test/unit/@system"
  "client/src/app/api/@system"
  "client/src/app/assets/images/@system"
  "client/src/app/components/@system"
  "client/src/app/config/@system"
  "client/src/app/content/@system"
  "client/src/app/hooks/@system"
  "client/src/app/hooks/api/@system"
  "client/src/app/lib/@system"
  "client/src/app/pages/app/@system"
  "client/src/app/pages/static/@system"
  "client/src/app/routes/@system"
  "client/src/app/store/@system"
  "client/src/app/styles/@system"
  "client/src/config/@system"
  "scripts/@system"
  "e2e/@system"
)

# Discover product directories (siblings of product-template)
discover_products() {
  local parent
  parent="$(dirname "$TEMPLATE_DIR")"
  for dir in "$parent"/*/; do
    local name
    name="$(basename "$dir")"
    if [[ "$name" != "product-template" && -d "$dir/server/src" ]]; then
      echo "$dir"
    fi
  done
}

if [[ $# -gt 0 ]]; then
  PRODUCTS=("$@")
else
  mapfile -t PRODUCTS < <(discover_products)
fi

if [[ ${#PRODUCTS[@]} -eq 0 ]]; then
  echo "[check-system-sync] No product directories found."
  exit 0
fi

drift=0

for product_dir in "${PRODUCTS[@]}"; do
  product_name="$(basename "$product_dir")"

  for dir_path in "${SYSTEM_DIRS[@]}"; do
    src="$TEMPLATE_DIR/$dir_path"
    dst="$product_dir/$dir_path"

    # Skip if template doesn't have this directory (optional)
    [[ -d "$src" ]] || continue

    # Check if destination exists
    if [[ ! -d "$dst" ]]; then
      echo "MISSING  $product_name/$dir_path"
      drift=$((drift + 1))
      continue
    fi

    # Check if entire directory tree matches
    # Use rsync with --dry-run to compare without modifying
    if ! diff -rq "$src" "$dst" >/dev/null 2>&1; then
      echo "DRIFT    $product_name/$dir_path"
      echo "         Run: ./scripts/@system/sync-upstream.sh to fix"
      drift=$((drift + 1))
    fi
  done
done

if [[ $drift -gt 0 ]]; then
  echo ""
  echo "[check-system-sync] FAIL: $drift @system dir(s) diverged from template."
  echo "Run: ./scripts/@system/sync-upstream.sh $product_dir to fix."
  exit 1
fi

echo "[check-system-sync] OK: all @system directories in sync with template."
exit 0
