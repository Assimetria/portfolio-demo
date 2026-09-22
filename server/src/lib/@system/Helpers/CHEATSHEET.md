# API Helpers - Cheat Sheet

> Purpose: one-screen reference for the Helpers exports. See `README.md` in this directory for explanations and `docs/API.md` for route conventions.
> Last verified: 2026-09-20.

Quick reference for common operations.

## CRUD Helpers

```javascript
const {
  createCrudRouter,
  handleList,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,
} = require('../../lib/@system/Helpers')
```

### Auto-Generated Router
```javascript
createCrudRouter({
  repo: myRepo,
  validation: { create: schema, update: schema },
  middleware: { list: [auth], create: [auth, admin] },
  config: { basePath: '/items', dataKey: 'item' },
})
```

### Manual Handlers
```javascript
// List
handleList({ repo, req, res, next, filters, defaults, dataKey })

// Get
handleGetById({ repo, req, res, next, idParam, dataKey, notFoundMessage })

// Create
handleCreate({ repo, req, res, next, transformData, dataKey, statusCode })

// Update
handleUpdate({ repo, req, res, next, idParam, transformData, dataKey, notFoundMessage })

// Delete
handleDelete({ repo, req, res, next, idParam, hardDelete, notFoundMessage, successMessage })
```

---

## Pagination

```javascript
const { pagination, formatPaginatedResponse } = require('../../lib/@system/Middleware')

// Middleware
router.get('/items', pagination(), handler)
router.get('/items', pagination({ defaultLimit: 50, maxLimit: 200, allowAll: true }), handler)

// Format response
const response = formatPaginatedResponse(data, total, req.pagination)
```

**Query params:** `?limit=20&offset=0&page=1`

---

## Search Helpers

```javascript
const {
  parseSearchQuery,
  buildWhereClause,
  buildSearchCondition,
  buildOrderByClause,
  sanitizeSearchQuery,
} = require('../../lib/@system/Helpers')

// Parse
const search = parseSearchQuery(req.query, {
  queryParam: 'q',
  fieldsParam: 'fields',
  defaultFields: ['name', 'email'],
})

// WHERE clause
const { whereClause, params } = buildWhereClause({
  searchQuery: 'john',
  searchFields: ['name', 'email'],
  filters: { status: 'active', role: 'admin' },
  searchMode: 'contains', // 'contains' | 'starts_with' | 'exact'
})

// ORDER BY
const orderBy = buildOrderByClause({
  sortBy: req.query.sort,
  sortOrder: req.query.order,
  allowedFields: ['name', 'created_at'],
  defaultSort: 'created_at',
})

// Sanitize
const clean = sanitizeSearchQuery(req.query.q)
```

**Query params:** `?q=search&fields=name,email&sort=created_at&order=desc`

---

## Response Helpers

```javascript
const {
  success,
  created,
  noContent,
  error,
  notFound,
  unauthorized,
  forbidden,
  validationError,
  conflict,
  tooManyRequests,
  serverError,
} = require('../../lib/@system/Helpers')

success(res, data, message, statusCode)
created(res, data, message)
noContent(res)
error(res, message, statusCode, errors)
notFound(res, message)
unauthorized(res, message)
forbidden(res, message)
validationError(res, errors, message)
conflict(res, message)
tooManyRequests(res, message, retryAfter)
serverError(res, message)
```

---

## Query Builder

```javascript
const {
  buildInsert,
  buildUpdate,
  buildDelete,
  buildSelect,
  buildCount,
  buildBulkInsert,
  buildUpsert,
  escapeIdentifier,
} = require('../../lib/@system/Helpers')

// INSERT
const { sql, params } = buildInsert('table', data, { returning: true })

// UPDATE
const { sql, params } = buildUpdate('table', data, id, { idColumn: 'id', returning: true })

// DELETE
const { sql, params } = buildDelete('table', id, { soft: false, returning: false })

// SELECT
const { sql, params } = buildSelect('table', {
  columns: ['id', 'name'],
  whereClause: 'status = $1',
  whereParams: ['active'],
  orderBy: 'created_at DESC',
  limit: 20,
  offset: 0,
})

// COUNT
const { sql, params } = buildCount('table', {
  whereClause: 'status = $1',
  whereParams: ['active'],
  distinct: false,
})

// BULK INSERT
const { sql, params } = buildBulkInsert('table', [{ name: 'A' }, { name: 'B' }])

// UPSERT
const { sql, params } = buildUpsert('table', data, 'email', updateData, { returning: true })

// Escape identifier
const safe = escapeIdentifier(columnName)
```

---

## Repository Pattern

```javascript
class MyRepo {
  async findAll({ limit, offset, whereClause, params, orderBy, ...filters }) {
    const { sql, params: queryParams } = buildSelect('table', {
      whereClause, whereParams: params, orderBy, limit, offset,
    })
    return db.query(sql, queryParams)
  }
  
  async count({ whereClause, params }) {
    const { sql, params: queryParams } = buildCount('table', {
      whereClause, whereParams: params,
    })
    const result = await db.query(sql, queryParams)
    return parseInt(result[0].count, 10)
  }
  
  async findById(id) {
    const { sql, params } = buildSelect('table', {
      whereClause: 'id = $1', whereParams: [id], limit: 1,
    })
    const result = await db.query(sql, params)
    return result[0] || null
  }
  
  async create(data) {
    const { sql, params } = buildInsert('table', data)
    const result = await db.query(sql, params)
    return result[0]
  }
  
  async update(id, data) {
    const { sql, params } = buildUpdate('table', data, id)
    const result = await db.query(sql, params)
    return result[0]
  }
  
  async delete(id) {
    const { sql, params } = buildDelete('table', id)
    await db.query(sql, params)
  }
  
  async softDelete(id) {
    const { sql, params } = buildDelete('table', id, { soft: true, returning: true })
    const result = await db.query(sql, params)
    return result[0]
  }
}
```

---

## Complete Example

```javascript
const express = require('express')
const router = express.Router()
const { pagination } = require('../../lib/@system/Middleware')
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

// LIST
router.get('/items', pagination(), async (req, res, next) => {
  const search = parseSearchQuery(req.query, {
    defaultFields: ['name', 'description'],
  })
  
  const filters = {}
  if (req.query.category) filters.category = req.query.category
  
  const { whereClause, params } = buildWhereClause({
    searchQuery: search.query,
    searchFields: search.fields,
    filters,
  })
  
  const orderBy = buildOrderByClause({
    sortBy: req.query.sort,
    sortOrder: req.query.order,
    allowedFields: ['name', 'created_at'],
  })
  
  await handleList({
    repo: itemsRepo,
    req, res, next,
    filters: { whereClause, params, orderBy },
  })
})

// GET
router.get('/items/:id', (req, res, next) => {
  handleGetById({ repo: itemsRepo, req, res, next })
})

// CREATE
router.post('/items', authenticate, (req, res, next) => {
  handleCreate({
    repo: itemsRepo,
    req, res, next,
    transformData: async (body, req) => ({
      ...body,
      user_id: req.user.id,
    }),
  })
})

// UPDATE
router.patch('/items/:id', authenticate, (req, res, next) => {
  handleUpdate({ repo: itemsRepo, req, res, next })
})

// DELETE
router.delete('/items/:id', authenticate, (req, res, next) => {
  handleDelete({
    repo: itemsRepo,
    req, res, next,
    hardDelete: false,
  })
})

module.exports = router
```

---

## Files

- `crud.js` - CRUD handlers & router generator
- `search.js` - Search & filter utilities
- `query-builder.js` - SQL query builders
- `response.js` - Standard response formatters
- `../Middleware/pagination.js` - Pagination middleware
- `README.md` - Full documentation
- `QUICK-START.md` - Step-by-step guide
- `CHEATSHEET.md` - This file
