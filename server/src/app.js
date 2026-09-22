// @system — Express application (middleware pipeline + route mounting)
// Order matters: security headers → health → request id → CORS → parsers →
// CSRF → logging → static/SEO → /api (cache-control, rate limit, db, routes)
// → SPA fallback → 404 → Sentry → final JSON error handler.
// index.js owns the HTTP server/lifecycle; this module only builds `app`.

const express = require('express')
const path = require('path')
const compression = require('compression')
const cookieParser = require('cookie-parser')
const pinoHttp = require('pino-http')
const morgan = require('morgan')

const logger = require('./lib/@system/Logger')
const ErrorTracking = require('./lib/@system/ErrorTracking')
const { cors, csrf, securityHeaders, attachDatabase } = require('./lib/@system/Middleware')
const requestId = require('./lib/@system/Middleware/requestId')
const { createErrorHandler } = require('./lib/@system/Middleware/errorHandler')
const { apiLimiter } = require('./lib/@system/RateLimit')
const systemRoutes = require('./routes/@system')
const customRoutes = require('./routes/@custom')
const { mergeRoutes } = require('./routes/@system/mergeRoutes')
const spaFallback = require('./lib/@system/spaFallback')
const { staticOptions } = require('./lib/@system/staticCache')

const IS_PROD = process.env.NODE_ENV === 'production'

const app = express()

// Trust first proxy hop (App Runner / CloudFront edge) so req.ip, req.protocol, and
// req.secure reflect the real client connection instead of the local proxy.
// Without this, all requests appear as HTTP from 127.0.0.1 — breaking rate
// limiting, secure cookie detection, and __Host- CSRF cookie behaviour (#31871).
app.set('trust proxy', 1)

// Explicitly disable X-Powered-By at the Express level.
// helmet's hidePoweredBy option removes it via middleware but Express may still
// emit the header on responses that bypass middleware (e.g. static file serving,
// Railway proxy edge cases). app.disable() strips it unconditionally.
app.disable('x-powered-by')

// Security headers applied first so every response — including health checks —
// carries the required headers (X-Frame-Options, HSTS, X-Content-Type-Options, etc.)
app.use(securityHeaders)

// Health endpoints registered before CORS so that infrastructure
// load-balancer probes with no Origin header bypass CORS, and before the
// /api rate limiter + route merge so nothing under @custom can shadow them.
//   /health,  /api/health  liveness  — always 200, state in the body
//   /ready,   /api/ready   readiness — 503 while the database is unreachable
//   /healthz               shallow Kubernetes/GKE convention endpoint
const healthRouter = require('./api/@system/health')
app.use('/', healthRouter)    // GET /health, /ready
app.use('/api', healthRouter) // GET /api/health, /api/ready
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }))

// Request id — reuse the edge's X-Request-Id or mint one; echoed on every
// response and included in logs + error JSON.
app.use(requestId)
app.use(cors)
app.use(compression())
app.use(express.json({
  limit: '10mb',
  // Preserve the raw body buffer for Stripe/payment webhook signature verification.
  // express.json() parses the body into a JS object, but stripe.webhooks.constructEvent()
  // requires the original raw Buffer. Without this, webhook routes that mount express.raw()
  // at the route level receive an already-parsed object — breaking signature checks (#41235).
  verify: (req, _res, buf) => {
    if (req.originalUrl.endsWith('/webhook')) {
      req.rawBody = buf
    }
  },
}))
app.use(cookieParser())
app.use(csrf)

if (IS_PROD) {
  // Structured JSON HTTP request logging (ingested by log aggregator).
  // genReqId reuses the id from the requestId middleware so access logs and
  // error logs share the same correlation id.
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }))
} else if (process.env.NODE_ENV !== 'test') {
  // Human-readable HTTP request logging for development
  app.use(morgan('dev'))
}

// Dynamic sitemap + robots — use the request host so URLs always match the domain
// crawlers actually see (not the APP_URL env var, which may point to a parked domain).
// Registered before express.static so the dynamic routes win over static files. (#36939)
const sitemapRouter = require('./api/@system/sitemap')
const robotsRouter = require('./api/@system/robots')
app.use(sitemapRouter)
app.use(robotsRouter)

// Static SEO files — served before API routes so crawlers get correct content types.
// In production the built client (client/dist) carries its own robots.txt /
// sitemap.xml and is served below; in dev (no SPA_HTML_DIR) this middleware
// serves the fallbacks from server/src/public/ instead of hitting the catch-all.
app.use(express.static(path.join(__dirname, 'public'), { index: false }))

// In production Express is the only web server: serve built client assets from client/dist/.
// SPA_HTML_DIR is set by the Dockerfile/start.sh to /app/client/dist.
// index: false — spaFallback handles index.html with per-route SEO injection.
// Cache-Control comes from lib/@system/staticCache: content-hashed js/css/assets
// are immutable for a year, HTML is never cached, unhashed files get 1 h.
if (IS_PROD && process.env.SPA_HTML_DIR) {
  app.use(express.static(process.env.SPA_HTML_DIR, staticOptions(process.env.SPA_HTML_DIR)))
}

// Cache-Control for API responses — private data must not be stored in shared
// caches (CloudFront / App Runner sit in front of this process).  (#32859)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache')
  next()
})

// General rate limiting for all API routes (baseline DoS protection)
app.use('/api', apiLimiter)

// Attach database repositories to req.db for routes that need them
app.use('/api', attachDatabase)

// Routes — @custom mounted first via mergeRoutes() so custom handlers win on path collision
app.use('/api', mergeRoutes(systemRoutes, customRoutes))

// SPA fallback — serves index.html with per-route SEO meta tags injected (#35132).
// Every non-API, non-asset request ends here. This middleware
// reads the built index.html, injects route-specific title/description/og:* meta,
// and serves it so crawlers see unique metadata per route.
// Skips /api, /health, and static file requests (they fall through to 404).
app.use(spaFallback)

// 404 catch-all — API routes and static files that weren't matched above.
// Returning JSON (not HTML) ensures SEO files (/robots.txt, /sitemap.xml) are
// never served as the index.html shell (#29203, #30762).
app.use((req, res) => {
  res.status(404).json({ message: 'Not found', requestId: req.id })
})

// Sentry error handler — captures exceptions before the response is sent
app.use(ErrorTracking.errorHandler())

// Final error handler — see Middleware/errorHandler.js. Logs full detail,
// returns { message, code?, requestId }; 5xx bodies are generic in production.
app.use(createErrorHandler({ logger, isProd: IS_PROD }))

module.exports = app
