#!/usr/bin/env bash
# @system — sync ALL @system directories from product-template to all products
#
# Patch-aware merge (#37323): instead of wholesale delete+replace (which reverts
# fixes committed to product repos), this script detects locally-modified files
# and uses three-way merge (git merge-file) to preserve local patches while
# applying template updates.
#
# How it works:
#   1. Find the last "sync with product-template" commit in the product repo
#   2. git diff that commit vs HEAD to find locally-modified @system files
#   3. Unmodified files → overwrite with template (fast path, same as before)
#   4. Modified files → three-way merge (base=file at last sync, local=product, remote=template)
#   5. If no previous sync commit → wholesale replace (first-sync fallback)
#   6. @sync-guard regions are ALWAYS preserved — never overwritten by sync
#
# Protected regions (@sync-guard):
#   Mark code blocks that must never be overwritten by template sync:
#     // @sync-guard:name — description
#     <protected code>
#     // @end-sync-guard
#   Works with // and # comment styles. Guard names: [a-zA-Z0-9_-]+
#
# Usage:
#   ./scripts/@system/sync-upstream.sh [product-dir ...]
#   If no arguments given, syncs to all product directories found in ../
#
# Exit codes:
#   0 = success, all synced
#   1 = no products found or sync failed
set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

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
  echo "[sync-upstream] No product directories found to sync."
  exit 0
fi

# List of all @system directory paths (relative to repo root)
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

# Find the most recent sync commit hash in a product repo
find_last_sync_commit() {
  local product_dir="$1"
  git -C "$product_dir" log --grep="sync with product-template" --format="%H" -1 2>/dev/null || true
}

# Extract @sync-guard regions from a file as a map: guard-name → content
# Writes to $tmpdir/guards/<name> files
extract_sync_guards() {
  local file="$1" tmpdir="$2"
  mkdir -p "$tmpdir/guards"

  if [[ ! -f "$file" ]]; then
    return 0
  fi

  local in_guard=""
  local guard_content=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ -z "$in_guard" ]]; then
      # Check for guard start: // @sync-guard:name or # @sync-guard:name
      if [[ "$line" =~ @sync-guard:([a-zA-Z0-9_-]+) ]]; then
        in_guard="${BASH_REMATCH[1]}"
        guard_content="$line"$'\n'
      fi
    else
      guard_content+="$line"$'\n'
      # Check for guard end: // @end-sync-guard or # @end-sync-guard
      if [[ "$line" =~ @end-sync-guard ]]; then
        printf '%s' "$guard_content" > "$tmpdir/guards/$in_guard"
        in_guard=""
        guard_content=""
      fi
    fi
  done < "$file"
}

# Restore @sync-guard regions from saved guards back into a file
# For each saved guard, replace the matching guard block in the file
restore_sync_guards() {
  local file="$1" tmpdir="$2"

  if [[ ! -d "$tmpdir/guards" ]] || [[ -z "$(ls -A "$tmpdir/guards" 2>/dev/null)" ]]; then
    return 0
  fi

  for guard_file in "$tmpdir/guards"/*; do
    [[ -f "$guard_file" ]] || continue
    local name
    name="$(basename "$guard_file")"
    local saved_content
    saved_content="$(cat "$guard_file")"

    # Build a temp output file, replacing the matching guard block
    local out_file="${file}.sync-guard-tmp"
    local in_guard=""
    local replaced=false

    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ -z "$in_guard" ]]; then
        if [[ "$line" =~ @sync-guard:${name}([^a-zA-Z0-9_-]|$) ]]; then
          in_guard="$name"
          # Write saved content instead
          printf '%s' "$saved_content" >> "$out_file"
          replaced=true
        else
          printf '%s\n' "$line" >> "$out_file"
        fi
      else
        # Skip lines until @end-sync-guard
        if [[ "$line" =~ @end-sync-guard ]]; then
          in_guard=""
        fi
      fi
    done < "$file"

    if [[ "$replaced" == "true" ]]; then
      mv "$out_file" "$file"
      echo "    GUARD    $name (protected region preserved)"
    else
      rm -f "$out_file"
    fi
  done
}

# Three-way merge a single file using git merge-file
# Returns: 0=clean merge, 1=conflict (markers in output), 2+=error
merge_file() {
  local dst_file="$1" base_content_file="$2" src_file="$3" tmpdir="$4"
  local local_copy="$tmpdir/local_copy"
  local merge_out="$tmpdir/merge_out"

  # Save @sync-guard regions from the local file before merge
  extract_sync_guards "$dst_file" "$tmpdir"

  cp "$dst_file" "$local_copy"

  # git merge-file -p: output to stdout; exit 0=clean, 1+=conflicts, <0=error
  local exit_code=0
  git merge-file -p "$local_copy" "$base_content_file" "$src_file" > "$merge_out" 2>/dev/null || exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    # Clean merge — local patches + template updates combined
    cp "$merge_out" "$dst_file"
    # Restore any @sync-guard regions that the merge may have overwritten
    restore_sync_guards "$dst_file" "$tmpdir"
    return 0
  elif [[ $exit_code -gt 0 && $exit_code -lt 128 ]]; then
    # Conflicts — write merged output with conflict markers for review
    cp "$merge_out" "$dst_file"
    # Restore any @sync-guard regions that the merge may have overwritten
    restore_sync_guards "$dst_file" "$tmpdir"
    return 1
  else
    # Error — don't touch the file
    return 2
  fi
}

# Sync a single @system directory using patch-aware merge
sync_dir_patched() {
  local src="$1" dst="$2" product_dir="$3" dir_path="$4" last_sync="$5"
  local stat_merged=0 stat_kept=0 stat_conflicts=0 stat_copied=0

  # Get list of locally-modified files since last sync
  local modified_list
  modified_list="$(mktemp)"
  git -C "$product_dir" diff --name-only "$last_sync" HEAD -- "$dir_path" > "$modified_list" 2>/dev/null || true

  local tmpdir
  tmpdir="$(mktemp -d)"

  # Phase 1: Process files from template
  while IFS= read -r src_file; do
    [[ -z "$src_file" ]] && continue
    local rel="${src_file#"$src"/}"
    local dst_file="$dst/$rel"
    local repo_rel="$dir_path/$rel"

    # Check if this file was locally modified since last sync
    if grep -qFx "$repo_rel" "$modified_list" 2>/dev/null; then
      if [[ -f "$dst_file" ]]; then
        # Extract the baseline version (what the file looked like at last sync)
        local base_file="$tmpdir/base"
        if git -C "$product_dir" show "$last_sync:$repo_rel" > "$base_file" 2>/dev/null && [[ -s "$base_file" ]]; then
          # Attempt three-way merge
          local merge_rc=0
          merge_file "$dst_file" "$base_file" "$src_file" "$tmpdir" || merge_rc=$?

          if [[ $merge_rc -eq 0 ]]; then
            echo "    MERGE    $rel (local patches preserved)"
            stat_merged=$((stat_merged + 1))
          elif [[ $merge_rc -eq 1 ]]; then
            echo "    CONFLICT $rel (conflict markers — review needed)"
            stat_conflicts=$((stat_conflicts + 1))
          else
            echo "    KEEP     $rel (merge error, local version kept)"
            stat_kept=$((stat_kept + 1))
          fi
        else
          # No baseline available (file didn't exist at last sync) — keep local
          echo "    KEEP     $rel (no baseline, local version kept)"
          stat_kept=$((stat_kept + 1))
        fi
      else
        # File was in modified list but doesn't exist locally (locally deleted)
        # Don't re-add — respect the local deletion
        echo "    SKIP     $rel (locally deleted)"
      fi
    else
      # Not locally modified — overwrite with template (fast path)
      mkdir -p "$(dirname "$dst_file")"
      # Preserve @sync-guard regions from the existing file before overwriting
      if [[ -f "$dst_file" ]]; then
        local guard_tmpdir
        guard_tmpdir="$(mktemp -d)"
        extract_sync_guards "$dst_file" "$guard_tmpdir"
        cp "$src_file" "$dst_file"
        restore_sync_guards "$dst_file" "$guard_tmpdir"
        rm -rf "$guard_tmpdir"
      else
        cp "$src_file" "$dst_file"
      fi
      stat_copied=$((stat_copied + 1))
    fi
  done < <(find "$src" -type f 2>/dev/null | sort)

  # Phase 2: Clean up files in product that no longer exist in template
  if [[ -d "$dst" ]]; then
    while IFS= read -r dst_file; do
      [[ -z "$dst_file" ]] && continue
      local rel="${dst_file#"$dst"/}"
      local repo_rel="$dir_path/$rel"

      if [[ ! -f "$src/$rel" ]]; then
        # File removed from template
        if grep -qFx "$repo_rel" "$modified_list" 2>/dev/null; then
          echo "    KEEP     $rel (locally modified, removed from template)"
          stat_kept=$((stat_kept + 1))
        else
          rm -f "$dst_file"
        fi
      fi
    done < <(find "$dst" -type f 2>/dev/null | sort)
  fi

  # Clean up temp files
  rm -rf "$tmpdir" "$modified_list"

  # Report if any non-trivial operations occurred
  if [[ $stat_merged -gt 0 || $stat_kept -gt 0 || $stat_conflicts -gt 0 ]]; then
    echo "    [copied:$stat_copied merged:$stat_merged kept:$stat_kept conflicts:$stat_conflicts]"
  fi

  return 0
}

# Wholesale replace — fallback for first sync or non-git products
sync_dir_wholesale() {
  local src="$1" dst="$2"
  if [[ -d "$dst" ]]; then
    rm -rf "$dst"
  fi
  mkdir -p "$(dirname "$dst")"
  cp -r "$src" "$dst"
}

synced=0
errors=0

for product_dir in "${PRODUCTS[@]}"; do
  product_name="$(basename "$product_dir")"
  echo "--- Syncing to $product_name ---"

  # Determine sync strategy based on git history
  last_sync=""
  if git -C "$product_dir" rev-parse --git-dir &>/dev/null; then
    last_sync="$(find_last_sync_commit "$product_dir")"
  fi

  if [[ -n "$last_sync" ]]; then
    echo "  Strategy: patch-aware merge (baseline: ${last_sync:0:8})"
  else
    echo "  Strategy: wholesale replace (no previous sync commit)"
  fi

  for dir_path in "${SYSTEM_DIRS[@]}"; do
    src="$TEMPLATE_DIR/$dir_path"
    dst="$product_dir/$dir_path"

    # Skip if template doesn't have this directory
    if [[ ! -d "$src" ]]; then
      continue
    fi

    # Create parent directory if needed
    mkdir -p "$(dirname "$dst")"

    if [[ -n "$last_sync" ]]; then
      # Patch-aware merge — preserves local fixes
      if sync_dir_patched "$src" "$dst" "$product_dir" "$dir_path" "$last_sync"; then
        echo "  SYNC $dir_path"
        synced=$((synced + 1))
      else
        echo "  ERROR $dir_path (sync failed)"
        errors=$((errors + 1))
      fi
    else
      # Wholesale replace — first sync or non-git product
      if sync_dir_wholesale "$src" "$dst"; then
        echo "  SYNC $dir_path"
        synced=$((synced + 1))
      else
        echo "  ERROR $dir_path (failed to copy)"
        errors=$((errors + 1))
      fi
    fi
  done
  echo ""
done

# Phase 3: Remove duplicate barrel files (.js when .jsx exists)
# Webpack resolve.extensions is [.jsx, .js] — when both exist, .jsx wins,
# making index.js dead code. Prevents regression from #34757 / #40075.
for product_dir in "${PRODUCTS[@]}"; do
  while IFS= read -r jsx_file; do
    js_file="${jsx_file%.jsx}.js"
    if [[ -f "$js_file" ]]; then
      echo "  DEDUP  ${js_file#"$product_dir"/} (index.jsx exists, removing dead index.js)"
      rm -f "$js_file"
    fi
  done < <(find "$product_dir/client" -path '*/node_modules' -prune -o -name 'index.jsx' -print 2>/dev/null)
done

# Phase 4: Strip inline cookie consent banners from HTML files (#41915)
# The React CookieConsentBanner component is the single source of truth.
# Template merges may re-introduce the inline #cc-banner — this guard removes it.
for product_dir in "${PRODUCTS[@]}"; do
  for html_file in "$product_dir/client/index.html" "$product_dir/landing.html"; do
    if [[ -f "$html_file" ]] && grep -q 'id="cc-banner"' "$html_file" 2>/dev/null; then
      # Remove inline #cc-banner style block, div, and cookie-consent.js script tag
      sed -i.bak -E '
        /<!-- Cookie Consent Banner/,/<\/script>/d
        /id="cc-banner"/d
        /#cc-banner/d
        /cookie-consent\.js/d
      ' "$html_file"
      rm -f "${html_file}.bak"
      local_path="${html_file#"$product_dir"/}"
      echo "  GUARD  $(basename "$product_dir")/$local_path — stripped inline #cc-banner (React component is sole consent UI)"
    fi
  done
done

if [[ $errors -gt 0 ]]; then
  echo "[sync-upstream] DONE: $synced synced, $errors errors."
  exit 1
fi

echo "[sync-upstream] OK: $synced @system dir(s) synced (patch-aware)."
exit 0
