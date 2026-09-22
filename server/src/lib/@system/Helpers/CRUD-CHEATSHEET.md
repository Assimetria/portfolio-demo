# CRUD API Cheatsheet

> Purpose: repository + schema + router recipe for a CRUD resource using `BaseRepository`, zod and `createCrudRouter`. Declare paths relative to `/api` when registering through `server/src/routes/@custom/index.js`.
> Last verified: 2026-09-20.

Quick reference for building CRUD endpoints with minimal code.

## 1. Create Repository (Extend BaseRepository)

```javascript
// server/src/db/repos/@custom/ProductRepo.js
const { BaseRepository } = require('../../lib/@system/Helpers')
const db = require('../../lib/@system/PostgreSQL')

class ProductRepository extends BaseRepository {
  constructor() {
    super(db, 'products', { idColumn: 'id' })
  }
  
  // Add custom methods as needed
  async findByCategory(category) {
    return this.findBy({ category })
  }
}

module.exports = new ProductRepository()
```

## 2. Create Validation Schemas

```javascript
// server/src/api/@custom/products/schemas.js
const { z } = require('zod')

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  category: z.enum(['electronics', 'books', 'clothing']),
})

const UpdateProductSchema = CreateProductSchema.partial()

module.exports = {
  CreateProductSchema: { body: CreateProductSchema },
  UpdateProductSchema: { body: UpdateProductSchema },
}
```

## 3. Create API Route (Option A: Auto CRUD Router)

```javascript
// server/src/api/@custom/products/index.js
const { createCrudRouter } = require('../../../lib/@system/Helpers')
const ProductRepo = require('../../../db/repos/@custom/ProductRepo')
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const { CreateProductSchema, UpdateProductSchema } = require('./schemas')

module.exports = createCrudRouter({
  repo: ProductRepo,
  
  validation: {
    create: CreateProductSchema,
    update: UpdateProductSchema,
  },
  
  middleware: {
    create: [authenticate],
    update: [authenticate],
    delete: [authenticate],
  },
  
  config: {
    basePath: '/api/products',
    dataKey: 'product',
  },
})
```

**Done!** This creates 5 endpoints:
- `GET /api/products` - List with pagination, search, sorting
- `GET /api/products/:id` - Get by ID
- `POST /api/products` - Create (authenticated)
- `PATCH /api/products/:id` - Update (authenticated)
- `DELETE /api/products/:id` - Delete (authenticated)

## 4. Create API Route (Option B: Manual with Helpers)

```javascript
// server/src/api/@custom/products/index.js
const express = require('express')
const router = express.Router()
const {
  handleList,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,
  pagination,
  validate,
  asyncHandler,
  validateIdParam,
  authenticate,
  parseQueryParams,
} = require('../../../lib/@system/Helpers')

const ProductRepo = require('../../../db/repos/@custom/ProductRepo')
const { CreateProductSchema, UpdateProductSchema } = require('./schemas')

// LIST
router.get(
  '/api/products',
  pagination(),
  asyncHandler((req, res, next) => {
    const queryConfig = parseQueryParams(req, {
      searchFields: ['name', 'description'],
      sortableFields: ['name', 'price', 'created_at'],
      filterFields: ['category', 'status'],
      booleanFields: ['is_active'],
    })
    
    handleList({
      repo: ProductRepo,
      req, res, next,
      filters: queryConfig,
      dataKey: 'products',
    })
  })
)

// GET BY ID
router.get(
  '/api/products/:id',
  validateIdParam('integer'),
  asyncHandler((req, res, next) => {
    handleGetById({
      repo: ProductRepo,
      req, res, next,
      dataKey: 'product',
    })
  })
)

// CREATE
router.post(
  '/api/products',
  authenticate,
  validate(CreateProductSchema),
  asyncHandler((req, res, next) => {
    handleCreate({
      repo: ProductRepo,
      req, res, next,
      transformData: async (body, req) => ({
        ...body,
        user_id: req.user.id,
        created_at: new Date().toISOString(),
      }),
      dataKey: 'product',
    })
  })
)

// UPDATE
router.patch(
  '/api/products/:id',
  authenticate,
  validateIdParam('integer'),
  validate(UpdateProductSchema),
  asyncHandler((req, res, next) => {
    handleUpdate({
      repo: ProductRepo,
      req, res, next,
      transformData: async (body) => ({
        ...body,
        updated_at: new Date().toISOString(),
      }),
      dataKey: 'product',
    })
  })
)

// DELETE
router.delete(
  '/api/products/:id',
  authenticate,
  validateIdParam('integer'),
  asyncHandler((req, res, next) => {
    handleDelete({
      repo: ProductRepo,
      req, res, next,
      hardDelete: false,
    })
  })
)

module.exports = router
```

## 5. Register Route

```javascript
// server/src/routes/@custom/index.js
const productsRoutes = require('../../api/@custom/products')

module.exports = (app) => {
  app.use(productsRoutes)
}
```

## Common Query Examples

```bash
# List with pagination
GET /api/products?page=1&limit=20

# Search
GET /api/products?q=laptop

# Filter
GET /api/products?category=electronics&status=active

# Sort
GET /api/products?sort=price&order=asc

# Advanced filter
GET /api/products?price[gte]=100&price[lte]=500

# Combine all
GET /api/products?q=laptop&category=electronics&sort=price&order=asc&page=1&limit=20
```

## Response Format

**List:**
```json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 0,
  "page": 1,
  "total_pages": 8,
  "has_more": true
}
```

**Single:**
```json
{
  "product": { "id": 1, "name": "...", ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Product not found"
}
```

## Custom Endpoints

Add custom endpoints alongside CRUD:

```javascript
// PUBLISH
router.post(
  '/api/products/:id/publish',
  authenticate,
  validateIdParam('integer'),
  asyncHandler(async (req, res) => {
    const product = await ProductRepo.findById(req.params.id)
    
    if (!product) {
      return notFound(res, 'Product not found')
    }
    
    const updated = await ProductRepo.update(product.id, {
      status: 'published',
      published_at: new Date().toISOString(),
    })
    
    return success(res, updated, 'Product published')
  })
)

// STATS
router.get(
  '/api/products/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    const stats = await ProductRepo.query(
      'SELECT COUNT(*) as total, AVG(price) as avg_price FROM products'
    )
    return success(res, stats.rows[0])
  })
)
```

## Tips

1. **Use `asyncHandler`** - Automatically catches errors
2. **Use `validateIdParam`** - Validates ID format
3. **Use `transformData`** - Add user context, timestamps, validation
4. **Use `parseQueryParams`** - Parse search, filters, sorting all at once
5. **Extend BaseRepository** - Get CRUD methods for free

## See Also

- Full docs: `/docs/API-SCAFFOLDING.md`
- Template: `/api/@custom/TEMPLATE.js`
- Examples: `/lib/@system/Helpers/examples.js`
