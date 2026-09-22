/**
 * API Template - Copy this for new resources
 *
 * This template demonstrates the recommended manual CRUD approach with
 * helpers. It covers:
 * - Search, filtering, sorting
 * - Pagination
 * - Validation
 * - Authentication
 *
 * For other patterns, see the companion templates:
 *   - templates/TEMPLATE_auto_crud.js         Option 1 — auto-generated CRUD
 *                                             (zero boilerplate, minimal control)
 *   - templates/TEMPLATE_custom_endpoints.js  Custom endpoints beyond CRUD
 *                                             (publish, bulk-delete, stats, duplicate)
 *   - templates/TEMPLATE_repo.js              Repository interface reference
 *                                             (methods your Repo should implement)
 *   - templates/TEMPLATE_schemas.js           Zod validation schemas reference
 *
 * Choose the approach that fits your needs. This file focuses on
 * "Option 2: Manual CRUD with Helpers" — the recommended default.
 */

// ═══════════════════════════════════════════════════════════════════════════
// OPTION 2: Manual CRUD with Helpers (Recommended)
// ═══════════════════════════════════════════════════════════════════════════

const express = require('express')
const router = express.Router()

// Import helpers
const {
  // CRUD handlers
  handleList,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,

  // Search & filtering
  parseSearchQuery,
  buildWhereClause,
  buildOrderByClause,

  // Query parsing
  parseQueryParams,
  parseBooleanParams,
  parseArrayParams,

  // Utilities
  asyncHandler,
  validateIdParam,
  extractAllowedFields,
  successResponse,
  errorResponse,

  // Auth
  authenticate,
  requireAdmin,
} = require('../../lib/@system/Helpers')

const {
  pagination,
  validate,
} = require('../../lib/@system/Middleware')

// Repository (you'll create this)
const ResourceRepo = require('../../db/repos/@custom/ResourceRepo')

// Validation schemas (you'll create these)
const {
  CreateResourceSchema,
  UpdateResourceSchema,
  ListResourcesSchema,
  ResourceIdSchema,
} = require('./schemas')

// ───────────────────────────────────────────────────────────────────────────
// LIST - /api/resources
// GET ?q=search&category=x&status=active&sort=created_at&order=desc&page=1&limit=20
// ───────────────────────────────────────────────────────────────────────────

router.get(
  '/api/resources',
  pagination({ defaultLimit: 20, maxLimit: 100 }),
  validate(ListResourcesSchema),
  asyncHandler(async (req, res, next) => {
    // Option A: Parse all params automatically
    const queryConfig = parseQueryParams(req, {
      searchFields: ['name', 'description'],
      sortableFields: ['name', 'created_at', 'updated_at', 'status'],
      filterFields: ['category', 'status', 'user_id'],
      booleanFields: ['is_active', 'is_featured'],
      arrayFields: ['tags'],
    })

    // Use the CRUD handler
    await handleList({
      repo: ResourceRepo,
      req,
      res,
      next,
      filters: {
        whereClause: queryConfig.whereClause,
        params: queryConfig.params,
        orderBy: queryConfig.orderBy,
      },
      dataKey: 'resources',
    })

    // Option B: Manual control (more flexibility)
    /*
    const search = parseSearchQuery(req.query, {
      defaultFields: ['name', 'description'],
    })

    // Build filters
    const filters = {}
    if (req.query.category) filters.category = req.query.category
    if (req.query.status) filters.status = req.query.status
    if (req.query.user_id) filters.user_id = req.query.user_id

    // Parse booleans
    if (req.query.is_active !== undefined) {
      filters.is_active = req.query.is_active === 'true'
    }

    // Custom date filters
    if (req.query.created_after) {
      filters['created_at >='] = req.query.created_after
    }

    const { whereClause, params } = buildWhereClause({
      searchQuery: search.query,
      searchFields: search.fields,
      filters,
    })

    const orderBy = buildOrderByClause({
      sortBy: req.query.sort,
      sortOrder: req.query.order,
      allowedFields: ['name', 'created_at', 'updated_at'],
      defaultSort: 'created_at',
    })

    await handleList({
      repo: ResourceRepo,
      req, res, next,
      filters: { whereClause, params, orderBy },
      dataKey: 'resources',
    })
    */
  })
)

// ───────────────────────────────────────────────────────────────────────────
// GET BY ID - /api/resources/:id
// ───────────────────────────────────────────────────────────────────────────

router.get(
  '/api/resources/:id',
  validateIdParam('integer'), // or 'uuid'
  asyncHandler((req, res, next) => {
    handleGetById({
      repo: ResourceRepo,
      req,
      res,
      next,
      dataKey: 'resource',
      notFoundMessage: 'Resource not found',
    })
  })
)

// ───────────────────────────────────────────────────────────────────────────
// CREATE - /api/resources
// POST { name, description, category, ... }
// ───────────────────────────────────────────────────────────────────────────

router.post(
  '/api/resources',
  authenticate,
  validate(CreateResourceSchema),
  asyncHandler((req, res, next) => {
    handleCreate({
      repo: ResourceRepo,
      req,
      res,
      next,

      // Transform data before creating
      transformData: async (body, req) => {
        // Add computed fields
        const slug = body.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

        // Add user context
        const user_id = req.user?.id

        // Add timestamps
        const created_at = new Date().toISOString()

        // Whitelist allowed fields (prevent mass assignment)
        const allowed = extractAllowedFields(body, [
          'name',
          'description',
          'category',
          'tags',
          'metadata',
        ])

        return {
          ...allowed,
          slug,
          user_id,
          created_at,
          updated_at: created_at,
          status: 'draft', // Default status
        }
      },

      dataKey: 'resource',
      statusCode: 201,
    })
  })
)

// ───────────────────────────────────────────────────────────────────────────
// UPDATE - /api/resources/:id
// PATCH { name?, description?, ... }
// ───────────────────────────────────────────────────────────────────────────

router.patch(
  '/api/resources/:id',
  authenticate,
  validateIdParam('integer'),
  validate(UpdateResourceSchema),
  asyncHandler((req, res, next) => {
    handleUpdate({
      repo: ResourceRepo,
      req,
      res,
      next,

      // Transform data before updating
      transformData: async (body, req, existing) => {
        // Example: Prevent certain changes
        if (existing.status === 'published' && body.status === 'draft') {
          throw new Error('Cannot unpublish via PATCH. Use DELETE endpoint.')
        }

        // Example: Only allow owner or admin to update
        if (req.user.id !== existing.user_id && !req.user.is_admin) {
          throw new Error('Not authorized to update this resource')
        }

        // Whitelist allowed fields
        const allowed = extractAllowedFields(body, [
          'name',
          'description',
          'category',
          'tags',
          'metadata',
          'status',
        ])

        // Add updated timestamp
        return {
          ...allowed,
          updated_at: new Date().toISOString(),
        }
      },

      dataKey: 'resource',
      notFoundMessage: 'Resource not found',
    })
  })
)

// ───────────────────────────────────────────────────────────────────────────
// DELETE - /api/resources/:id
// DELETE
// ───────────────────────────────────────────────────────────────────────────

router.delete(
  '/api/resources/:id',
  authenticate,
  requireAdmin,
  validateIdParam('integer'),
  asyncHandler((req, res, next) => {
    handleDelete({
      repo: ResourceRepo,
      req,
      res,
      next,
      hardDelete: false, // Use soft delete (if repo supports it)
      notFoundMessage: 'Resource not found',
      successMessage: 'Resource deleted successfully',
    })
  })
)

// For custom endpoints beyond basic CRUD (publish, bulk-delete, stats,
// duplicate), see: ./templates/TEMPLATE_custom_endpoints.js

module.exports = router
