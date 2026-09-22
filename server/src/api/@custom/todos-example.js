/**
 * @custom — Example tenant-scoped CRUD API (reference implementation)
 *
 * Copy this pattern for your own resources. It demonstrates the full stack:
 *   - authenticate → tenantContext (resolves req.tenant + req.withTenant)
 *   - zod validation on every route via validate() (schemas/@custom/todos.js)
 *   - pagination / search / whitelisted sort helpers
 *   - Postgres row-level security: all queries run inside req.withTenant(),
 *     which sets `app.current_tenant_id` for the transaction so the RLS policy
 *     from migration @custom/003_tenant_rls.js filters rows automatically
 *   - @system CRUD handlers (handleList/handleCreate/…) via bindRepo()
 *
 * Not mounted by default — register it in routes/@custom/index.js to enable.
 */

const express = require('express')
const router = express.Router()
const { pagination, validate } = require('../../lib/@system/Middleware')
const {
  handleList,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,
  parseSearchQuery,
  buildWhereClause,
  buildOrderByClause,
  authenticate,
} = require('../../lib/@system/Helpers')
const { tenantContext, bindRepo } = require('../../lib/@custom/tenantContext')
const TodoRepo = require('../../db/repos/@custom/TodoRepo')
const {
  SORTABLE,
  CreateTodoBody,
  UpdateTodoBody,
  TodoIdParams,
  ListTodosQuery,
} = require('../../lib/@system/Validation/schemas/@custom/todos')

// Every /api/todos route requires a signed-in user with a resolved tenant.
router.use('/api/todos', authenticate, tenantContext)

// ── LIST ────────────────────────────────────────────────────────────────────
// GET /api/todos?q=search&limit=20&page=1&sort=created_at&order=desc&priority=high&completed=true

router.get('/api/todos', validate({ query: ListTodosQuery }), pagination(), async (req, res, next) => {
  try {
    const search = parseSearchQuery(req.query, { defaultFields: ['title', 'description'] })

    // Filters: only whitelisted keys ever reach the SQL builder.
    const filters = {}
    if (req.query.priority) filters.priority = req.query.priority
    if (req.query.completed !== undefined) filters.completed = req.query.completed === 'true'

    const { whereClause, params } = buildWhereClause({
      searchQuery: search.query,
      searchFields: ['title', 'description'], // fixed — never trust ?fields= from the client
      filters,
    })

    const orderBy = buildOrderByClause({
      sortBy: req.query.sort,
      sortOrder: req.query.order,
      allowedFields: SORTABLE,
      defaultSort: 'created_at',
    })

    await req.withTenant((t) =>
      handleList({
        repo: bindRepo(TodoRepo, t),
        req,
        res,
        next,
        filters: { whereClause, params, orderBy },
        dataKey: 'todos',
      }),
    )
  } catch (err) {
    next(err)
  }
})

// ── GET BY ID ───────────────────────────────────────────────────────────────
// GET /api/todos/:id

router.get('/api/todos/:id', validate({ params: TodoIdParams }), async (req, res, next) => {
  try {
    await req.withTenant((t) =>
      handleGetById({
        repo: bindRepo(TodoRepo, t),
        req,
        res,
        next,
        dataKey: 'todo',
        notFoundMessage: 'Todo not found',
      }),
    )
  } catch (err) {
    next(err)
  }
})

// ── CREATE ──────────────────────────────────────────────────────────────────
// POST /api/todos   Body: { title, description?, priority? }

router.post('/api/todos', validate({ body: CreateTodoBody }), async (req, res, next) => {
  try {
    await req.withTenant((t) =>
      handleCreate({
        repo: bindRepo(TodoRepo, t),
        req,
        res,
        next,
        // Body is already validated/stripped by zod; add ownership columns here.
        transformData: async (body) => ({
          ...body,
          tenant_id: req.tenant.id,
          user_id: req.user.id,
        }),
        dataKey: 'todo',
      }),
    )
  } catch (err) {
    next(err)
  }
})

// ── UPDATE ──────────────────────────────────────────────────────────────────
// PATCH /api/todos/:id   Body: { title?, description?, priority?, completed? }

router.patch('/api/todos/:id', validate({ params: TodoIdParams, body: UpdateTodoBody }), async (req, res, next) => {
  try {
    await req.withTenant((t) =>
      handleUpdate({
        repo: bindRepo(TodoRepo, t),
        req,
        res,
        next,
        transformData: async (body, _req, existing) => {
          // Example business rule: completed todos can't be retitled.
          if (existing.completed && body.title !== undefined) {
            const err = new Error('Cannot edit the title of a completed todo')
            err.status = 409
            throw err
          }
          return body
        },
        dataKey: 'todo',
        notFoundMessage: 'Todo not found',
      }),
    )
  } catch (err) {
    next(err)
  }
})

// ── DELETE ──────────────────────────────────────────────────────────────────
// DELETE /api/todos/:id

router.delete('/api/todos/:id', validate({ params: TodoIdParams }), async (req, res, next) => {
  try {
    await req.withTenant((t) =>
      handleDelete({
        repo: bindRepo(TodoRepo, t),
        req,
        res,
        next,
        hardDelete: true,
        notFoundMessage: 'Todo not found',
        successMessage: 'Todo deleted successfully',
      }),
    )
  } catch (err) {
    next(err)
  }
})

module.exports = router
