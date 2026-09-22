/**
 * @system GraphQL Server Setup
 *
 * Template infrastructure: schema creation, HTTP handler, WebSocket subscriptions.
 * Product-specific typeDefs and resolvers are imported from @custom.
 */
const { createHandler } = require('graphql-http/lib/use/express')
const { NoSchemaIntrospectionCustomRule } = require('graphql')
const { makeExecutableSchema } = require('@graphql-tools/schema')
const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/use/ws')
const { PubSub } = require('graphql-subscriptions')

const logger = require('../../lib/@system/Logger')
const db = require('../../lib/@system/PostgreSQL')

// In-memory PubSub for subscriptions (swap with Redis PubSub for multi-instance)
const pubsub = new PubSub()

/**
 * Extract authenticated user from request.
 * Re-uses the same JWT verification as REST auth middleware.
 */
async function getUserFromToken(token) {
  if (!token) return null
  try {
    const jwt = require('../../lib/@system/JWT')
    const decoded = jwt.verify(token)
    if (!decoded || !decoded.sub) return null
    const user = await db.oneOrNone('SELECT id, email, name, role FROM users WHERE id = $1', [decoded.sub])
    return user
  } catch {
    return null
  }
}

/**
 * Extract token from request (Authorization header or cookie).
 */
function extractToken(req) {
  // Check Authorization header first
  const authHeader = req.headers?.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  // Fall back to cookie
  return req.cookies?.token || null
}

/**
 * Initialize GraphQL server and attach to Express app + HTTP server.
 *
 * @param {import('express').Application} app - Express app
 * @param {import('http').Server} httpServer - HTTP server for WebSocket subscriptions
 */
async function setupGraphQL(app, httpServer) {
  const { typeDefs, resolvers } = require('../@custom')

  const schema = makeExecutableSchema({ typeDefs, resolvers })

  // ── WebSocket server for subscriptions ─────────────────────────────────
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  })

  useServer(
    {
      schema,
      context: async (ctx) => {
        // Extract token from connection params
        const token = ctx.connectionParams?.Authorization?.replace('Bearer ', '') ||
                      ctx.connectionParams?.token
        const user = await getUserFromToken(token)
        return { db, user, pubsub }
      },
      onConnect: async (ctx) => {
        logger.info('GraphQL WebSocket client connected')
      },
      onDisconnect: () => {
        logger.info('GraphQL WebSocket client disconnected')
      },
    },
    wsServer
  )

  // ── Disable introspection in production ────────────────────────────────
  const validationRules =
    process.env.NODE_ENV === 'production' && process.env.GRAPHQL_INTROSPECTION !== 'true'
      ? [NoSchemaIntrospectionCustomRule]
      : []

  // ── Mount at /graphql ──────────────────────────────────────────────────
  const graphqlHandler = createHandler({
    schema,
    validationRules,
    context: async (req) => {
      const token = extractToken(req.raw)
      const user = await getUserFromToken(token)
      return { db, user, pubsub, req: req.raw }
    },
  })

  app.use('/graphql', graphqlHandler)

  logger.info('GraphQL endpoint available at /graphql')
  logger.info('GraphQL subscriptions available via WebSocket at ws://*/graphql')

  return { pubsub }
}

module.exports = { setupGraphQL, pubsub }
