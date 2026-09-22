# API Scaffolding Helpers

> Purpose: reference for `server/src/lib/@system/Helpers` (CRUD handlers, `createCrudRouter`, search/filter/sort parsing, pagination, query builders, response helpers, `BaseRepository`). Route conventions (auth, zod, error shape) are in `docs/API.md`.
> Last verified: 2026-09-20. Examples use absolute `/api/...` paths; when you register a router through `server/src/routes/@custom/index.js` it is already mounted under `/api`, so use `/products` there.

Reusable utilities for building robust REST APIs with PostgreSQL. Includes pagination, search, filtering, sorting, and CRUD operations with minimal boilerplate.

## ✨ Features

- **Zero-config CRUD** - Auto-generate complete REST APIs
- **PostgreSQL-native** - Proper `$1, $2, $3` parameter binding
- **Type-safe** - Works with Zod validation schemas
- **Flexible** - Use high-level helpers or low-level builders
- **Production-ready** - SQL injection protection, proper error handling

## 📚 Quick Links

- [Quick Start](#quick-start)
- [CRUD Helpers](#crud-helpers)
- [Search & Filtering](#search--filtering)
- [Pagination](#pagination)
- [Query Builders](#query-builders)
- [API Utilities](#api-utilities)
- [Complete Examples](./examples.js)
- [Full Guide](../../../../API_SCAFFOLDING_GUIDE.md)

## 🚀 Quick Start

### 1. Auto-Generated CRUD (Fastest)

```javascript
const { createCrudRouter } = require('./lib/@system/Helpers')
const ProductRepo = require('./db/repos/@custom/ProductRepo')

// One line to create 5 endpoints
module.exports = createCrudRouter({
  repo: ProductRepo,
  config: { basePath: '/api/products', dataKey: 'product' },
})
```

This creates:
- `GET /api/products` - List with pagination/search/filters
- `GET /api/products/:id` - Get single item
- `POST /api/products` - Create
- `PATCH /api/products/:id` - Update
- `DELETE /api/products/:id` - Delete

### 2. Manual CRUD (More Control)

```javascript
const express = require('express')
const router = express.Router()
const {
  pagination,
  handleList,
  parseQueryParams,
} = require('./lib/@system/Helpers')

router.get('/api/products', pagination(), async (req, res, next) => {
  const queryConfig = parseQueryParams(req, {
    searchFields: ['name', 'description'],
    sortableFields: ['name', 'price', 'created_at'],
    filterFields: ['category', 'in_stock'],
  })
  
  await handleList({
    repo: ProductRepo,
    req, res, next,
    filters: queryConfig,
    dataKey: 'products',
  })
})
```

## 🔧 CRUD Helpers

### handleList
List items with pagination, search, and filtering.

```javascript
await handleList({
  repo: ProductRepo,
  req, res, next,
  filters: { whereClause, params, orderBy },
  dataKey: 'products',
})
```

### handleGetById
Get single item by ID.

```javascript
await handleGetById({
  repo: ProductRepo,
  req, res, next,
  dataKey: 'product',
  notFoundMessage: 'Product not found',
})
```

### handleCreate
Create new item with data transformation.

```javascript
await handleCreate({
  repo: ProductRepo,
  req, res, next,
  transformData: async (body, req) => ({
    ...body,
    user_id: req.user.id,
    created_at: new Date().toISOString(),
  }),
  dataKey: 'product',
  statusCode: 201,
})
```

### handleUpdate
Update existing item.

```javascript
await handleUpdate({
  repo: ProductRepo,
  req, res, next,
  transformData: async (body, req, existing) => ({
    ...body,
    updated_at: new Date().toISOString(),
  }),
  dataKey: 'product',
})
```

### handleDelete
Delete item (hard or soft).

```javascript
await handleDelete({
  repo: ProductRepo,
  req, res, next,
  hardDelete: false, // Soft delete
  successMessage: 'Product deleted',
})
```

### createCrudRouter
Auto-generate complete CRUD router.

```javascript
createCrudRouter({
  repo: ProductRepo,
  validation: { create: CreateSchema, update: UpdateSchema },
  middleware: { create: [authenticate], update: [authenticate] },
  config: { basePath: '/api/products', dataKey: 'product' },
})
```

## 🔍 Search & Filtering

### parseSearchQuery
Parse search from query params.

```javascript
const search = parseSearchQuery(req.query, {
  queryParam: 'q',
  fieldsParam: 'fields',
  defaultFields: ['name', 'description'],
})
// ?q=laptop&fields=name,brand
// => { query: 'laptop', fields: ['name', 'brand'] }
```

### buildWhereClause
Build PostgreSQL WHERE clause with search and filters.

```javascript
const { whereClause, params } = buildWhereClause({
  searchQuery: 'laptop',
  searchFields: ['name', 'description'],
  filters: {
    category: 'electronics',
    in_stock: true,
    'price >=': 100,
    'price <=': 1000,
  },
  searchMode: 'contains', // 'contains' | 'starts_with' | 'exact'
})

// Result:
// whereClause: "WHERE (LOWER(name) ILIKE $1 OR LOWER(description) ILIKE $2) 
//                AND category = $3 AND in_stock = $4 
//                AND price >= $5 AND price <= $6"
// params: ['%laptop%', '%laptop%', 'electronics', true, 100, 1000]
```

### buildOrderByClause
Build ORDER BY with whitelisted fields.

```javascript
const orderBy = buildOrderByClause({
  sortBy: req.query.sort,
  sortOrder: req.query.order,
  allowedFields: ['name', 'price', 'created_at'],
  defaultSort: 'created_at',
})
// ?sort=price&order=asc
// => "ORDER BY price ASC"
```

### parseQueryParams
Parse all query params at once (search, filters, sort).

```javascript
const queryConfig = parseQueryParams(req, {
  searchFields: ['name', 'description'],
  sortableFields: ['name', 'price'],
  filterFields: ['category', 'in_stock'],
  booleanFields: ['in_stock', 'featured'],
  arrayFields: ['tags'],
})
// Returns: { search, filters, whereClause, params, orderBy, pagination }
```

## 📄 Pagination

### pagination middleware
Parse limit, offset, page params.

```javascript
router.get('/api/products', pagination({
  defaultLimit: 20,
  maxLimit: 100,
  allowAll: false, // Disallow limit=-1 (all results)
}), handler)

// Sets req.pagination = { limit, offset, page }
```

### formatPaginatedResponse
Format response with pagination metadata.

```javascript
const response = formatPaginatedResponse(data, total, req.pagination)
// {
//   data: [...],
//   total: 100,
//   limit: 20,
//   offset: 40,
//   page: 3,
//   total_pages: 5,
//   has_more: true
// }
```

Query examples:
```bash
?page=2&limit=20          # Page-based
?offset=40&limit=20       # Offset-based
?page=1&limit=50          # Custom page size
```

## 🔨 Query Builders

Low-level SQL builders for custom scenarios.

### buildInsert
```javascript
const { sql, params } = buildInsert('products', {
  name: 'Laptop',
  price: 999,
}, { returning: true })
// INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *
```

### buildUpdate
```javascript
const { sql, params } = buildUpdate('products', {
  name: 'Gaming Laptop',
  price: 1299,
}, productId, { returning: true })
// UPDATE products SET name = $1, price = $2 WHERE id = $3 RETURNING *
```

### buildSelect
```javascript
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

### buildCount
```javascript
const { sql, params } = buildCount('products', {
  whereClause: 'category = $1',
  whereParams: ['electronics'],
})
// SELECT COUNT(*) as count FROM products WHERE category = $1
```

### buildBulkInsert
```javascript
const { sql, params } = buildBulkInsert('products', [
  { name: 'Product 1', price: 100 },
  { name: 'Product 2', price: 200 },
], { returning: true })
// INSERT INTO products (name, price) VALUES ($1, $2), ($3, $4) RETURNING *
```

### buildUpsert
```javascript
const { sql, params } = buildUpsert(
  'products',
  { sku: 'LAP-001', name: 'Laptop', price: 999 },
  'sku', // Conflict column
  { name: 'Laptop', price: 999 }, // Update data
  { returning: true }
)
// INSERT INTO products (sku, name, price) VALUES ($1, $2, $3)
// ON CONFLICT (sku) DO UPDATE SET name = $4, price = $5 RETURNING *
```

### buildDelete
```javascript
const { sql, params } = buildDelete('products', id, {
  soft: true, // Soft delete (SET deleted_at = NOW())
  returning: true,
})
```

## 🛠️ API Utilities

### asyncHandler
Wrap async route handlers to catch errors.

```javascript
router.get('/api/products/:id', asyncHandler(async (req, res) => {
  const product = await ProductRepo.findById(req.params.id)
  res.json({ product })
}))
```

### validateIdParam
Validate ID parameter (integer or UUID).

```javascript
router.get('/api/products/:id', validateIdParam('integer'), handler)
router.get('/api/users/:id', validateIdParam('uuid'), handler)
```

### requireFields
Ensure required fields in request body.

```javascript
router.post('/api/products', requireFields('name', 'price'), handler)
// Returns 400 if name or price is missing
```

### parseBooleanParams
Parse boolean query params.

```javascript
const parsed = parseBooleanParams(req.query, ['featured', 'in_stock'])
// ?featured=true&in_stock=1
// => { featured: true, in_stock: true }
```

### parseArrayParams
Parse comma-separated arrays.

```javascript
const parsed = parseArrayParams(req.query, ['tags', 'categories'])
// ?tags=tech,gadgets&categories=electronics
// => { tags: ['tech', 'gadgets'], categories: ['electronics'] }
```

### extractAllowedFields
Whitelist fields from request body.

```javascript
const data = extractAllowedFields(req.body, ['name', 'price', 'description'])
// Prevents mass assignment vulnerabilities
```

### successResponse / errorResponse
Format standard responses.

```javascript
res.json(successResponse(data, { message: 'Product created' }))
res.status(400).json(errorResponse('Invalid input', { code: 'VALIDATION_ERROR' }))
```

## 📋 Repository Interface

Your repository must implement these methods to work with CRUD helpers:

```javascript
class ProductRepo {
  // Required for handleList
  async findAll({ whereClause, params, orderBy, limit, offset }) {
    // Return array of items
  }
  
  // Required for handleList
  async count({ whereClause, params }) {
    // Return total count (integer)
  }
  
  // Required for handleGetById, handleUpdate, handleDelete
  async findById(id) {
    // Return single item or null
  }
  
  // Required for handleCreate
  async create(data) {
    // Return created item
  }
  
  // Required for handleUpdate
  async update(id, data) {
    // Return updated item
  }
  
  // Required for handleDelete
  async delete(id) {
    // Delete item (no return value)
  }
  
  // Optional: for handleDelete with hardDelete: false
  async softDelete(id) {
    // Soft delete (e.g., set deleted_at)
  }
}
```

See [examples.js](./examples.js) for a complete implementation.

## 🎯 Query Examples

### Basic Queries
```bash
# Pagination
GET /api/products?page=1&limit=20
GET /api/products?offset=0&limit=20

# Search
GET /api/products?q=laptop
GET /api/products?q=gaming&fields=name,description

# Filtering
GET /api/products?category=electronics
GET /api/products?category=electronics&in_stock=true

# Sorting
GET /api/products?sort=price&order=asc
GET /api/products?sort=created_at&order=desc
```

### Advanced Queries
```bash
# Combined search, filter, sort, paginate
GET /api/products?q=laptop&category=electronics&sort=price&order=asc&page=1&limit=20

# Range filters
GET /api/products?price_min=100&price_max=1000

# Array filters (IN clause)
GET /api/products?brands=dell,hp,lenovo

# Date filters
GET /api/products?created_after=2024-01-01

# Boolean filters
GET /api/products?featured=true&in_stock=true
```

## 🔒 Security

### SQL Injection Protection
All helpers use parameterized queries with PostgreSQL `$N` placeholders.

```javascript
// ✅ Safe - uses parameters
const { whereClause, params } = buildWhereClause({
  filters: { category: req.query.category },
})

// ❌ Unsafe - string concatenation
const sql = `WHERE category = '${req.query.category}'`
```

### Whitelist Sortable Fields
Always whitelist sortable fields to prevent SQL injection.

```javascript
buildOrderByClause({
  sortBy: req.query.sort,
  allowedFields: ['name', 'price'], // Whitelist
  defaultSort: 'created_at',
})
```

### Mass Assignment Protection
Use `extractAllowedFields` to whitelist body fields.

```javascript
const data = extractAllowedFields(req.body, ['name', 'price'])
// Only name and price can be updated
```

## 📖 Complete Examples

See [examples.js](./examples.js) for:
- Auto-generated CRUD router
- CRUD with authentication
- Manual CRUD with search
- Advanced filtering
- Repository implementation
- Query parameter examples

## 🐛 Troubleshooting

### "handleList is not a function"
Import from the correct path:
```javascript
const { handleList } = require('./lib/@system/Helpers')
```

### Pagination not working
Ensure middleware runs before handler:
```javascript
router.get('/api/products', pagination(), handler) // ✅
```

### Search returns no results
Check repository's `findAll` uses `whereClause` and `params`:
```javascript
async findAll({ whereClause, params, limit, offset }) {
  const { sql } = buildSelect('products', {
    whereClause,
    whereParams: params,
    limit,
    offset,
  })
  return (await db.query(sql, params)).rows
}
```

### Wrong placeholder style
This library uses PostgreSQL's `$1, $2, $3` style, NOT `?` style.

## 📚 Additional Resources

- [API Scaffolding Guide](../../../../API_SCAFFOLDING_GUIDE.md) - Complete guide
- [Quick Start Guide](./QUICK-START.md) - Getting started
- [Cheat Sheet](./CHEATSHEET.md) - Quick reference
- [Examples](./examples.js) - Working code examples

## 🤝 Contributing

When adding new helpers:
1. Use PostgreSQL parameterized queries ($1, $2, etc.)
2. Add JSDoc comments
3. Include examples in examples.js
4. Add tests if available
5. Update this README

## 📝 License

Part of the product-template system.
