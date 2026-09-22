# Quick Start Guide

> Purpose: build a CRUD endpoint with the Helpers in five minutes. Paths in examples are absolute; routers registered via `server/src/routes/@custom/index.js` are mounted under `/api`, so declare `/products` not `/api/products`.
> Last verified: 2026-09-20.

## 5-Minute CRUD API

### 1. Create a Repository

```javascript
// src/db/repos/@custom/ProductsRepo.js
const db = require('../../lib/@system/PostgreSQL')
const { buildInsert, buildUpdate, buildSelect, buildCount, buildDelete } = require('../../lib/@system/Helpers')

class ProductsRepo {
  async findAll({ limit = 20, offset = 0, whereClause = '', params = [], orderBy = 'created_at DESC' }) {
    const { sql, params: queryParams } = buildSelect('products', {
      whereClause,
      whereParams: params,
      orderBy,
      limit,
      offset,
    })
    return db.query(sql, queryParams)
  }
  
  async count({ whereClause = '', params = [] }) {
    const { sql, params: queryParams } = buildCount('products', {
      whereClause,
      whereParams: params,
    })
    const result = await db.query(sql, queryParams)
    return parseInt(result[0].count, 10)
  }
  
  async findById(id) {
    const { sql, params } = buildSelect('products', {
      whereClause: 'id = $1',
      whereParams: [id],
      limit: 1,
    })
    const result = await db.query(sql, params)
    return result[0] || null
  }
  
  async create(data) {
    const { sql, params } = buildInsert('products', data)
    const result = await db.query(sql, params)
    return result[0]
  }
  
  async update(id, data) {
    const { sql, params } = buildUpdate('products', data, id)
    const result = await db.query(sql, params)
    return result[0]
  }
  
  async delete(id) {
    const { sql, params } = buildDelete('products', id)
    await db.query(sql, params)
  }
  
  async softDelete(id) {
    const { sql, params } = buildDelete('products', id, { soft: true, returning: true })
    const result = await db.query(sql, params)
    return result[0]
  }
}

module.exports = new ProductsRepo()
```

### 2. Create Routes

```javascript
// src/api/@custom/products/index.js
const express = require('express')
const router = express.Router()
const { createCrudRouter } = require('../../../lib/@system/Helpers')
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const productsRepo = require('../../../db/repos/@custom/ProductsRepo')

module.exports = createCrudRouter({
  repo: productsRepo,
  middleware: {
    list: [authenticate],
    create: [authenticate],
    update: [authenticate],
    delete: [authenticate],
  },
  config: {
    basePath: '/products',
    dataKey: 'product',
  },
})
```

### 3. Register Routes

```javascript
// src/routes/@custom/index.js
const express = require('express')
const router = express.Router()

router.use(require('../../api/@custom/products'))

module.exports = router
```

Done! You now have:
- `GET /products` - List with pagination & search
- `GET /products/:id` - Get by ID
- `POST /products` - Create
- `PATCH /products/:id` - Update
- `DELETE /products/:id` - Delete

---

## Common Patterns

### Pattern 1: Simple CRUD (Auto-Generated)

```javascript
const { createCrudRouter } = require('../../lib/@system/Helpers')

module.exports = createCrudRouter({
  repo: myRepo,
  config: { basePath: '/items' },
})
```

### Pattern 2: CRUD with Validation

```javascript
const { createCrudRouter } = require('../../lib/@system/Helpers')
const { createItemSchema, updateItemSchema } = require('../../lib/@custom/Validation/schemas/items')

module.exports = createCrudRouter({
  repo: itemsRepo,
  validation: {
    create: createItemSchema,
    update: updateItemSchema,
  },
  config: { basePath: '/items' },
})
```

### Pattern 3: CRUD with Auth & Permissions

```javascript
const { createCrudRouter } = require('../../lib/@system/Helpers')
const { authenticate, requireAdmin } = require('../../lib/@system/Helpers/auth')

module.exports = createCrudRouter({
  repo: itemsRepo,
  middleware: {
    list: [authenticate],
    get: [authenticate],
    create: [authenticate, requireAdmin],
    update: [authenticate, requireAdmin],
    delete: [authenticate, requireAdmin],
  },
  config: { basePath: '/items' },
})
```

### Pattern 4: List with Search & Filters

```javascript
const { pagination } = require('../../lib/@system/Middleware')
const { handleList, parseSearchQuery, buildWhereClause, buildOrderByClause } = require('../../lib/@system/Helpers')

router.get('/items', pagination(), async (req, res, next) => {
  // Parse search query
  const search = parseSearchQuery(req.query, {
    defaultFields: ['name', 'description'],
  })
  
  // Build filters
  const filters = {}
  if (req.query.category) filters.category = req.query.category
  if (req.query.active) filters.active = req.query.active === 'true'
  
  // Build WHERE clause
  const { whereClause, params } = buildWhereClause({
    searchQuery: search.query,
    searchFields: search.fields,
    filters,
  })
  
  // Build ORDER BY
  const orderBy = buildOrderByClause({
    sortBy: req.query.sort,
    sortOrder: req.query.order,
    allowedFields: ['name', 'created_at'],
  })
  
  await handleList({
    repo: itemsRepo,
    req,
    res,
    next,
    filters: { whereClause, params, orderBy },
  })
})
```

### Pattern 5: Create with User Ownership

```javascript
const { handleCreate } = require('../../lib/@system/Helpers')
const { authenticate } = require('../../lib/@system/Helpers/auth')

router.post('/items', authenticate, (req, res, next) => {
  handleCreate({
    repo: itemsRepo,
    req,
    res,
    next,
    transformData: async (body, req) => ({
      ...body,
      user_id: req.user.id,
      created_at: new Date(),
    }),
  })
})
```

### Pattern 6: Update with Ownership Check

```javascript
const { handleUpdate } = require('../../lib/@system/Helpers')
const { authenticate } = require('../../lib/@system/Helpers/auth')

router.patch('/items/:id', authenticate, (req, res, next) => {
  handleUpdate({
    repo: itemsRepo,
    req,
    res,
    next,
    transformData: async (body, req, existing) => {
      // Check ownership
      if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
        const error = new Error('Forbidden')
        error.status = 403
        throw error
      }
      
      return {
        ...body,
        updated_at: new Date(),
      }
    },
  })
})
```

### Pattern 7: Soft Delete

```javascript
const { handleDelete } = require('../../lib/@system/Helpers')

router.delete('/items/:id', (req, res, next) => {
  handleDelete({
    repo: itemsRepo,
    req,
    res,
    next,
    hardDelete: false,  // Uses repo.softDelete()
  })
})
```

### Pattern 8: Response Helpers

```javascript
const { success, created, notFound, validationError, forbidden } = require('../../lib/@system/Helpers')

// Success response
router.get('/items/:id', async (req, res) => {
  const item = await itemsRepo.findById(req.params.id)
  
  if (!item) {
    return notFound(res, 'Item not found')
  }
  
  return success(res, { item })
})

// Created response
router.post('/items', async (req, res) => {
  const item = await itemsRepo.create(req.body)
  return created(res, { item }, 'Item created successfully')
})

// Validation error
router.post('/items', (req, res) => {
  const errors = validateInput(req.body)
  if (errors) {
    return validationError(res, errors)
  }
  // ...
})

// Forbidden
router.delete('/items/:id', (req, res) => {
  if (!canDelete(req.user, item)) {
    return forbidden(res, 'You do not have permission to delete this item')
  }
  // ...
})
```

### Pattern 9: Bulk Insert

```javascript
const { buildBulkInsert } = require('../../lib/@system/Helpers')

router.post('/items/bulk', async (req, res) => {
  const items = req.body.items  // Array of item objects
  
  const { sql, params } = buildBulkInsert('items', items)
  const result = await db.query(sql, params)
  
  res.status(201).json({ items: result, count: result.length })
})
```

### Pattern 10: Upsert (Insert or Update)

```javascript
const { buildUpsert } = require('../../lib/@system/Helpers')

router.post('/items/sync', async (req, res) => {
  const { external_id, name, description } = req.body
  
  const { sql, params } = buildUpsert(
    'items',
    { external_id, name, description },
    'external_id',  // Conflict column
    { name, description }  // Data to update on conflict
  )
  
  const result = await db.query(sql, params)
  res.json({ item: result[0] })
})
```

---

## URL Query Parameters

### Pagination
- `?limit=20` - Items per page (default: 20, max: 100)
- `?offset=40` - Skip N items
- `?page=3` - Page number (auto-calculates offset)

### Search
- `?q=keyword` - Search query
- `?fields=name,email` - Fields to search (default: all searchable fields)

### Filters
- `?category=electronics` - Exact match
- `?active=true` - Boolean filter
- `?tags=featured,new` - Array filter (IN clause)

### Sorting
- `?sort=created_at` - Field to sort by
- `?order=desc` - Sort direction (asc/desc)

### Example
```
GET /products?q=laptop&category=electronics&sort=price&order=asc&limit=20&page=1
```

---

## Response Format

### List Response
```json
{
  "data": [...],
  "total": 156,
  "limit": 20,
  "offset": 0,
  "page": 1,
  "total_pages": 8,
  "has_more": true
}
```

### Single Resource
```json
{
  "data": {...}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "name": "Name is required",
    "price": "Price must be a positive number"
  }
}
```

---

## Next Steps

1. Read the full [README.md](./README.md) for detailed documentation
2. Check [todos-example.js](../../../api/@custom/todos-example.js) for a complete example
3. Implement your first CRUD API using `createCrudRouter`
4. Customize with validation, middleware, and custom logic
