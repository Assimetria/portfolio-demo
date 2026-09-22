#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  backup-db.sh — PostgreSQL database backup script
#
#  Usage:
#    ./scripts/backup-db.sh [options]
#
#  Options:
#    --env <file>      Path to .env file (default: server/.env)
#    --output <dir>    Backup output directory (default: ./backups)
#    --keep <n>        Number of backups to retain (default: 7)
#    --compress        Compress backup with gzip (default: true)
#    --no-compress     Skip gzip compression
#    --label <name>    Optional label appended to filename (e.g. "pre-migration")
#    --help            Show this help message
#
#  Environment:
#    DATABASE_URL      PostgreSQL connection string (overrides .env)
#
#  Examples:
#    ./scripts/backup-db.sh
#    ./scripts/backup-db.sh --output /var/backups/myapp --keep 30
#    ./scripts/backup-db.sh --label pre-migration
#    DATABASE_URL=postgresql://... ./scripts/backup-db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
ENV_FILE="server/.env"
BACKUP_DIR="./backups"
KEEP=7
COMPRESS=true
LABEL=""

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()   { echo -e "${CYAN}[backup-db]${RESET} $*"; }
ok()    { echo -e "${GREEN}[backup-db]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[backup-db] WARN:${RESET} $*"; }
error() { echo -e "${RED}[backup-db] ERROR:${RESET} $*" >&2; }

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)        ENV_FILE="$2";  shift 2 ;;
    --output)     BACKUP_DIR="$2"; shift 2 ;;
    --keep)       KEEP="$2";      shift 2 ;;
    --compress)   COMPRESS=true;  shift ;;
    --no-compress) COMPRESS=false; shift ;;
    --label)      LABEL="_$2";    shift 2 ;;
    --help)
      sed -n '2,30p' "$0" | sed 's/^#  \?//'
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Load DATABASE_URL from .env if not already set ────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  # Resolve .env relative to this script's parent directory
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT_DIR="$(dirname "$SCRIPT_DIR")"
  ENV_PATH="$ROOT_DIR/$ENV_FILE"

  if [[ -f "$ENV_PATH" ]]; then
    # Extract DATABASE_URL from .env (ignore comments, handle quotes)
    DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_PATH" \
      | head -1 \
      | sed 's/^DATABASE_URL=//' \
      | sed 's/[[:space:]]*#.*//' \
      | tr -d '"'"'" \
      | xargs)
    if [[ -n "$DATABASE_URL" ]]; then
      log "Loaded DATABASE_URL from $ENV_PATH"
    fi
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  error "DATABASE_URL is not set."
  error "Set it in the environment or in $ENV_FILE"
  exit 1
fi

# ── Parse connection string ───────────────────────────────────────────────────
# postgresql://user:password@host:port/dbname[?params]
parse_url() {
  python3 - "$DATABASE_URL" <<'EOF'
import sys, urllib.parse
u = urllib.parse.urlparse(sys.argv[1])
print(u.username or "")
print(u.password or "")
print(u.hostname or "localhost")
print(str(u.port or 5432))
print(u.path.lstrip("/").split("?")[0])
EOF
}

read -r DB_USER DB_PASS DB_HOST DB_PORT DB_NAME <<< "$(parse_url | tr '\n' ' ')"

if [[ -z "$DB_NAME" ]]; then
  error "Could not parse database name from DATABASE_URL"
  exit 1
fi

log "Database : $DB_HOST:$DB_PORT/$DB_NAME (user: $DB_USER)"

# ── Verify pg_dump is available ───────────────────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  error "pg_dump not found. Install PostgreSQL client tools:"
  error "  macOS:  brew install libpq && brew link --force libpq"
  error "  Ubuntu: apt-get install postgresql-client"
  exit 1
fi

# ── Create backup directory ───────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Build filename ────────────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BASENAME="${DB_NAME}_${TIMESTAMP}${LABEL}"
DUMP_FILE="$BACKUP_DIR/${BASENAME}.dump"

# ── Run pg_dump ───────────────────────────────────────────────────────────────
log "Starting backup → $DUMP_FILE"

export PGPASSWORD="$DB_PASS"

pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --no-password \
  --verbose \
  --file="$DUMP_FILE" \
  2>&1 | while IFS= read -r line; do log "  pg_dump: $line"; done

unset PGPASSWORD

if [[ ! -f "$DUMP_FILE" ]]; then
  error "Backup file was not created — pg_dump may have failed"
  exit 1
fi

# ── Compress if requested ─────────────────────────────────────────────────────
FINAL_FILE="$DUMP_FILE"
if [[ "$COMPRESS" == "true" ]]; then
  if command -v gzip &>/dev/null; then
    log "Compressing with gzip..."
    gzip -f "$DUMP_FILE"
    FINAL_FILE="${DUMP_FILE}.gz"
  else
    warn "gzip not found, skipping compression"
  fi
fi

FINAL_SIZE=$(du -sh "$FINAL_FILE" | cut -f1)
ok "Backup complete: $FINAL_FILE ($FINAL_SIZE)"

# ── Rotate old backups ────────────────────────────────────────────────────────
if [[ "$KEEP" -gt 0 ]]; then
  # List backups for this DB, sorted oldest first
  BACKUP_COUNT=$(ls -1t "$BACKUP_DIR/${DB_NAME}_"*.dump* 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$BACKUP_COUNT" -gt "$KEEP" ]]; then
    REMOVE_COUNT=$(( BACKUP_COUNT - KEEP ))
    log "Rotating — removing $REMOVE_COUNT old backup(s) (keeping $KEEP)"
    ls -1t "$BACKUP_DIR/${DB_NAME}_"*.dump* 2>/dev/null \
      | tail -n "$REMOVE_COUNT" \
      | while IFS= read -r old; do
          warn "  Removing: $old"
          rm -f "$old"
        done
  else
    log "Rotation: $BACKUP_COUNT/$KEEP backups stored, nothing to remove"
  fi
fi

echo ""
ok "Done. Restore with:"
echo "   pg_restore --host=$DB_HOST --port=$DB_PORT --username=$DB_USER \\"
if [[ "$FINAL_FILE" == *.gz ]]; then
  echo "     --dbname=<target_db> <(gunzip -c $FINAL_FILE)"
else
  echo "     --dbname=<target_db> $FINAL_FILE"
fi
echo ""
