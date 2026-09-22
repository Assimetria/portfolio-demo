# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
#  Product Template — single production image (AWS App Runner, port 3000)
#
#  Stage client-deps  install client build dependencies (cached by lockfile)
#  Stage builder      prebuild (brand.json → CSS/JS tokens, route barrels) + Webpack
#  Stage production   Express serves /api and the built SPA from client/dist
#
#  Build:  docker build -t product-template \
#            --build-arg BUILD_SHA=$(git rev-parse HEAD) \
#            --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) .
#  Run:    docker run --rm -p 3000:3000 -e NODE_ENV=production -e APP_URL=http://localhost:3000 \
#            -e DATABASE_URL=postgresql://... product-template
#  Smoke:  bash scripts/ci/docker-smoke.sh product-template
# ─────────────────────────────────────────────────────────────────────────────

# Node major. The single source of truth is the root .nvmrc (read by
# .github/workflows/ci.yml via setup-node `node-version-file`). Docker cannot
# read a file into an ARG default, so this value MUST equal .nvmrc — CI can pin
# it explicitly with `--build-arg NODE_VERSION=$(cat .nvmrc)`.
ARG NODE_VERSION=22

# ── Stage 1: client build dependencies ───────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS client-deps
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# ── Stage 2: build the client ────────────────────────────────────────────────
FROM client-deps AS builder
WORKDIR /app
# brand.json + assets/ drive prebuild (design tokens) and webpack (JSON-LD, asset copy)
COPY brand.json ./
COPY assets/ ./assets/
COPY scripts/ ./scripts/
COPY client/ ./client/
ENV NODE_ENV=production
# Chromium drives the build-time SEO prerender (client/scripts/prerender.mjs,
# --dump-dom engine, no npm dependency); without it the image ships the
# generated fallback markup only. See docs/INFORMATIONAL-SPEC.md §9.
RUN apk add --no-cache chromium
ENV PRERENDER_CHROMIUM=/usr/bin/chromium-browser
RUN node scripts/prebuild.js \
 && npm run build --prefix client

# ── Stage 3: production runtime ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS production

# tini: PID 1 that forwards signals and reaps zombies
RUN apk add --no-cache tini \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    SPA_HTML_DIR=/app/client/dist

# Server production dependencies (own layer — only invalidated by the lockfile)
COPY --chown=nodeapp:nodejs server/package.json server/package-lock.json ./server/
RUN cd server \
 && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

# Server source + the one helper script index.js may invoke
COPY --chown=nodeapp:nodejs server/src/ ./server/src/
COPY --chown=nodeapp:nodejs server/scripts/drop-schema-migrations.js ./server/scripts/

# Shared product config read by server/src/config/@system/info.js, brand + version
# (template-manifest.json feeds /api/health "template": which template + version this app runs)
COPY --chown=nodeapp:nodejs .config/ ./.config/
COPY --chown=nodeapp:nodejs brand.json VERSION template-manifest.json ./

# Route manifest lets spaFallback return 404 for unknown paths
COPY --chown=nodeapp:nodejs client/src/app/routes/@system/manifest.json ./route-manifest.json

# Built SPA (index.html, js/, css/, favicons, logos, og images, robots, sitemap, cookie-consent)
COPY --chown=nodeapp:nodejs --from=builder /app/client/dist ./client/dist

COPY --chown=nodeapp:nodejs --chmod=755 start.sh /start.sh

# ── Build metadata — declared LAST on purpose ────────────────────────────────
# BUILD_SHA / BUILD_DATE change on every build. BuildKit invalidates the cache
# from an ARG's first USE onward, so declaring them here means only the LABEL,
# the VERSION stamp and ENV below are rebuilt per commit — never `apk add` or
# the server `npm ci` layer above. NODE_VERSION without a value re-imports the
# global ARG (declared before the first FROM) into this stage.
ARG NODE_VERSION
ARG BUILD_SHA=local
ARG BUILD_DATE=""
LABEL org.opencontainers.image.title="product-template-shopify" \
      org.opencontainers.image.description="Assimetria Shopify-like store template — Express API + React storefront/admin in one container" \
      org.opencontainers.image.vendor="Assimetria" \
      org.opencontainers.image.source="https://github.com/Assimetria/product-template-shopify" \
      org.opencontainers.image.revision="${BUILD_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.base.name="docker.io/library/node:${NODE_VERSION}-alpine"

# Stamp the exact build into /api/health "version" (e.g. 2.0.0+abcdef12) and
# expose the full SHA at runtime (health fallback, Sentry release in ErrorTracking).
RUN if [ "$BUILD_SHA" != "local" ]; then \
      echo "$(cat /app/VERSION)+$(echo "$BUILD_SHA" | cut -c1-8)" > /app/VERSION; \
    fi
ENV GIT_SHA=${BUILD_SHA}

USER nodeapp

EXPOSE 3000

# Docker-level readiness (docker compose `service_healthy`, `docker ps` status).
# App Runner ignores HEALTHCHECK and uses its own service config — keep THAT on
# /api/health (liveness) so a DB blip never rolls a deployment back; see
# docs/DEPLOYMENT.md "Health and verification".
# Shell form on purpose: $PORT is expanded at run time, so a platform that
# overrides PORT is probed on the right port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/ready" >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/start.sh"]
