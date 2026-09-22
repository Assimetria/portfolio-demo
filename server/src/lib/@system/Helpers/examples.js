/**
 * API Scaffolding Examples
 * 
 * Practical examples showing how to use the CRUD helpers, pagination, and search
 */

const express = require('express')
const {
  pagination,
  handleList,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,
  createCrudRouter,
  parseSearchQuery,
  buildWhereClause,
  buildOrderByClause,
  asyncHandler,
  validateIdParam,
  parseQueryParams,
} = require('./index')

// ===================================================================
// EXAMPLE 1: Auto-Generated CRUD Router (Fastest Way)
// ===================================================================

/**
 * Zero-config CRUD API
 * Automatically creates all 5 endpoints (list, get, create, update, delete)
 */
function example1_AutoCrudRouter(ProductRepo) {
  return createCrudRouter({
    repo: ProductRepo,
    config: {
      basePath: '/api/products',
      dataKey: 'product',
      messages: {
        notFound: 'Product not found',
        deleted: 'Product deleted successfully',
      },
    },
  })
}

// ===================================================================
// EXAMPLE 2: Auto CRUD with Authentication & Validation
// ===================================================================

/**
 * CRUD API with middleware and validation
 */
function example2_CrudWithAuth(ProductRepo, { authenticate, requireAdmin }) {
  const { z } = require('zod')
  
  const CreateProductSchema = {
    body: z.object({
      name: z.string().min(1).max(200),
      price: z.number().positive(),
      category: z.enum(['electronics', 'clothing', 'books']),
      description: z.string().optional(),
    }),
  }
  
  const UpdateProductSchema = {
    body: z.object({
      name: z.string().min(1).max(200).optional(),
      price: z.number().positive().optional(),
      category: z.enum(['electronics', 'clothing', 'books']).optional(),
      description: z.string().optional(),
    }),
  }
  
  return createCrudRouter({
    repo: ProductRepo,
    validation: {
      create: CreateProductSchema,
      update: UpdateProductSchema,
    },
    middleware: {
      list: [authenticate],
      get: [authenticate],
      create: [authenticate, requireAdmin],
      update: [authenticate, requireAdmin],
      delete: [authenticate, requireAdmin],
    },
    config: {
      basePath: '/api/products',
      dataKey: 'product',
    },
  })
}

// ===================================================================
// EXAMPLE 3: Manual CRUD with Search & Filters
// ===================================================================

/**
 * Custom CRUD endpoints with full search, filter, and sort support
 */
function example3_ManualCrudWithSearch(ArticleRepo) {
  const router = express.Router()
  
  // LIST with search, filters, pagination, sorting
  router.get(
    '/api/articles',
    pagination(),
    asyncHandler(async (req, res, next) => {
      // Parse query parameters all at once
      const queryConfig = parseQueryParams(req, {
        searchFields: ['title', 'content', 'tags'],
        sortableFields: ['title', 'published_at', 'view_count', 'created_at'],
        filterFields: ['author_id', 'status', 'category'],
        booleanFields: ['featured', 'published'],
        arrayFields: ['tags'],
      })
      
      await handleList({
        repo: ArticleRepo,
        req,
        res,
        next,
        filters: {
          whereClause: queryConfig.whereClause,
          params: queryConfig.params,
          orderBy: queryConfig.orderBy,
        },
        dataKey: 'articles',
      })
    })
  )
  
  // GET by ID
  router.get(
    '/api/articles/:id',
    validateIdParam('integer'),
    asyncHandler(async (req, res, next) => {
      await handleGetById({
        repo: ArticleRepo,
        req,
        res,
        next,
        dataKey: 'article',
        notFoundMessage: 'Article not found',
      })
    })
  )
  
  // CREATE with user context injection
  router.post(
    '/api/articles',
    asyncHandler(async (req, res, next) => {
      await handleCreate({
        repo: ArticleRepo,
        req,
        res,
        next,
        transformData: async (body, req) => ({
          ...body,
          author_id: req.user.id,
          slug: slugify(body.title),
          created_at: new Date().toISOString(),
        }),
        dataKey: 'article',
        statusCode: 201,
      })
    })
  )
  
  // UPDATE with authorization check
  router.patch(
    '/api/articles/:id',
    validateIdParam('integer'),
    asyncHandler(async (req, res, next) => {
      await handleUpdate({
        repo: ArticleRepo,
        req,
        res,
        next,
        transformData: async (body, req, existing) => {
          // Only author or admin can update
          if (existing.author_id !== req.user.id && !req.user.is_admin) {
            throw new Error('Unauthorized to update this article')
          }
          
          return {
            ...body,
            updated_at: new Date().toISOString(),
          }
        },
        dataKey: 'article',
      })
    })
  )
  
  // DELETE (soft delete)
  router.delete(
    '/api/articles/:id',
    validateIdParam('integer'),
    asyncHandler(async (req, res, next) => {
      await handleDelete({
        repo: ArticleRepo,
        req,
        res,
        next,
        hardDelete: false, // Soft delete
        notFoundMessage: 'Article not found',
        successMessage: 'Article deleted successfully',
      })
    })
  )
  
  return router
}

// ===================================================================
// EXAMPLE 4: Complex Search & Filtering
// ===================================================================

/**
 * Advanced search with multiple filters and custom SQL operators
 */
function example4_AdvancedSearch() {
  const router = express.Router()
  
  router.get(
    '/api/products/search',
    pagination({ defaultLimit: 50, maxLimit: 200 }),
    asyncHandler(async (req, res) => {
      // Parse search query
      const search = parseSearchQuery(req.query, {
        defaultFields: ['name', 'description', 'brand'],
      })
      
      // Build complex filters
      const filters = {}
      
      // Simple filters
      if (req.query.category) filters.category = req.query.category
      if (req.query.in_stock) filters.in_stock = req.query.in_stock === 'true'
      
      // Range filters (custom SQL operators)
      if (req.query.price_min) {
        filters['price >='] = parseFloat(req.query.price_min)
      }
      if (req.query.price_max) {
        filters['price <='] = parseFloat(req.query.price_max)
      }
      
      // Date filters
      if (req.query.created_after) {
        filters['created_at >'] = req.query.created_after
      }
      
      // Array filters (IN clause)
      if (req.query.brands) {
        filters.brand = req.query.brands.split(',')
      }
      
      // Build WHERE clause
      const { whereClause, params } = buildWhereClause({
        searchQuery: search.query,
        searchFields: search.fields,
        filters,
        searchMode: 'contains',
      })
      
      // Build ORDER BY
      const orderBy = buildOrderByClause({
        sortBy: req.query.sort,
        sortOrder: req.query.order,
        allowedFields: ['name', 'price', 'popularity', 'created_at'],
        defaultSort: 'popularity',
      })
      
      // Execute query
      const ProductRepo = require('../../../db/repos/@custom/ProductRepo')
      
      const queryParams = {
        whereClause,
        params,
        orderBy,
        limit: req.pagination.limit,
        offset: req.pagination.offset,
      }
      
      const [products, total] = await Promise.all([
        ProductRepo.findAll(queryParams),
        ProductRepo.count({ whereClause, params }),
      ])
      
      const { formatPaginatedResponse } = require('../Middleware/pagination')
      const response = formatPaginatedResponse(products, total, req.pagination)
      
      res.json({
        ...response,
        products: response.data,
        data: undefined,
        search: {
          query: search.query,
          fields: search.fields,
        },
        filters: req.query,
      })
    })
  )
  
  return router
}

// ===================================================================
// EXAMPLE 5: Repository Implementation Example
// ===================================================================

/**
 * Example repository that works with all CRUD helpers
 */
class ExampleProductRepo {
  constructor(db) {
    this.db = db
  }
  
  /**
   * Find all items (required for handleList)
   */
  async findAll({ whereClause, params, orderBy, limit, offset }) {
    const { buildSelect } = require('./query-builder')
    
    const { sql, params: queryParams } = buildSelect('products', {
      whereClause: whereClause ? whereClause.replace('WHERE ', '') : '',
      whereParams: params || [],
      orderBy: orderBy ? orderBy.replace('ORDER BY ', '') : '',
      limit,
      offset,
    })
    
    const result = await this.db.query(sql, queryParams)
    return result.rows
  }
  
  /**
   * Count items (required for handleList)
   */
  async count({ whereClause, params }) {
    const { buildCount } = require('./query-builder')
    
    const { sql, params: queryParams } = buildCount('products', {
      whereClause: whereClause ? whereClause.replace('WHERE ', '') : '',
      whereParams: params || [],
    })
    
    const result = await this.db.query(sql, queryParams)
    return parseInt(result.rows[0].count, 10)
  }
  
  /**
   * Find by ID (required for handleGetById, handleUpdate, handleDelete)
   */
  async findById(id) {
    const result = await this.db.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }
  
  /**
   * Create (required for handleCreate)
   */
  async create(data) {
    const { buildInsert } = require('./query-builder')
    
    const { sql, params } = buildInsert('products', data, { returning: true })
    const result = await this.db.query(sql, params)
    return result.rows[0]
  }
  
  /**
   * Update (required for handleUpdate)
   */
  async update(id, data) {
    const { buildUpdate } = require('./query-builder')
    
    const { sql, params } = buildUpdate('products', data, id, { returning: true })
    const result = await this.db.query(sql, params)
    return result.rows[0]
  }
  
  /**
   * Delete (required for handleDelete)
   */
  async delete(id) {
    await this.db.query('DELETE FROM products WHERE id = $1', [id])
  }
  
  /**
   * Soft delete (optional, for handleDelete with hardDelete: false)
   */
  async softDelete(id) {
    await this.db.query(
      'UPDATE products SET deleted_at = NOW() WHERE id = $1',
      [id]
    )
  }
}

// ===================================================================
// EXAMPLE 6: Query Parameter Examples
// ===================================================================

/**
 * Example API calls showing query parameter usage
 */
const QueryExamples = {
  // Basic pagination
  page1: '/api/products?page=1&limit=20',
  page2: '/api/products?page=2&limit=20',
  offset: '/api/products?offset=40&limit=20',
  
  // Search
  simpleSearch: '/api/products?q=laptop',
  searchSpecificFields: '/api/products?q=gaming&fields=name,description',
  
  // Filtering
  singleFilter: '/api/products?category=electronics',
  multipleFilters: '/api/products?category=electronics&in_stock=true',
  
  // Sorting
  sortAsc: '/api/products?sort=price&order=asc',
  sortDesc: '/api/products?sort=created_at&order=desc',
  
  // Combined
  fullQuery: '/api/products?q=laptop&category=electronics&sort=price&order=asc&page=1&limit=20',
  
  // Advanced filters
  rangeFilters: '/api/products?price_min=100&price_max=1000&in_stock=true',
  arrayFilter: '/api/products?brands=dell,hp,lenovo',
  dateFilter: '/api/products?created_after=2024-01-01',
}

// ===================================================================
// Helper: Slugify function for examples
// ===================================================================

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

module.exports = {
  example1_AutoCrudRouter,
  example2_CrudWithAuth,
  example3_ManualCrudWithSearch,
  example4_AdvancedSearch,
  ExampleProductRepo,
  QueryExamples,
}
