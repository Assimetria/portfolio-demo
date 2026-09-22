'use strict'

// @custom — tenant management routes (multi-tenant example)
// GET  /api/tenants                      list caller's tenants
// POST /api/tenants                      create tenant (caller becomes owner)
// GET  /api/tenants/current              tenant resolved by X-Tenant-Id
// POST /api/tenants/:id/members          add member (owner/admin)
// DEL  /api/tenants/:id/members/:userId  remove member (owner/admin)
// Every mutating route validates body/params with zod (`validate()`).

const express = require('express')
const router = express.Router()

const { requireAuth } = require('../../middleware/@system/auth')
const { validate } = require('../../lib/@system/Validation')
const { tenantContext, requireTenantRole } = require('../../lib/@custom/tenantContext')
const TenantRepo = require('../../db/repos/@custom/TenantRepo')
const {
  CreateTenantBody,
  TenantIdParams,
  AddMemberBody,
  RemoveMemberParams,
} = require('../../lib/@system/Validation/schemas/@custom/tenants')

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// List tenants the current user is a member of.
router.get('/api/tenants', requireAuth, async (req, res, next) => {
  try {
    const tenants = await TenantRepo.listForUser(req.user.id)
    res.json({ data: tenants })
  } catch (err) {
    next(err)
  }
})

// Create a new tenant. Creator becomes the owner.
router.post('/api/tenants', requireAuth, validate({ body: CreateTenantBody }), async (req, res, next) => {
  try {
    const { name, slug } = req.body
    const requestedSlug = slug ? slugify(slug) : slugify(name)
    if (!requestedSlug) return res.status(400).json({ error: 'invalid slug' })

    const existing = await TenantRepo.findBySlug(requestedSlug)
    if (existing) return res.status(409).json({ error: 'slug already taken' })

    const tenant = await TenantRepo.create({
      slug: requestedSlug,
      name,
      ownerUserId: req.user.id,
    })
    res.status(201).json({ data: tenant })
  } catch (err) {
    next(err)
  }
})

// Get the currently scoped tenant (from X-Tenant-Id header or default).
router.get(
  '/api/tenants/current',
  requireAuth,
  tenantContext,
  (req, res) => {
    res.json({ data: { ...req.tenant, role: req.tenantRole } })
  }
)

// Add a member to a tenant. Owner/admin only.
router.post(
  '/api/tenants/:id/members',
  requireAuth,
  tenantContext,
  requireTenantRole('owner', 'admin'),
  validate({ params: TenantIdParams, body: AddMemberBody }),
  async (req, res, next) => {
    try {
      const targetTenantId = req.params.id
      if (targetTenantId !== req.tenant.id) {
        return res.status(400).json({ error: 'tenant scope mismatch' })
      }
      const { userId, role } = req.body
      const member = await TenantRepo.addMember(targetTenantId, userId, role)
      res.status(201).json({ data: member })
    } catch (err) {
      next(err)
    }
  }
)

// Remove a member. Owner/admin only.
router.delete(
  '/api/tenants/:id/members/:userId',
  requireAuth,
  tenantContext,
  requireTenantRole('owner', 'admin'),
  validate({ params: RemoveMemberParams }),
  async (req, res, next) => {
    try {
      const { id: targetTenantId, userId: targetUserId } = req.params
      if (targetTenantId !== req.tenant.id) {
        return res.status(400).json({ error: 'tenant scope mismatch' })
      }
      await TenantRepo.removeMember(targetTenantId, targetUserId)
      res.json({ success: true })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
