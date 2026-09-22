#!/bin/bash
# Runs the full production-like stack locally via Docker Compose
# (app container built from the root Dockerfile + PostgreSQL + Redis).
# Usage: npm run docker-local
#
# For databases only (run client/server natively with hot reload):
#   docker compose -f docker-compose.local.yml up -d   (or: npm run db-local)

set -e
if docker compose version &>/dev/null; then
    COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE="docker-compose"
else
    echo "Docker Compose v2 not found. Install Docker Desktop (or the docker-compose plugin)."
    exit 1
fi

echo "Building and starting app + db + redis..."
$COMPOSE up --build -d
echo "Stack running: http://localhost:${APP_PORT:-3000}  (health: http://localhost:${APP_PORT:-3000}/api/health)"
echo "Logs: $COMPOSE logs -f app    Stop: $COMPOSE down"
