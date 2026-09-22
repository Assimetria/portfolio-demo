#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  restore-db.sh — restore a PostgreSQL dump produced by scripts/backup-db.sh
#
#  Usage:
#    ./scripts/restore-db.sh --input <file.dump|file.dump.gz> --confirm <dbname> [options]
#
#  Options:
#    --input <file>      Dump to restore (pg_dump custom format, optionally gzipped)  [required]
#    --confirm <dbname>  Name of the TARGET database, typed out. Must equal the
#                        database in DATABASE_URL or the restore refuses to run.   [required]
#    --env <file>        Path to .env file to read DATABASE_URL from (default: server/.env)
#    --no-pre-backup     Skip the automatic safety backup of the target taken before restoring
#    --backup-output <dir>  Where the safety backup goes (default: ./backups)
#    --data-only         Restore data only (keep the current schema)
#    --jobs <n>          Parallel restore workers (uncompressed dumps only; default 1)
#    --help              Show this help message
#
#  Environment:
#    DATABASE_URL        Target connection string (overrides .env)
#
#  Behaviour:
#    * Refuses to run without --confirm <dbname>; the name must match the target.
#    * Takes a safety backup of the target first (scripts/backup-db.sh --label pre-restore).
#    * pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error,
#      so the target ends up as the dump, owned by the connecting role.
#    * Prints the follow-up: `cd server && npm run migrate:status`.
#
#  Examples:
#    ./scripts/restore-db.sh --input backups/myapp_20260920_101500.dump.gz --confirm myapp
#    DATABASE_URL=postgresql://... ./scripts/restore-db.sh --input x.dump --confirm proddb --no-pre-backup
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
ENV_FILE="server/.env"
INPUT=""
CONFIRM=""
PRE_BACKUP=true
BACKUP_DIR="./backups"
DATA_ONLY=false
JOBS=1

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()   { echo -e "${CYAN}[restore-db]${RESET} $*"; }
ok()    { echo -e "${GREEN}[restore-db]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[restore-db] WARN:${RESET} $*"; }
error() { echo -e "${RED}[restore-db] ERROR:${RESET} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)          INPUT="$2";       shift 2 ;;
    --confirm)        CONFIRM="$2";     shift 2 ;;
    --env)            ENV_FILE="$2";    shift 2 ;;
    --no-pre-backup)  PRE_BACKUP=false; shift ;;
    --backup-output)  BACKUP_DIR="$2";  shift 2 ;;
    --data-only)      DATA_ONLY=true;   shift ;;
    --jobs)           JOBS="$2";        shift 2 ;;
    --help)
      sed -n '2,36p' "$0" | sed 's/^#  \?//'
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Guards on arguments ───────────────────────────────────────────────────────
if [[ -z "$INPUT" ]]; then
  error "--input <file> is required"
  exit 1
fi
if [[ ! -f "$INPUT" ]]; then
  error "Dump file not found: $INPUT"
  exit 1
fi
if [[ -z "$CONFIRM" ]]; then
  error "Refusing to restore without --confirm <dbname>."
  error "This command DROPS and recreates every object in the target database."
  exit 1
fi

# ── Load DATABASE_URL from .env if not already set (same rules as backup-db.sh)
if [[ -z "${DATABASE_URL:-}" ]]; then
  ENV_PATH="$ROOT_DIR/$ENV_FILE"
  if [[ -f "$ENV_PATH" ]]; then
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

if [[ "$CONFIRM" != "$DB_NAME" ]]; then
  error "--confirm '$CONFIRM' does not match the target database '$DB_NAME' ($DB_HOST:$DB_PORT)."
  error "Re-run with --confirm $DB_NAME if that is really the database you want to overwrite."
  exit 1
fi

# ── Tooling ───────────────────────────────────────────────────────────────────
if ! command -v pg_restore &>/dev/null; then
  error "pg_restore not found. Install PostgreSQL client tools:"
  error "  macOS:  brew install libpq && brew link --force libpq"
  error "  Ubuntu: apt-get install postgresql-client"
  exit 1
fi

IS_GZ=false
if [[ "$INPUT" == *.gz ]]; then
  IS_GZ=true
  command -v gunzip &>/dev/null || { error "gunzip not found but input is gzipped"; exit 1; }
  if [[ "$JOBS" -gt 1 ]]; then
    warn "--jobs > 1 needs a seekable file; gzipped input is streamed, falling back to --jobs 1"
    JOBS=1
  fi
fi

log "Target  : $DB_HOST:$DB_PORT/$DB_NAME (user: $DB_USER)"
log "Source  : $INPUT"
log "Mode    : $([[ "$DATA_ONLY" == true ]] && echo 'data only' || echo 'schema + data (--clean --if-exists)')"

# ── Safety backup of the target ───────────────────────────────────────────────
if [[ "$PRE_BACKUP" == true ]]; then
  log "Taking a safety backup of the target before restoring (label pre-restore)..."
  DATABASE_URL="$DATABASE_URL" bash "$SCRIPT_DIR/backup-db.sh" --output "$BACKUP_DIR" --label pre-restore --keep 0
else
  warn "Skipping the safety backup (--no-pre-backup)"
fi

# ── Restore ───────────────────────────────────────────────────────────────────
export PGPASSWORD="$DB_PASS"

RESTORE_ARGS=(
  --host="$DB_HOST"
  --port="$DB_PORT"
  --username="$DB_USER"
  --dbname="$DB_NAME"
  --no-password
  --no-owner
  --no-privileges
  --exit-on-error
  --verbose
)
if [[ "$DATA_ONLY" == true ]]; then
  RESTORE_ARGS+=(--data-only)
else
  RESTORE_ARGS+=(--clean --if-exists)
fi
if [[ "$JOBS" -gt 1 ]]; then
  RESTORE_ARGS+=(--jobs="$JOBS")
fi

log "Restoring..."
if [[ "$IS_GZ" == true ]]; then
  gunzip -c "$INPUT" | pg_restore "${RESTORE_ARGS[@]}" 2>&1 | while IFS= read -r line; do log "  pg_restore: $line"; done
  RC=${PIPESTATUS[1]}
else
  pg_restore "${RESTORE_ARGS[@]}" "$INPUT" 2>&1 | while IFS= read -r line; do log "  pg_restore: $line"; done
  RC=${PIPESTATUS[0]}
fi

unset PGPASSWORD

if [[ "$RC" -ne 0 ]]; then
  error "pg_restore exited with status $RC — the target may be partially restored."
  if [[ "$PRE_BACKUP" == true ]]; then
    error "The pre-restore safety backup is in $BACKUP_DIR (label pre-restore)."
  fi
  exit "$RC"
fi

ok "Restore complete: $DB_HOST:$DB_PORT/$DB_NAME from $INPUT"
echo ""
ok "Next: confirm the schema matches the deployed code"
echo "   cd server && DATABASE_URL='<target>' npm run migrate:status"
echo ""
