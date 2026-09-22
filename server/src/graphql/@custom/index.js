/**
 * @custom GraphQL — Product-specific type definitions and resolvers.
 *
 * Add your product's GraphQL types and resolvers here.
 * Server bootstrapping (schema creation, HTTP handler, WS subscriptions)
 * lives in @system/index.js.
 */

const typeDefs = `
  type Query {
    hello: String
  }
`

const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL',
  },
}

module.exports = { typeDefs, resolvers }
