// @system — OpenAPI / Swagger documentation
// GET /api/docs      — Swagger UI (HTML)
// GET /api/docs.json — OpenAPI 3.0 spec
const express = require('express')
const router = express.Router()

const PRODUCT_NAME = process.env.PRODUCT_NAME || 'SaaS API'
const API_VERSION = process.env.API_VERSION || '1.0.0'

function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: `${PRODUCT_NAME} API`,
      version: API_VERSION,
      description: `REST API documentation for ${PRODUCT_NAME}. Authenticate with Bearer token (JWT or session) or API key via X-API-Key header.`,
    },
    servers: [
      { url: '/api', description: 'Current server' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token or opaque session token',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key (sk_* prefix)',
        },
        RapidApiAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-RapidAPI-Proxy-Secret',
          description: 'RapidAPI marketplace proxy secret',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['user', 'admin'] },
            emailVerified: { type: 'boolean' },
            onboardingCompleted: { type: 'boolean' },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            key_prefix: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            request_count: { type: 'integer' },
            rate_limit: { type: 'integer', nullable: true },
            last_used_at: { type: 'string', format: 'date-time', nullable: true },
            expires_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            plan: { type: 'string' },
            status: { type: 'string', enum: ['active', 'canceled', 'past_due', 'trialing'] },
            current_period_end: { type: 'string', format: 'date-time' },
          },
        },
        Team: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
          },
        },
        BlogPost: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            slug: { type: 'string' },
            content: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published'] },
            published_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            url: { type: 'string', format: 'uri' },
            events: { type: 'array', items: { type: 'string' } },
            active: { type: 'boolean' },
            secret: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    paths: {
      '/ping': {
        get: {
          tags: ['Health'],
          summary: 'Ping',
          security: [],
          responses: { 200: { description: 'Pong', content: { 'application/json': { schema: { type: 'object', properties: { pong: { type: 'boolean' } } } } } } },
        },
      },
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          security: [],
          responses: { 200: { description: 'Server health status' } },
        },
      },
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new account',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, name: { type: 'string' } } } } },
          },
          responses: {
            201: { description: 'Account created', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
            409: { description: 'Email already exists' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login with email and password',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' }, totpCode: { type: 'string' }, rememberMe: { type: 'boolean', description: 'Extend session to 30 days' } } } } },
          },
          responses: {
            200: { description: 'Login successful' },
            401: { description: 'Invalid credentials' },
            429: { description: 'Account locked' },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user',
          responses: {
            200: { description: 'Current user', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
          },
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Request password reset',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } },
          },
          responses: { 200: { description: 'Reset email sent (if account exists)' } },
        },
      },
      '/auth/reset-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Reset password with token',
          security: [],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } } } } },
          },
          responses: { 200: { description: 'Password reset successful' } },
        },
      },
      '/oauth/{provider}': {
        post: {
          tags: ['Authentication'],
          summary: 'OAuth login/register (Google or GitHub)',
          security: [],
          parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google', 'github'] } }],
          responses: { 200: { description: 'OAuth successful' } },
        },
      },
      '/api-keys': {
        get: {
          tags: ['API Keys'],
          summary: 'List your API keys',
          responses: { 200: { description: 'List of API keys', content: { 'application/json': { schema: { type: 'object', properties: { apiKeys: { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } } } } } } } },
        },
        post: {
          tags: ['API Keys'],
          summary: 'Create a new API key',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, scopes: { type: 'array', items: { type: 'string' }, description: 'Permission scopes (default: ["*"])' }, rateLimit: { type: 'integer', description: 'Requests per minute limit' } } } } },
          },
          responses: { 201: { description: 'API key created (raw key shown once)' } },
        },
      },
      '/api-keys/{id}': {
        delete: {
          tags: ['API Keys'],
          summary: 'Revoke an API key',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Key revoked' } },
        },
      },
      '/api-keys/{id}/usage': {
        get: {
          tags: ['API Keys'],
          summary: 'Get usage stats for an API key',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
            { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
          ],
          responses: { 200: { description: 'Usage statistics' } },
        },
      },
      '/api-keys/scopes': {
        get: {
          tags: ['API Keys'],
          summary: 'List available API key scopes',
          responses: { 200: { description: 'Available scopes' } },
        },
      },
      '/subscriptions': {
        get: {
          tags: ['Billing'],
          summary: 'Get current subscription',
          responses: { 200: { description: 'Subscription details' } },
        },
      },
      '/subscriptions/cancel': {
        post: {
          tags: ['Billing'],
          summary: 'Cancel subscription',
          responses: { 200: { description: 'Subscription canceled at period end' } },
        },
      },
      '/stripe/checkout': {
        post: {
          tags: ['Billing'],
          summary: 'Create Stripe checkout session',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { priceId: { type: 'string' }, successUrl: { type: 'string' }, cancelUrl: { type: 'string' } } } } } },
          responses: { 200: { description: 'Checkout session URL' } },
        },
      },
      '/stripe/portal': {
        post: {
          tags: ['Billing'],
          summary: 'Create Stripe billing portal session',
          responses: { 200: { description: 'Portal URL' } },
        },
      },
      '/teams': {
        get: {
          tags: ['Teams'],
          summary: 'List your teams',
          responses: { 200: { description: 'List of teams' } },
        },
        post: {
          tags: ['Teams'],
          summary: 'Create a team',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } } } } } },
          responses: { 201: { description: 'Team created' } },
        },
      },
      '/teams/{teamId}/members': {
        get: { tags: ['Teams'], summary: 'List team members', parameters: [{ name: 'teamId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Team members' } } },
      },
      '/teams/{teamId}/invitations': {
        post: { tags: ['Teams'], summary: 'Invite a member by email', parameters: [{ name: 'teamId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 201: { description: 'Invitation sent' } } },
      },
      '/blog/posts': {
        get: {
          tags: ['Blog'],
          summary: 'List published blog posts',
          security: [],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          ],
          responses: { 200: { description: 'Blog posts' } },
        },
        post: {
          tags: ['Blog'],
          summary: 'Create a blog post',
          responses: { 201: { description: 'Post created' } },
        },
      },
      '/storage/presigned-url': {
        post: {
          tags: ['Storage'],
          summary: 'Get presigned upload URL',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['fileName', 'contentType'], properties: { fileName: { type: 'string' }, contentType: { type: 'string' }, folder: { type: 'string' } } } } } },
          responses: { 200: { description: 'Presigned URL for upload' } },
        },
      },
      '/webhooks': {
        get: {
          tags: ['Webhooks'],
          summary: 'List your webhook endpoints',
          responses: { 200: { description: 'Webhook endpoints' } },
        },
        post: {
          tags: ['Webhooks'],
          summary: 'Register a webhook endpoint',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['url', 'events'], properties: { url: { type: 'string', format: 'uri' }, events: { type: 'array', items: { type: 'string' } }, description: { type: 'string' } } } } } },
          responses: { 201: { description: 'Webhook registered' } },
        },
      },
      '/webhooks/{id}': {
        patch: { tags: ['Webhooks'], summary: 'Update a webhook', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Webhook updated' } } },
        delete: { tags: ['Webhooks'], summary: 'Delete a webhook', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Webhook deleted' } } },
      },
      '/webhooks/events': {
        get: {
          tags: ['Webhooks'],
          summary: 'List available webhook event types',
          responses: { 200: { description: 'Available events' } },
        },
      },
      '/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'List your notifications',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
            { name: 'unread', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          ],
          responses: { 200: { description: 'Notifications and unread count' } },
        },
      },
      '/notifications/unread-count': {
        get: {
          tags: ['Notifications'],
          summary: 'Get unread notification count',
          responses: { 200: { description: 'Unread count' } },
        },
      },
      '/notifications/{id}/read': {
        post: {
          tags: ['Notifications'],
          summary: 'Mark notification as read',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Notification marked as read' } },
        },
      },
      '/notifications/read-all': {
        post: {
          tags: ['Notifications'],
          summary: 'Mark all notifications as read',
          responses: { 200: { description: 'All marked as read' } },
        },
      },
      '/activity': {
        get: {
          tags: ['Activity'],
          summary: 'List your activity log',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
            { name: 'resource_type', in: 'query', schema: { type: 'string' } },
            { name: 'action', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Activity events and total count' } },
        },
        post: {
          tags: ['Activity'],
          summary: 'Log a custom activity event',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['action', 'resource_type'], properties: { action: { type: 'string' }, resource_type: { type: 'string' }, resource_id: { type: 'string' }, metadata: { type: 'object' } } } } } },
          responses: { 201: { description: 'Event logged' } },
        },
      },
      '/stripe/report-usage': {
        post: {
          tags: ['Billing'],
          summary: 'Report metered usage for current billing period',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['quantity'], properties: { quantity: { type: 'integer', minimum: 1 }, action: { type: 'string', enum: ['increment', 'set'], default: 'increment' } } } } } },
          responses: { 200: { description: 'Usage reported' } },
        },
      },
      '/stripe/usage-summary': {
        get: {
          tags: ['Billing'],
          summary: 'Get usage summary for current billing period',
          responses: { 200: { description: 'Usage summary' } },
        },
      },
      '/stripe/create-metered-checkout': {
        post: {
          tags: ['Billing'],
          summary: 'Create checkout session for usage-based pricing',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['priceId'], properties: { priceId: { type: 'string' }, trialDays: { type: 'integer' } } } } } },
          responses: { 200: { description: 'Checkout session URL' } },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Server health and availability' },
      { name: 'Authentication', description: 'Login, register, OAuth, password reset' },
      { name: 'API Keys', description: 'API key management with scoped permissions' },
      { name: 'Billing', description: 'Stripe subscriptions, billing, and usage-based metering' },
      { name: 'Teams', description: 'Team management and collaboration' },
      { name: 'Blog', description: 'Blog/CMS management' },
      { name: 'Storage', description: 'File upload and storage' },
      { name: 'Webhooks', description: 'Webhook endpoint management' },
      { name: 'Notifications', description: 'In-app notification management' },
      { name: 'Activity', description: 'User activity log and audit trail' },
    ],
  }
}

// Minimal Swagger UI HTML — no npm dependency needed
function swaggerHtml(specUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${PRODUCT_NAME} — API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0; } .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
    })
  </script>
</body>
</html>`
}

// GET /api/docs.json — raw OpenAPI spec
router.get('/docs.json', (req, res) => {
  res.json(buildOpenApiSpec())
})

// GET /api/docs — Swagger UI
router.get('/docs', (req, res) => {
  res.type('html').send(swaggerHtml('/api/docs.json'))
})

module.exports = router
