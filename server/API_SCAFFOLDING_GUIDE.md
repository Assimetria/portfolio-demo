# API Scaffolding Guide

> Purpose: long-form guide to the CRUD/search/pagination helpers in `server/src/lib/@system/Helpers`. The short version is `server/src/lib/@system/Helpers/README.md`; conventions for routes (auth, validation, error shape) are in `docs/API.md`.
> Last verified: 2026-09-20. Note: examples show absolute paths such as `/api/products`; routers registered through `server/src/routes/@custom/index.js` are mounted under `/api`, so declare paths relative to it (`/products`).

This guide shows you how to use the built-in API scaffolding helpers to quickly build robust CRUD APIs with pagination, search, and filtering.

## Quick Start

The template provides three levels of abstraction for building APIs:

1. **Auto-generated CRUD router** - Zero boilerplate, configure and go
2. **CRUD handlers** - More control with minimal boilerplate
3. **Manual implementation** - Full control when you need custom logic

## Table of Contents

- [Auto-Generated CRUD Router](#auto-generated-crud-router)
- [CRUD Handlers](#crud-handlers)
- [Search & Filtering](#search--filtering)
- [Pagination](#pagination)
- [Query Builder](#query-builder)
- [Complete Examples](#complete-examples)

---

## Auto-Generated CRUD Router

The fastest way to create a complete REST API for a resource.

### Basic Usage

```javascript
const { createCrudRouter } = require('../../lib/@system/Helpers')
const ProductRepo = require('../../db/repos/@custom/ProductRepo')
const { CreateProductSchema, UpdateProductSchema } = require('./schemas')

module.exports = createCrudRouter({
  repo: ProductRepo,
  validation: {
    create: CreateProductSchema,
    update: UpdateProductSchema,
  },
  config: {
    basePath: '/api/products',
    dataKey: 'product',
    messages: {
      notFound: 'Product not found',
      deleted: 'Product deleted successfully',
    },
  },
})
```

This automatically creates:
- `GET /api/products` - List with pagination
- `GET /api/products/:id` - Get single item
- `POST /api/products` - Create new item
- `PATCH /api/products/:id` - Update item
- `DELETE /api/products/:id` - Delete item

### With Middleware

```javascript
const { authenticate, requireAdmin } = require('../../lib/@system/Helpers/auth')

module.exports = createCrudRouter({
  repo: ProductRepo,
  middleware: {
    list: [authenticate],
    get: [authenticate],
    create: [authenticate, requireAdmin],
    update: [authenticate, requireAdmin],
    delete: [authenticate, requireAdmin],
  },
  config: {
    basePath: '/api/products',
  },
})
```

---

## CRUD Handlers

When you need more control but want to avoid boilerplate.

### List with Pagination & Search

```javascript
const express = require('express')
const router = express.Router()
const {
  handleList,
  pagination,
  parseSearchQuery,
  buildWhereClause,
  buildOrderByClause,
} = require('../../lib/@system/Helpers')

router.get('/api/products', pagination(), async (req, res, next) => {
  try {
    // Parse search
    const search = parseSearchQuery(req.query, {
      defaultFields: ['name', 'description'],
    })
    
    // Build filters
    const filters = {}
    if (req.query.category) {
      filters.category = req.query.category
    }
    if (req.query.in_stock) {
      filters.in_stock = req.query.in_stock === 'true'
    }
    
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
      allowedFields: ['name', 'price', 'created_at'],
      defaultSort: 'created_at',
    })
    
    // Handle list
    await handleList({
      repo: ProductRepo,
      req,
      res,
      next,
      filters: { whereClause, params, orderBy },
      dataKey: 'products',
    })
  } catch (err) {
    next(err)
  }
})
```

### Get by ID

```javascript
const { handleGetById } = require('../../lib/@system/Helpers')

router.get('/api/products/:id', (req, res, next) => {
  handleGetById({
    repo: ProductRepo,
    req,
    res,
    next,
    dataKey: 'product',
    notFoundMessage: 'Product not found',
  })
})
```

### Create

```javascript
const { handleCreate, validate } = require('../../lib/@system/Helpers')

router.post('/api/products', validate(CreateProductSchema), (req, res, next) => {
  handleCreate({
    repo: ProductRepo,
    req,
    res,
    next,
    transformData: async (body, req) => ({
      ...body,
      user_id: req.user.id,
      slug: slugify(body.name),
      created_at: new Date().toISOString(),
    }),
    dataKey: 'product',
    statusCode: 201,
  })
})
```

### Update

```javascript
const { handleUpdate } = require('../../lib/@system/Helpers')

router.patch('/api/products/:id', validate(UpdateProductSchema), (req, res, next) => {
  handleUpdate({
    repo: ProductRepo,
    req,
    res,
    next,
    transformData: async (body, req, existing) => {
      // Example: prevent changing published products
      if (existing.status === 'published' && body.status !== 'published') {
        throw new Error('Cannot unpublish via PATCH')
      }
      
      return {
        ...body,
        updated_at: new Date().toISOString(),
      }
    },
    dataKey: 'product',
    notFoundMessage: 'Product not found',
  })
})
```

### Delete

```javascript
const { handleDelete } = require('../../lib/@system/Helpers')

router.delete('/api/products/:id', (req, res, next) => {
  handleDelete({
    repo: ProductRepo,
    req,
    res,
    next,
    hardDelete: false, // Use soft delete
    notFoundMessage: 'Product not found',
    successMessage: 'Product deleted successfully',
  })
})
```

---

## Search & Filtering

### Search Configuration

```javascript
const { parseSearchQuery, buildSearchCondition } = require('../../lib/@system/Helpers')

// Parse search from query params
const search = parseSearchQuery(req.query, {
  queryParam: 'q',           // ?q=search+term
  fieldsParam: 'fields',     // ?fields=name,description
  defaultFields: ['name', 'description'],
})

// Build SQL condition
const { condition, params } = buildSearchCondition(
  search.query,
  search.fields,
  {
    mode: 'contains',        // 'contains' | 'starts_with' | 'exact'
    caseSensitive: false,
  }
)
```

### Advanced Filtering

```javascript
const { buildWhereClause } = require('../../lib/@system/Helpers')

const { whereClause, params } = buildWhereClause({
  searchQuery: 'laptop',
  searchFields: ['name', 'description'],
  filters: {
    category: 'electronics',
    in_stock: true,
    price_range: ['< 1000'], // Custom SQL operators
  },
  searchMode: 'contains',
})

// Result: WHERE (name ILIKE '%laptop%' OR description ILIKE '%laptop%')
//         AND category = 'electronics' AND in_stock = true
```

### Sorting

```javascript
const { buildOrderByClause } = require('../../lib/@system/Helpers')

const orderBy = buildOrderByClause({
  sortBy: req.query.sort,           // Field to sort by
  sortOrder: req.query.order,       // 'asc' or 'desc'
  allowedFields: ['name', 'price', 'created_at'],
  defaultSort: 'created_at',
})

// Result: ORDER BY price DESC
```

---

## Pagination

### Middleware

```javascript
const { pagination } = require('../../lib/@system/Middleware')

// Default options
router.get('/api/products', pagination(), handler)

// Custom options
router.get('/api/products', pagination({
  defaultLimit: 50,      // Default page size
  maxLimit: 200,         // Maximum allowed
  allowAll: false,       // Allow limit=-1 for all results
}), handler)
```

### Query Parameters

Supports both offset-based and page-based pagination:

```
GET /api/products?limit=20&offset=40
GET /api/products?limit=20&page=3
```

### Response Format

```javascript
const { formatPaginatedResponse } = require('../../lib/@system/Middleware')

const response = formatPaginatedResponse(data, total, req.pagination)

// Returns:
{
  "data": [...],
  "total": 100,
  "limit": 20,
  "offset": 40,
  "page": 3,
  "total_pages": 5,
  "has_more": true
}
```

---

## Query Builder

Low-level SQL query builders for custom scenarios.

### INSERT

```javascript
const { buildInsert } = require('../../lib/@system/Helpers')

const { sql, params } = buildInsert('products', {
  name: 'Laptop',
  price: 999,
  category: 'electronics',
}, { returning: true })

// INSERT INTO products (name, price, category) VALUES ($1, $2, $3) RETURNING *
```

### UPDATE

```javascript
const { buildUpdate } = require('../../lib/@system/Helpers')

const { sql, params } = buildUpdate('products', {
  name: 'Gaming Laptop',
  price: 1299,
}, productId, { returning: true })

// UPDATE products SET name = $1, price = $2 WHERE id = $3 RETURNING *
```

### SELECT with Filters

```javascript
const { buildSelect } = require('../../lib/@system/Helpers')

const { sql, params } = buildSelect('products', {
  columns: ['id', 'name', 'price'],
  whereClause: 'category = $1 AND price < $2',
  whereParams: ['electronics', 1000],
  orderBy: 'price DESC',
  limit: 20,
  offset: 40,
})

// SELECT id, name, price FROM products 
// WHERE category = $1 AND price < $2 
// ORDER BY price DESC LIMIT $3 OFFSET $4
```

### UPSERT

```javascript
const { buildUpsert } = require('../../lib/@system/Helpers')

const { sql, params } = buildUpsert(
  'products',
  { sku: 'LAP-001', name: 'Laptop', price: 999 },
  'sku',  // Conflict column
  { name: 'Laptop', price: 999 },  // Update data
  { returning: true }
)

// INSERT INTO products (sku, name, price) VALUES ($1, $2, $3)
// ON CONFLICT (sku) DO UPDATE SET name = $4, price = $5
// RETURNING *
```

### Bulk INSERT

```javascript
const { buildBulkInsert } = require('../../lib/@system/Helpers')

const { sql, params } = buildBulkInsert('products', [
  { name: 'Product 1', price: 100 },
  { name: 'Product 2', price: 200 },
  { name: 'Product 3', price: 300 },
], { returning: true })

// INSERT INTO products (name, price) 
// VALUES ($1, $2), ($3, $4), ($5, $6) 
// RETURNING *
```

---

## Complete Examples

### Example 1: Simple CRUD API

```javascript
// server/src/api/@custom/categories/index.js
const { createCrudRouter } = require('../../../lib/@system/Helpers')
const CategoryRepo = require('../../../db/repos/@custom/CategoryRepo')
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')

module.exports = createCrudRouter({
  repo: CategoryRepo,
  middleware: {
    create: [authenticate, requireAdmin],
    update: [authenticate, requireAdmin],
    delete: [authenticate, requireAdmin],
  },
  config: {
    basePath: '/api/categories',
    dataKey: 'category',
  },
})
```

### Example 2: API with Custom Search

```javascript
// server/src/api/@custom/articles/index.js
const express = require('express')
const router = express.Router()
const ArticleRepo = require('../../../db/repos/@custom/ArticleRepo')
const {
  pagination,
  handleList,
  parseSearchQuery,
  buildWhereClause,
  buildOrderByClause,
  authenticate,
} = require('../../../lib/@system/Helpers')

// LIST with search, filters, and pagination
router.get('/api/articles', pagination(), async (req, res, next) => {
  try {
    const search = parseSearchQuery(req.query, {
      defaultFields: ['title', 'content', 'tags'],
    })
    
    const filters = {}
    if (req.query.author_id) filters.author_id = req.query.author_id
    if (req.query.status) filters.status = req.query.status
    if (req.query.published_after) {
      // Custom date filter
      filters['published_at >='] = req.query.published_after
    }
    
    const { whereClause, params } = buildWhereClause({
      searchQuery: search.query,
      searchFields: search.fields,
      filters,
    })
    
    const orderBy = buildOrderByClause({
      sortBy: req.query.sort,
      sortOrder: req.query.order,
      allowedFields: ['title', 'published_at', 'view_count'],
      defaultSort: 'published_at',
    })
    
    await handleList({
      repo: ArticleRepo,
      req,
      res,
      next,
      filters: { whereClause, params, orderBy },
      dataKey: 'articles',
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
```

### Example 3: Repository Interface

Your repository should implement these methods to work with CRUD helpers:

```javascript
// server/src/db/repos/@custom/ProductRepo.js
class ProductRepo {
  // Required for LIST
  async findAll({ whereClause, params, orderBy, limit, offset }) {
    const { sql } = buildSelect('products', {
      whereClause,
      whereParams: params,
      orderBy,
      limit,
      offset,
    })
    const result = await db.query(sql, params)
    return result.rows
  }
  
  // Required for LIST
  async count({ whereClause, params }) {
    const { sql } = buildCount('products', { whereClause, whereParams: params })
    const result = await db.query(sql, params)
    return parseInt(result.rows[0].count, 10)
  }
  
  // Required for GET
  async findById(id) {
    const result = await db.query('SELECT * FROM products WHERE id = $1', [id])
    return result.rows[0] || null
  }
  
  // Required for CREATE
  async create(data) {
    const { sql, params } = buildInsert('products', data, { returning: true })
    const result = await db.query(sql, params)
    return result.rows[0]
  }
  
  // Required for UPDATE
  async update(id, data) {
    const { sql, params } = buildUpdate('products', data, id, { returning: true })
    const result = await db.query(sql, params)
    return result.rows[0]
  }
  
  // Required for DELETE
  async delete(id) {
    await db.query('DELETE FROM products WHERE id = $1', [id])
  }
  
  // Optional: Soft delete
  async softDelete(id) {
    await db.query('UPDATE products SET deleted_at = NOW() WHERE id = $1', [id])
  }
}
```

---

## API Query Examples

Once your API is set up, clients can use these query patterns:

### Pagination

```bash
# Page-based
GET /api/products?page=2&limit=20

# Offset-based
GET /api/products?offset=40&limit=20
```

### Search

```bash
# Search across default fields
GET /api/products?q=laptop

# Search specific fields
GET /api/products?q=gaming&fields=name,description
```

### Filtering

```bash
# Single filter
GET /api/products?category=electronics

# Multiple filters
GET /api/products?category=electronics&in_stock=true

# With search
GET /api/products?q=laptop&category=electronics&price_max=1000
```

### Sorting

```bash
# Sort ascending
GET /api/products?sort=price&order=asc

# Sort descending
GET /api/products?sort=created_at&order=desc
```

### Combined

```bash
GET /api/products?q=gaming&category=electronics&sort=price&order=asc&page=1&limit=20
```

---

## Helper Reference

### CRUD Handlers

| Function | Purpose |
|----------|---------|
| `handleList` | List items with pagination |
| `handleGetById` | Get single item by ID |
| `handleCreate` | Create new item |
| `handleUpdate` | Update existing item |
| `handleDelete` | Delete item (hard or soft) |
| `createCrudRouter` | Auto-generate full CRUD router |

### Search Helpers

| Function | Purpose |
|----------|---------|
| `parseSearchQuery` | Parse search from query params |
| `buildSearchCondition` | Build SQL search condition |
| `buildWhereClause` | Build WHERE with search + filters |
| `sanitizeSearchQuery` | Clean search input |
| `buildOrderByClause` | Build ORDER BY clause |

### Query Builders

| Function | Purpose |
|----------|---------|
| `buildInsert` | Build INSERT query |
| `buildUpdate` | Build UPDATE query |
| `buildDelete` | Build DELETE query |
| `buildSelect` | Build SELECT query |
| `buildCount` | Build COUNT query |
| `buildBulkInsert` | Build bulk INSERT query |
| `buildUpsert` | Build UPSERT query |
| `escapeIdentifier` | Escape table/column names |

### Middleware

| Function | Purpose |
|----------|---------|
| `pagination()` | Parse pagination params |
| `formatPaginatedResponse` | Format paginated response |

---

## Best Practices

### 1. Use Validation

Always validate input with Zod schemas:

```javascript
const { z } = require('zod')

const CreateProductSchema = {
  body: z.object({
    name: z.string().min(1).max(200),
    price: z.number().positive(),
    category: z.enum(['electronics', 'clothing', 'books']),
  }),
}
```

### 2. Whitelist Sortable Fields

Prevent SQL injection by whitelisting sortable fields:

```javascript
const orderBy = buildOrderByClause({
  sortBy: req.query.sort,
  allowedFields: ['name', 'price', 'created_at'], // Whitelist!
  defaultSort: 'created_at',
})
```

### 3. Add User Context

Use `transformData` to inject user context:

```javascript
handleCreate({
  repo: ProductRepo,
  req, res, next,
  transformData: async (body, req) => ({
    ...body,
    user_id: req.user.id,
    created_at: new Date().toISOString(),
  }),
})
```

### 4. Implement Soft Delete

Support soft deletes in your repository:

```javascript
async softDelete(id) {
  const { sql, params } = buildUpdate(
    'products',
    { deleted_at: new Date().toISOString() },
    id
  )
  await db.query(sql, params)
}
```

Then use it:

```javascript
handleDelete({
  repo: ProductRepo,
  req, res, next,
  hardDelete: false, // Uses softDelete()
})
```

### 5. Keep Repositories Clean

Repositories should focus on data access, not business logic:

```javascript
// ✅ Good: Repository handles data access
class ProductRepo {
  async findById(id) {
    const result = await db.query('SELECT * FROM products WHERE id = $1', [id])
    return result.rows[0] || null
  }
}

// ❌ Bad: Repository contains business logic
class ProductRepo {
  async findById(id) {
    const product = await db.query('SELECT * FROM products WHERE id = $1', [id])
    if (product.price > 1000) {
      // Send notification
      // Update analytics
    }
    return product.rows[0]
  }
}
```

---

## Migration Guide

To migrate existing endpoints to use these helpers:

### Before

```javascript
router.get('/api/products', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    const offset = parseInt(req.query.offset) || 0
    
    let whereConditions = []
    let params = []
    
    if (req.query.category) {
      whereConditions.push('category = $' + (params.length + 1))
      params.push(req.query.category)
    }
    
    if (req.query.q) {
      whereConditions.push('(name ILIKE $' + (params.length + 1) + ' OR description ILIKE $' + (params.length + 2) + ')')
      params.push('%' + req.query.q + '%', '%' + req.query.q + '%')
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''
    
    const countResult = await db.query(`SELECT COUNT(*) FROM products ${whereClause}`, params)
    const total = parseInt(countResult.rows[0].count)
    
    params.push(limit, offset)
    const result = await db.query(
      `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    
    res.json({
      products: result.rows,
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      total_pages: Math.ceil(total / limit),
    })
  } catch (err) {
    next(err)
  }
})
```

### After

```javascript
router.get('/api/products', pagination(), async (req, res, next) => {
  try {
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
      allowedFields: ['name', 'price', 'created_at'],
      defaultSort: 'created_at',
    })
    
    await handleList({
      repo: ProductRepo,
      req, res, next,
      filters: { whereClause, params, orderBy },
      dataKey: 'products',
    })
  } catch (err) {
    next(err)
  }
})
```

Much cleaner, more maintainable, and less error-prone!

---

## Troubleshooting

### "handleList is not a function"

Make sure you're importing from the correct path:

```javascript
const { handleList } = require('../../lib/@system/Helpers')
// NOT from '@system/Helpers/crud'
```

### Pagination not working

Ensure the pagination middleware runs before your handler:

```javascript
router.get('/api/products', pagination(), handler) // ✅
router.get('/api/products', handler) // ❌ No pagination
```

### Search returns no results

Check that your repository's `findAll` method properly uses the WHERE clause:

```javascript
async findAll({ whereClause, params, limit, offset }) {
  const { sql } = buildSelect('products', {
    whereClause,        // ✅ Pass it here
    whereParams: params, // ✅ And the params
    limit,
    offset,
  })
  return (await db.query(sql, params)).rows
}
```

---

## Next Steps

1. Review the [todos-example.js](./src/api/@custom/todos-example.js) for a working reference
2. Migrate one existing endpoint to use these helpers
3. Create your repository interfaces following the example above
4. Add validation schemas for your resources
5. Test with various query parameters

Happy building! 🚀
