#!/usr/bin/env bash
# check-system-sync.sh — CI guard that verifies @system dirs and generated barrels are in sync.
# Usage:
#   ./scripts/@system/ci/check-system-sync.sh <TEMPLATE_DIR_OR_REPO_URL>
#
# TEMPLATE_DIR_OR_REPO_URL  Local path or GitHub URL (https://github.com/org/repo.git)
#
# Exit codes:
#   0 — everything is in sync
#   1 — drift detected (details printed to stdout)

set -euo pipefail

# ── Colours (disabled when stdout is not a tty) ─────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

# ── Helpers ──────────────────────────────────────────────────────────────────
info()  { printf "${CYAN}[info]${RESET}  %s\n" "$*"; }
ok()    { printf "${GREEN}[ok]${RESET}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${RESET}  %s\n" "$*"; }
error() { printf "${RED}[error]${RESET} %s\n" "$*" >&2; }
die()   { error "$@"; exit 1; }

# ── Parse arguments ──────────────────────────────────────────────────────────
SOURCE=""
for arg in "$@"; do
  case "$arg" in
    -*) die "Unknown flag: $arg" ;;
    *)  SOURCE="$arg" ;;
  esac
done

[[ -n "$SOURCE" ]] || die "Usage: $0 <TEMPLATE_DIR_OR_REPO_URL>"

# ── Resolve product repo root ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRODUCT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
[[ -d "$PRODUCT_DIR/.git" ]] || die "Cannot locate product repo root (expected .git at $PRODUCT_DIR)"

# ── Resolve template directory ──────────────────────────────────────────────
CLEANUP_TEMP=false

if [[ "$SOURCE" =~ ^https?:// ]] || [[ "$SOURCE" == git@* ]] || [[ "$SOURCE" == *.git ]]; then
  # Clone to a temporary directory
  TEMP_DIR="$(mktemp -d)"
  CLEANUP_TEMP=true
  trap 'rm -rf "$TEMP_DIR"' EXIT

  info "Shallow-cloning $SOURCE → $TEMP_DIR"
  git clone --depth 1 --single-branch "$SOURCE" "$TEMP_DIR" 2>&1 | sed 's/^/  /'
  TEMPLATE_DIR="$TEMP_DIR"
else
  [[ -d "$SOURCE" ]] || die "Template directory does not exist: $SOURCE"
  TEMPLATE_DIR="$(cd "$SOURCE" && pwd)"
fi

# ── Validations ──────────────────────────────────────────────────────────────
command -v rsync >/dev/null 2>&1 || die "rsync is required but not found in PATH"
command -v node  >/dev/null 2>&1 || die "node is required but not found in PATH"

info "Template : $TEMPLATE_DIR"
info "Product  : $PRODUCT_DIR"
echo ""

DRIFT=false

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 1: rsync dry-run for each @system directory
# ═══════════════════════════════════════════════════════════════════════════
printf "${BOLD}── @system directory sync check ──${RESET}\n\n"

mapfile -t SYSTEM_DIRS < <(
  cd "$TEMPLATE_DIR" && \
  find . -type d -name '@system' ! -path './.git/*' | sort | sed 's|^\./||'
)

if [[ ${#SYSTEM_DIRS[@]} -eq 0 ]]; then
  warn "No @system directories found in template"
else
  for rel in "${SYSTEM_DIRS[@]}"; do
    SRC="$TEMPLATE_DIR/$rel/"
    DST="$PRODUCT_DIR/$rel/"

    # Skip if parent doesn't exist in product
    PARENT="$(dirname "$rel")"
    if [[ ! -d "$PRODUCT_DIR/$PARENT" ]]; then
      continue
    fi

    # Skip if destination doesn't exist yet (new dirs are added manually)
    if [[ ! -d "$DST" ]]; then
      continue
    fi

    OUTPUT=$(rsync -a --delete --checksum --itemize-changes --dry-run "$SRC" "$DST" 2>&1) || true

    if [[ -z "$OUTPUT" ]]; then
      printf "  ${GREEN}✓${RESET} %s\n" "$rel"
    else
      DRIFT=true
      printf "  ${RED}✗${RESET} %s\n" "$rel"
      while IFS= read -r line; do
        case "$line" in
          '>f+++'*)     printf "    ${GREEN}+ %s${RESET}\n" "${line#>f+++++++++ }" ;;
          '*deleting'*) printf "    ${RED}- %s${RESET}\n" "${line#\*deleting   }" ;;
          '>'*|'<'*|'c'*)
                        printf "    ${YELLOW}~ %s${RESET}\n" "$line" ;;
          *)            printf "    %s\n" "$line" ;;
        esac
      done <<< "$OUTPUT"
    fi
  done
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# CHECK 2: generated barrels are up to date
# ═══════════════════════════════════════════════════════════════════════════
printf "${BOLD}── Generated barrels check ──${RESET}\n\n"

BARRELS_SCRIPT="$PRODUCT_DIR/scripts/@system/generate-barrels.js"
if [[ ! -f "$BARRELS_SCRIPT" ]]; then
  warn "generate-barrels.js not found — skipping barrel check"
else
  BARRELS_OUTPUT=$(node "$BARRELS_SCRIPT" --check 2>&1) || {
    DRIFT=true
  }
  echo "$BARRELS_OUTPUT" | sed 's/^/  /'
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════
echo "────────────────────────────────────────────────"
if $DRIFT; then
  error "Drift detected — @system files are out of sync."
  echo ""
  info "To fix, run:"
  echo "  ./scripts/@system/sync-upstream.sh <TEMPLATE_DIR>"
  echo "  node scripts/@system/generate-barrels.js"
  echo ""
  exit 1
else
  ok "All @system files are in sync."
  exit 0
fi
