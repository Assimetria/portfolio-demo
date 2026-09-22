/**
 * API Template - Option 1: Auto-Generated CRUD Router (Zero Boilerplate)
 *
 * This is a REFERENCE template. All code is commented out because it references
 * non-existent example resources (ResourceRepo, schemas). Copy this pattern into
 * your own route file and replace `Resource` with your resource name.
 *
 * Use this approach when you want the simplest possible CRUD setup with no
 * custom logic per handler. For manual CRUD with helpers, see ../TEMPLATE.js.
 */

// ═══════════════════════════════════════════════════════════════════════════
// OPTION 1: Auto-Generated CRUD Router (Zero Boilerplate)
// ═══════════════════════════════════════════════════════════════════════════
/*
const { createCrudRouter } = require('../../lib/@system/Helpers')
const ResourceRepo = require('../../db/repos/@custom/ResourceRepo')
const { authenticate, requireAdmin } = require('../../lib/@system/Helpers/auth')
const { validate } = require('../../lib/@system/Middleware')
const { CreateResourceSchema, UpdateResourceSchema } = require('./schemas')

module.exports = createCrudRouter({
  repo: ResourceRepo,

  validation: {
    create: { body: CreateResourceSchema },
    update: { body: UpdateResourceSchema },
  },

  middleware: {
    list: [],
    get: [],
    create: [authenticate],
    update: [authenticate],
    delete: [authenticate, requireAdmin],
  },

  config: {
    basePath: '/api/resources',
    dataKey: 'resource',
    messages: {
      notFound: 'Resource not found',
      deleted: 'Resource deleted successfully',
    },
  },
})
*/
