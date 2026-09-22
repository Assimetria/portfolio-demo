#!/bin/bash
# Creates @custom directories alongside every @system directory.
# Safe to run repeatedly — skips existing dirs.
# Usage: npm run set-customs (or bash scripts/@system/dev/set-customs.sh)

find . -path ./node_modules -prune -o -type d -name "@system" -print | while read -r system_dir; do
    custom_dir="$(dirname "$system_dir")/@custom"
    if [ ! -d "$custom_dir" ]; then
        mkdir -p "$custom_dir"
        echo "Created: $custom_dir"
    fi
done
echo "✅ Custom folders verified."
