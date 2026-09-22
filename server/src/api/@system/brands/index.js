// @system — Brand management API
// Brand belongsTo Subscription, Brand hasMany Collaborators
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../../lib/@system/Helpers/auth')
const BrandRepo = require('../../../db/repos/@system/BrandRepo')
const { validate } = require('../../../lib/@system/Validation')
const {
  BrandIdParams,
  BrandPaginationQuery,
  CreateBrandBody,
  UpdateBrandBody,
  UploadLogoBody,
} = require('../../../lib/@system/Validation/schemas/@system/brands')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── GET /api/brands ─────────────────────────────────────────────────────────
router.get('/brands', authenticate, validate({ query: BrandPaginationQuery }), async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, status } = req.query
    const filters = { user_id: req.user.id, limit: +limit, offset: +offset }
    if (status) filters.status = status

    const [brands, total] = await Promise.all([
      BrandRepo.findAll(filters),
      BrandRepo.count(filters),
    ])
    res.json({ brands, total })
  } catch (err) { next(err) }
})

// ─── GET /api/brands/:id ────────────────────────────────────────────────────
router.get('/brands/:id', authenticate, validate({ params: BrandIdParams }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findById(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    res.json({ brand })
  } catch (err) { next(err) }
})

// ─── POST /api/brands ───────────────────────────────────────────────────────
router.post('/brands', authenticate, validate({ body: CreateBrandBody }), async (req, res, next) => {
  try {
    const { name, description, image_url, website_url, primary_color, secondary_color,
            external_id, tags, metadata, status, subscription_id } = req.body

    const slug = slugify(name.trim())
    const existing = await BrandRepo.findBySlug(slug)
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug

    const brand = await BrandRepo.create({
      name: name.trim(),
      slug: finalSlug,
      description, image_url, website_url,
      primary_color, secondary_color,
      external_id, tags, metadata,
      status, subscription_id,
      user_id: req.user.id,
    })
    res.status(201).json({ brand })
  } catch (err) { next(err) }
})

// ─── PATCH /api/brands/:id ──────────────────────────────────────────────────
router.patch('/brands/:id', authenticate, validate({ params: BrandIdParams, body: UpdateBrandBody }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findById(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    const updated = await BrandRepo.update(brand.id, req.body)
    res.json({ brand: updated })
  } catch (err) { next(err) }
})

// ─── POST /api/brands/:id/logo ──────────────────────────────────────────────
router.post('/brands/:id/logo', authenticate, validate({ params: BrandIdParams, body: UploadLogoBody }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findById(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    const updated = await BrandRepo.update(brand.id, { logo_url: req.body.logo })
    res.json({ brand: updated })
  } catch (err) { next(err) }
})

// ─── DELETE /api/brands/:id/logo ─────────────────────────────────────────────
router.delete('/brands/:id/logo', authenticate, validate({ params: BrandIdParams }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findById(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    const updated = await BrandRepo.update(brand.id, { logo_url: null })
    res.json({ brand: updated })
  } catch (err) { next(err) }
})

// ─── DELETE /api/brands/:id ──────────────────────────────────────────────────
router.delete('/brands/:id', authenticate, validate({ params: BrandIdParams }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findById(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    const deleted = await BrandRepo.softDelete(brand.id)
    res.json({ message: 'Brand deleted', brand: deleted })
  } catch (err) { next(err) }
})

// ─── GET /api/brands/deleted ─────────────────────────────────────────────────
router.get('/brands/deleted', authenticate, async (req, res, next) => {
  try {
    const brands = await BrandRepo.findDeleted({
      user_id: req.user.role === 'admin' ? undefined : req.user.id,
    })
    res.json({ brands })
  } catch (err) { next(err) }
})

// ─── POST /api/brands/:id/restore ───────────────────────────────────────────
router.post('/brands/:id/restore', authenticate, validate({ params: BrandIdParams }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findByIdIncludingDeleted(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (!brand.deleted_at) return res.status(400).json({ message: 'Brand is not deleted' })
    const restored = await BrandRepo.restore(brand.id)
    res.json({ brand: restored })
  } catch (err) { next(err) }
})

// ─── GET /api/brands/:id/subscription ────────────────────────────────────────
router.get('/brands/:id/subscription', authenticate, validate({ params: BrandIdParams }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findById(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    const subscription = await BrandRepo.getSubscription(brand.id)
    res.json({ subscription })
  } catch (err) { next(err) }
})

// ─── GET /api/brands/:id/collaborators ───────────────────────────────────────
router.get('/brands/:id/collaborators', authenticate, validate({ params: BrandIdParams }), async (req, res, next) => {
  try {
    const brand = await BrandRepo.findById(+req.params.id)
    if (!brand) return res.status(404).json({ message: 'Brand not found' })
    if (brand.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    const collaborators = await BrandRepo.getCollaborators(brand.id)
    res.json({ collaborators })
  } catch (err) { next(err) }
})

module.exports = router
