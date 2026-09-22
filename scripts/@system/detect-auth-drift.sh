#!/usr/bin/env bash
# @system — detect drift in canonical auth/sessions files across products
# Usage: ./scripts/@system/detect-auth-drift.sh [product-dir ...]
# Exit code 0 = no drift, 1 = drift detected
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

AUTH_FILES=(
  "server/src/lib/@system/Helpers/auth.js"
  "server/src/lib/@system/Helpers/cookies.js"
  "server/src/api/@system/sessions/index.js"
  "server/src/api/@system/auth/index.js"
  "server/src/middleware/@system/auth.js"
)

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
  echo "No product directories found to check."
  exit 0
fi

drifted=0

for product_dir in "${PRODUCTS[@]}"; do
  product_name="$(basename "$product_dir")"

  for file in "${AUTH_FILES[@]}"; do
    src="$TEMPLATE_DIR/$file"
    dst="$product_dir/$file"

    if [[ ! -f "$src" ]]; then
      continue
    fi

    if [[ ! -f "$dst" ]]; then
      echo "MISSING  $product_name: $file"
      drifted=$((drifted + 1))
    elif ! diff -q "$src" "$dst" >/dev/null 2>&1; then
      echo "DRIFTED  $product_name: $file"
      diff --unified=3 "$src" "$dst" | head -30
      echo "..."
      echo ""
      drifted=$((drifted + 1))
    fi
  done
done

if [[ $drifted -eq 0 ]]; then
  echo "All products in sync with template auth files."
  exit 0
else
  echo ""
  echo "$drifted file(s) drifted from template."
  exit 1
fi
