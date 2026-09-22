#!/bin/bash
# Starts a local PostgreSQL database via Docker for development.
# Idempotent — reuses existing container if running.
# Usage: npm run db-local

set -e
CONTAINER_NAME="pt-postgres-dev"
DB_NAME="${POSTGRES_DB:-product_template_dev}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASS="${POSTGRES_PASSWORD:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✅ PostgreSQL already running (${CONTAINER_NAME})"
else
    echo "Starting PostgreSQL..."
    docker run -d --name "$CONTAINER_NAME" \
        -e POSTGRES_DB="$DB_NAME" \
        -e POSTGRES_USER="$DB_USER" \
        -e POSTGRES_PASSWORD="$DB_PASS" \
        -p "${DB_PORT}:5432" \
        --restart unless-stopped \
        postgres:16-alpine 2>/dev/null || docker start "$CONTAINER_NAME"
    echo "✅ PostgreSQL started on port ${DB_PORT}"
fi
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"
