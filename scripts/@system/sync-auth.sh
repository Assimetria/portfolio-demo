#!/usr/bin/env bash
# @system — sync canonical auth/sessions/csrf files from product-template to all products
# Usage: ./scripts/@system/sync-auth.sh [product-dir ...]
#   If no arguments given, syncs to all product directories found in ../
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Canonical @system files that must be identical across all products
AUTH_FILES=(
  "server/src/lib/@system/Helpers/auth.js"
  "server/src/lib/@system/Helpers/cookies.js"
  "server/src/lib/@system/Middleware/csrf.js"
  "server/src/api/@system/sessions/index.js"
  "server/src/api/@system/auth/index.js"
  "server/src/api/@system/health/index.js"
  "server/src/middleware/@system/auth.js"
)

# Discover product directories (siblings of product-template)
discover_products() {
  local parent
  parent="$(dirname "$TEMPLATE_DIR")"
  for dir in "$parent"/*/; do
    local name
    name="$(basename "$dir")"
    # Skip product-template itself
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
  echo "No product directories found to sync."
  exit 0
fi

synced=0
errors=0

for product_dir in "${PRODUCTS[@]}"; do
  product_name="$(basename "$product_dir")"
  echo "--- Syncing to $product_name ---"

  for file in "${AUTH_FILES[@]}"; do
    src="$TEMPLATE_DIR/$file"
    dst="$product_dir/$file"

    if [[ ! -f "$src" ]]; then
      echo "  SKIP $file (not in template)"
      continue
    fi

    # Create target directory if needed
    mkdir -p "$(dirname "$dst")"

    if [[ -f "$dst" ]] && diff -q "$src" "$dst" >/dev/null 2>&1; then
      echo "  OK   $file (already in sync)"
    else
      cp "$src" "$dst"
      echo "  SYNC $file"
      synced=$((synced + 1))
    fi
  done
  echo ""
done

echo "Done. Synced $synced file(s). Errors: $errors."
