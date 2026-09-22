#!/usr/bin/env bash
# generate-brand-assets.sh
#
# Wrapper: generates all brand assets from assets/logo.svg (or assets/logos/logo.svg)
# Brand color from brand.json or .env (BRAND_PRIMARY_COLOR)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Check SVG source exists
if [ ! -f "assets/logo.svg" ] && [ ! -f "assets/logos/logo.svg" ]; then
  echo "ERROR: No logo SVG found. Expected assets/logo.svg or assets/logos/logo.svg"
  exit 1
fi

# Ensure sharp is installed
if ! node -e "require('sharp')" 2>/dev/null; then
  echo "Installing sharp..."
  npm install sharp --save-dev 2>/dev/null
fi

node scripts/generate-brand-assets.js "$@"
