# Middleware Guide

> Purpose: reference for `pagination()`, `sorting()`, `filtering()` / `advancedFiltering()` and `formatPaginatedResponse()` in `server/src/lib/@system/Middleware`. Security middleware (cors, csrf, securityHeaders) is documented in `docs/SECURITY.md`; zod `validate()` in `docs/API.md`.
> Last verified: 2026-09-20.

Complete guide to the built-in middleware for pagination, sorting, and filtering.

## Table of Contents

- [Pagination](#pagination)
- [Sorting](#sorting)
- [Filtering](#filtering)
- [Combined Usage](#combined-usage)
- [Complete Examples](#complete-examples)

---

## Pagination

Parse and validate pagination parameters from query strings.

### Basic Usage

```javascript
const express = require('express')
const { pagination } = require('./lib/@system/Middleware')
const router = express.Router()

router.get('/api/products', pagination(), async (req, res) => {
  // req.pagination is now available
  const { limit, offset, page } = req.pagination
  
  // Use with your database query
  const products = await db.query(
    'SELECT * FROM products LIMIT $1 OFFSET $2',
    [limit, offset]
  )
  
  res.json({ products, page, limit })
})
```

### Options

```javascript
pagination({
  defaultLimit: 20,     // Default page size (default: 20)
  maxLimit: 100,        // Maximum allowed page size (default: 100)
  allowAll: false,      // Allow limit=-1 for all results (default: false)
})
```

### Query Parameters

- `?page=2&limit=10` - Page-based pagination
- `?offset=20&limit=10` - Offset-based pagination
- `?limit=50` - Custom page size

### Response Format

Use `formatPaginatedResponse` to format the response:

```javascript
const { formatPaginatedResponse } = require('./lib/@system/Middleware')

const products = await fetchProducts(req.pagination)
const total = await countProducts()

res.json(formatPaginatedResponse(products, total, req.pagination))
```

Returns:

```json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 40,
  "page": 3,
  "total_pages": 8,
  "has_more": true
}
```

---

## Sorting

Parse and validate sort parameters from query strings.

### Basic Single Sort

```javascript
const { sorting } = require('./lib/@system/Middleware')

router.get('/api/products', 
  sorting({
    allowedFields: ['name', 'price', 'created_at'],
    defaultField: 'created_at',
    defaultOrder: 'desc',
  }),
  async (req, res) => {
    const { field, order, clause } = req.sorting
    
    // Use the clause directly in SQL
    const products = await db.query(
      `SELECT * FROM products ORDER BY ${clause}`,
    )
    
    res.json({ products })
  }
)
```

### Multi-Field Sorting

```javascript
const { multiSort } = require('./lib/@system/Middleware')

router.get('/api/products',
  multiSort({
    allowedFields: ['category', 'price', 'name', 'created_at'],
    defaultSort: 'category:asc,price:desc',
    maxSorts: 3,
  }),
  async (req, res) => {
    // req.sorting.clause contains the full ORDER BY clause
    const { clause } = req.sorting
    
    const products = await db.query(
      `SELECT * FROM products ORDER BY ${clause}`,
    )
    
    res.json({ products })
  }
)
```

### Query Parameters

- `?sort=price&order=asc` - Single field sort
- `?sort=name:asc` - Single field with embedded order
- `?sort=category:asc,price:desc,name:asc` - Multi-field sort

### Options

```javascript
sorting({
  allowedFields: [],      // Required: whitelist of sortable fields
  defaultField: 'created_at',  // Default sort field
  defaultOrder: 'desc',   // Default sort order ('asc' or 'desc')
  fieldParam: 'sort',     // Query param name for field
  orderParam: 'order',    // Query param name for order
})

multiSort({
  allowedFields: [],      // Required: whitelist of sortable fields
  defaultSort: 'created_at:desc',  // Default sort string
  sortParam: 'sort',      // Query param name
  maxSorts: 3,            // Maximum number of sort fields
})
```

---

## Filtering

Parse and validate filter parameters from query strings.

### Basic Filtering

```javascript
const { filtering } = require('./lib/@system/Middleware')

router.get('/api/products',
  filtering({
    allowedFields: ['category', 'in_stock', 'price', 'brand'],
    booleanFields: ['in_stock', 'featured'],
    numberFields: ['price'],
    arrayFields: ['tags'],
  }),
  async (req, res) => {
    // req.filters contains parsed and validated filters
    const filters = req.filters
    
    // Build WHERE clause manually or use query builder
    const products = await ProductRepo.findAll({ filters })
    
    res.json({ products })
  }
)
```

### Advanced Filtering with Operators

```javascript
const { advancedFiltering } = require('./lib/@system/Middleware')

router.get('/api/products',
  advancedFiltering({
    allowedFields: ['name', 'price', 'category', 'created_at'],
    fieldTypes: {
      price: 'number',
      created_at: 'date',
      name: 'string',
    },
  }),
  async (req, res) => {
    // req.filters contains filters, params, and whereClause
    const { whereClause, params } = req.filters
    
    const products = await db.query(
      `SELECT * FROM products WHERE ${whereClause}`,
      params
    )
    
    res.json({ products })
  }
)
```

### Query Parameters

**Basic filtering:**
- `?category=electronics` - Simple equality filter
- `?in_stock=true` - Boolean filter
- `?tags=laptop,gaming` - Array filter

**Advanced filtering:**
- `?price[gte]=100&price[lte]=500` - Range filter
- `?name[like]=laptop` - Pattern matching
- `?status[in]=active,pending` - IN clause
- `?created_at[gt]=2024-01-01` - Date comparison

### Supported Operators

- `eq` - Equals (=)
- `ne` - Not equals (!=)
- `gt` - Greater than (>)
- `gte` - Greater than or equal (>=)
- `lt` - Less than (<)
- `lte` - Less than or equal (<=)
- `in` - In array (IN)
- `nin` - Not in array (NOT IN)
- `like` - Pattern match (LIKE)
- `ilike` - Case-insensitive pattern match (ILIKE)

### Options

```javascript
filtering({
  allowedFields: [],      // Required: whitelist of filterable fields
  fieldTypes: {},         // Field type mappings
  booleanFields: [],      // Fields parsed as booleans
  numberFields: [],       // Fields parsed as numbers
  arrayFields: [],        // Fields parsed as arrays
  dateFields: [],         // Fields parsed as dates
})

advancedFiltering({
  allowedFields: [],      // Required: whitelist of filterable fields
  allowedOperators: ['eq', 'ne', 'gt', ...],  // Allowed operators
  fieldTypes: {},         // Field type mappings
})
```

---

## Combined Usage

Use all three middleware together for complete API functionality:

```javascript
const { pagination, multiSort, advancedFiltering } = require('./lib/@system/Middleware')

router.get('/api/products',
  pagination({ defaultLimit: 20, maxLimit: 100 }),
  multiSort({
    allowedFields: ['name', 'price', 'popularity', 'created_at'],
    defaultSort: 'popularity:desc',
  }),
  advancedFiltering({
    allowedFields: ['category', 'brand', 'price', 'in_stock', 'created_at'],
    fieldTypes: {
      price: 'number',
      in_stock: 'boolean',
      created_at: 'date',
    },
  }),
  async (req, res) => {
    const { limit, offset } = req.pagination
    const { clause: orderBy } = req.sorting
    const { whereClause, params } = req.filters
    
    // Build complete query
    let sql = 'SELECT * FROM products'
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`
    }
    
    sql += ` ORDER BY ${orderBy}`
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    
    const products = await db.query(sql, [...params, limit, offset])
    const total = await db.query(
      `SELECT COUNT(*) FROM products ${whereClause ? 'WHERE ' + whereClause : ''}`,
      params
    )
    
    const { formatPaginatedResponse } = require('./lib/@system/Middleware')
    res.json(formatPaginatedResponse(
      products.rows,
      parseInt(total.rows[0].count),
      req.pagination
    ))
  }
)
```

### Example Query

```
GET /api/products?
  page=2&
  limit=20&
  sort=popularity:desc,price:asc&
  category=electronics&
  price[gte]=100&
  price[lte]=1000&
  in_stock=true
```

This would:
- Return page 2 with 20 items
- Sort by popularity descending, then price ascending
- Filter to electronics category
- Filter price between $100-$1000
- Filter to only in-stock items

---

## Complete Examples

### Example 1: Simple List with Pagination

```javascript
const express = require('express')
const { pagination, formatPaginatedResponse } = require('./lib/@system/Middleware')
const router = express.Router()

router.get('/api/products',
  pagination(),
  async (req, res) => {
    const { limit, offset } = req.pagination
    
    const products = await db.query(
      'SELECT * FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    )
    
    const { rows: [{ count }] } = await db.query(
      'SELECT COUNT(*) as count FROM products'
    )
    
    res.json(formatPaginatedResponse(
      products.rows,
      parseInt(count),
      req.pagination
    ))
  }
)
```

### Example 2: Search with Sorting

```javascript
const { pagination, sorting } = require('./lib/@system/Middleware')

router.get('/api/products/search',
  pagination(),
  sorting({
    allowedFields: ['name', 'price', 'popularity'],
    defaultField: 'popularity',
  }),
  async (req, res) => {
    const { q } = req.query
    const { limit, offset } = req.pagination
    const { clause: orderBy } = req.sorting
    
    const products = await db.query(
      `SELECT * FROM products 
       WHERE name ILIKE $1 OR description ILIKE $1
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, limit, offset]
    )
    
    res.json({ products: products.rows })
  }
)
```

### Example 3: Full-Featured API Endpoint

```javascript
const {
  pagination,
  multiSort,
  advancedFiltering,
  formatPaginatedResponse,
} = require('./lib/@system/Middleware')

router.get('/api/products',
  pagination({ defaultLimit: 20, maxLimit: 100 }),
  multiSort({
    allowedFields: ['name', 'price', 'popularity', 'created_at'],
    defaultSort: 'popularity:desc',
    maxSorts: 2,
  }),
  advancedFiltering({
    allowedFields: ['category', 'brand', 'price', 'in_stock', 'rating', 'created_at'],
    fieldTypes: {
      price: 'number',
      rating: 'number',
      in_stock: 'boolean',
      created_at: 'date',
    },
  }),
  async (req, res, next) => {
    try {
      const { limit, offset } = req.pagination
      const { clause: orderBy } = req.sorting
      const { whereClause, params } = req.filters
      
      // Build query
      let sql = 'SELECT * FROM products'
      let countSql = 'SELECT COUNT(*) as count FROM products'
      
      if (whereClause) {
        sql += ` WHERE ${whereClause}`
        countSql += ` WHERE ${whereClause}`
      }
      
      sql += ` ORDER BY ${orderBy}`
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      
      // Execute queries
      const [products, total] = await Promise.all([
        db.query(sql, [...params, limit, offset]),
        db.query(countSql, params),
      ])
      
      // Format and send response
      res.json(formatPaginatedResponse(
        products.rows,
        parseInt(total.rows[0].count),
        req.pagination
      ))
    } catch (err) {
      next(err)
    }
  }
)
```

---

## Tips & Best Practices

### 1. Security

- **Always use allowedFields whitelist** - Never allow arbitrary field names
- **Validate data types** - Use fieldTypes to ensure proper type conversion
- **Limit max values** - Set reasonable maxLimit and maxSorts limits
- **Use parameterized queries** - The middleware generates proper $1, $2, etc. placeholders

### 2. Performance

- **Add database indexes** - Create indexes on commonly sorted/filtered fields
- **Limit page sizes** - Set reasonable maxLimit (e.g., 100) to prevent large queries
- **Use COUNT(*) wisely** - Consider caching counts for large tables
- **Optimize ORDER BY** - Multiple sorts can be slow without proper indexes

### 3. User Experience

- **Provide defaults** - Set sensible defaultField, defaultOrder, defaultLimit
- **Document query params** - Include examples in API documentation
- **Return metadata** - Use formatPaginatedResponse for consistent responses
- **Handle errors gracefully** - Middleware returns 400 for invalid params

### 4. Testing

```javascript
// Example test
describe('GET /api/products', () => {
  it('should paginate results', async () => {
    const res = await request(app)
      .get('/api/products?page=2&limit=10')
      .expect(200)
    
    expect(res.body.page).toBe(2)
    expect(res.body.limit).toBe(10)
    expect(res.body.data.length).toBeLessThanOrEqual(10)
  })
  
  it('should sort by price ascending', async () => {
    const res = await request(app)
      .get('/api/products?sort=price&order=asc')
      .expect(200)
    
    const prices = res.body.data.map(p => p.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })
  
  it('should filter by category', async () => {
    const res = await request(app)
      .get('/api/products?category=electronics')
      .expect(200)
    
    expect(res.body.data.every(p => p.category === 'electronics')).toBe(true)
  })
})
```

---

## Integration with CRUD Helpers

These middleware work seamlessly with the CRUD helpers:

```javascript
const { handleList, pagination, multiSort, advancedFiltering } = require('./lib/@system/Helpers')

router.get('/api/products',
  pagination(),
  multiSort({ allowedFields: ['name', 'price'] }),
  advancedFiltering({ allowedFields: ['category', 'in_stock'] }),
  async (req, res, next) => {
    await handleList({
      repo: ProductRepo,
      req, res, next,
      filters: {
        whereClause: req.filters.whereClause,
        params: req.filters.params,
        orderBy: req.sorting.clause,
      },
    })
  }
)
```

Or use the auto-generated CRUD router which handles everything:

```javascript
const { createCrudRouter } = require('./lib/@system/Helpers')

module.exports = createCrudRouter({
  repo: ProductRepo,
  config: {
    basePath: '/api/products',
    // Pagination, sorting, and filtering are automatically applied!
  },
})
```

---

## See Also

- [CRUD Helpers](../Helpers/README.md)
- [API Scaffolding Guide](../../../../API_SCAFFOLDING_GUIDE.md)
- [Query Builders](../Helpers/query-builder.js)
- [Search Helpers](../Helpers/search.js)
