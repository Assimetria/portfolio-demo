/**
 * API Template - Custom Endpoints (Beyond basic CRUD)
 *
 * This is a REFERENCE template showing custom endpoints that go beyond basic
 * CRUD: publish, bulk-delete, stats, duplicate.
 *
 * All handlers below are commented out because they reference a non-existent
 * ResourceRepo. Copy the patterns into your own route file and adapt them.
 *
 * Rule: every POST/PUT/PATCH/DELETE validates its params/body with zod via
 * validate() — even "action" endpoints with no body validate their :id.
 */

/*
const express = require('express')
const { z } = require('zod')
const router = express.Router()

const {
  asyncHandler,
  successResponse,
  errorResponse,
  authenticate,
  requireAdmin,
} = require('../../lib/@system/Helpers')
const { validate } = require('../../lib/@system/Middleware')

const ResourceRepo = require('../../db/repos/@custom/ResourceRepo')

// Schemas — normally live in ./schemas.js (see TEMPLATE_schemas.js)
const ResourceIdParams = z.object({ id: z.coerce.number().int().positive() })
const BulkDeleteBody = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1, 'ids must be a non-empty array').max(100),
})

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM ENDPOINTS (Beyond basic CRUD)
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// PUBLISH - /api/resources/:id/publish
// POST
// ───────────────────────────────────────────────────────────────────────────

router.post(
  '/api/resources/:id/publish',
  authenticate,
  validate({ params: ResourceIdParams }),
  asyncHandler(async (req, res, next) => {
    const resource = await ResourceRepo.findById(req.params.id)

    if (!resource) {
      return res.status(404).json(errorResponse('Resource not found'))
    }

    // Check authorization
    if (req.user.id !== resource.user_id && !req.user.is_admin) {
      return res.status(403).json(errorResponse('Not authorized'))
    }

    // Validate resource is ready to publish
    if (!resource.name || !resource.description) {
      return res.status(400).json(
        errorResponse('Cannot publish incomplete resource', {
          details: {
            name: !resource.name ? 'Name is required' : null,
            description: !resource.description ? 'Description is required' : null,
          },
        })
      )
    }

    // Publish
    const updated = await ResourceRepo.update(resource.id, {
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    res.json(successResponse(updated, {
      message: 'Resource published successfully',
    }))
  })
)

// ───────────────────────────────────────────────────────────────────────────
// BULK OPERATIONS - /api/resources/bulk-delete
// POST { ids: [1, 2, 3] }
// ───────────────────────────────────────────────────────────────────────────

router.post(
  '/api/resources/bulk-delete',
  authenticate,
  requireAdmin,
  validate({ body: BulkDeleteBody }), // ids already coerced to positive ints
  asyncHandler(async (req, res, next) => {
    const { ids } = req.body

    // Bulk delete (repo must use placeholders — see TEMPLATE_repo.js)
    await ResourceRepo.bulkDelete(ids)

    res.json(
      successResponse(null, {
        message: `${ids.length} resources deleted successfully`,
        meta: { deletedIds: ids },
      })
    )
  })
)

// ───────────────────────────────────────────────────────────────────────────
// STATISTICS - /api/resources/stats
// GET
// ───────────────────────────────────────────────────────────────────────────

router.get(
  '/api/resources/stats',
  authenticate,
  asyncHandler(async (req, res, next) => {
    const stats = await ResourceRepo.getStats(req.user.id)

    res.json(successResponse(stats, {
      message: 'Statistics retrieved successfully',
    }))
  })
)

// ───────────────────────────────────────────────────────────────────────────
// DUPLICATE - /api/resources/:id/duplicate
// POST
// ───────────────────────────────────────────────────────────────────────────

router.post(
  '/api/resources/:id/duplicate',
  authenticate,
  validate({ params: ResourceIdParams }),
  asyncHandler(async (req, res, next) => {
    const original = await ResourceRepo.findById(req.params.id)

    if (!original) {
      return res.status(404).json(errorResponse('Resource not found'))
    }

    // Check authorization
    if (req.user.id !== original.user_id && !req.user.is_admin) {
      return res.status(403).json(errorResponse('Not authorized'))
    }

    // Create duplicate
    const duplicate = await ResourceRepo.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      tags: original.tags,
      metadata: original.metadata,
      user_id: req.user.id,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    res.status(201).json(
      successResponse(duplicate, {
        message: 'Resource duplicated successfully',
      })
    )
  })
)

module.exports = router
*/
