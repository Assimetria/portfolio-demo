const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../../../lib/@system/Helpers/auth')
const db = require('../../../lib/@system/PostgreSQL')
const logger = require('../../../lib/@system/Logger')
const { validate } = require('../../../lib/@system/Validation')
const { BlogIdParams, BlogSlugParams, BlogListQuery, AdminBlogListQuery } = require('../../../lib/@system/Validation/schemas/@system/blog')

const adminGuard = [authenticate, requireAdmin]

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
function readingTime(content) {
  if (!content) return 0
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200))
}

// GET /api/blog — list published posts
router.get('/blog', validate({ query: BlogListQuery }), async (req, res, next) => {
  try {
    const { category, search, page, limit } = req.query
    const offset = (page - 1) * limit
    const conds = ["status = 'published'", 'published_at <= NOW()']
    const params = []
    if (category && category !== 'All') { params.push(category); conds.push(`category = $${params.length}`) }
    if (search) { params.push(`%${search}%`); conds.push(`(title ILIKE $${params.length} OR excerpt ILIKE $${params.length})`) }
    const where = `WHERE ${conds.join(' AND ')}`
    params.push(limit, offset)
    const posts = await db.any(
      `SELECT id, slug, title, excerpt, category, author, tags, reading_time, featured, published_at, created_at
       FROM blog_posts ${where} ORDER BY featured DESC, published_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
    const { total } = await db.one(`SELECT COUNT(*)::int AS total FROM blog_posts ${where}`, params.slice(0, -2))
    res.json({ posts, total, page, limit })
  } catch (err) {
    if (err.code === '42P01') return res.json({ posts: [], total: 0 })
    next(err)
  }
})

// GET /api/blog/:slug — single published post
router.get('/blog/:slug', validate({ params: BlogSlugParams }), async (req, res, next) => {
  try {
    const post = await db.oneOrNone(
      "SELECT * FROM blog_posts WHERE slug = $1 AND status = 'published' AND published_at <= NOW()", [req.params.slug])
    if (!post) return res.status(404).json({ message: 'Post not found' })
    res.json({ post })
  } catch (err) {
    if (err.code === '42P01') return res.status(404).json({ message: 'Post not found' })
    next(err)
  }
})

// GET /api/admin/blog — list all posts (including drafts)
router.get('/admin/blog', ...adminGuard, validate({ query: AdminBlogListQuery }), async (req, res, next) => {
  try {
    const { status, page, limit } = req.query
    const offset = (page - 1) * limit
    const conds = []; const params = []
    if (status) { params.push(status); conds.push(`status = $${params.length}`) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    params.push(limit, offset)
    const posts = await db.any(
      `SELECT id, slug, title, excerpt, category, author, status, featured, reading_time, published_at, created_at, updated_at
       FROM blog_posts ${where} ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
    res.json({ posts })
  } catch (err) {
    if (err.code === '42P01') return res.json({ posts: [] })
    next(err)
  }
})

// GET /api/admin/blog/:id
router.get('/admin/blog/:id', ...adminGuard, validate({ params: BlogIdParams }), async (req, res, next) => {
  try {
    const post = await db.oneOrNone('SELECT * FROM blog_posts WHERE id = $1', [req.params.id])
    if (!post) return res.status(404).json({ message: 'Post not found' })
    res.json({ post })
  } catch (err) { next(err) }
})

// POST /api/admin/blog — create post
router.post('/admin/blog', ...adminGuard, async (req, res, next) => {
  try {
    const { title, slug: customSlug, excerpt, content, category, author, tags, status, featured, published_at, meta_title, meta_description } = req.body
    if (!title) return res.status(400).json({ message: 'Title is required' })
    const slug = customSlug || slugify(title)
    const rt = readingTime(content)
    const finalStatus = status || 'draft'
    const pubAt = finalStatus === 'published' ? (published_at || new Date().toISOString()) : published_at
    const post = await db.one(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, author, tags, status, featured, reading_time, published_at, created_by, meta_title, meta_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [slug, title, excerpt || '', content || '', category || 'Company', author || 'The Team', tags || [], finalStatus, featured || false, rt, pubAt, req.user.id, meta_title, meta_description])
    logger.info({ slug, id: post.id }, 'Blog post created')
    res.status(201).json({ post })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Slug already exists' })
    next(err)
  }
})

// PATCH /api/admin/blog/:id — update post
router.patch('/admin/blog/:id', ...adminGuard, validate({ params: BlogIdParams }), async (req, res, next) => {
  try {
    const existing = await db.oneOrNone('SELECT * FROM blog_posts WHERE id = $1', [req.params.id])
    if (!existing) return res.status(404).json({ message: 'Post not found' })
    const fields = ['title', 'slug', 'excerpt', 'content', 'category', 'author', 'tags', 'status', 'featured', 'published_at', 'meta_title', 'meta_description']
    const updates = []; const params = []
    for (const f of fields) {
      if (req.body[f] !== undefined) { params.push(req.body[f]); updates.push(`${f} = $${params.length}`) }
    }
    if (req.body.content !== undefined) { params.push(readingTime(req.body.content)); updates.push(`reading_time = $${params.length}`) }
    if (req.body.status === 'published' && existing.status !== 'published' && !req.body.published_at) {
      params.push(new Date().toISOString()); updates.push(`published_at = $${params.length}`)
    }
    if (updates.length === 0) return res.json({ post: existing })
    params.push(new Date().toISOString()); updates.push(`updated_at = $${params.length}`)
    params.push(req.params.id)
    const post = await db.one(`UPDATE blog_posts SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`, params)
    logger.info({ slug: post.slug, id: post.id }, 'Blog post updated')
    res.json({ post })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Slug already exists' })
    next(err)
  }
})

// DELETE /api/admin/blog/:id
router.delete('/admin/blog/:id', ...adminGuard, validate({ params: BlogIdParams }), async (req, res, next) => {
  try {
    const r = await db.result('DELETE FROM blog_posts WHERE id = $1', [req.params.id])
    if (r.rowCount === 0) return res.status(404).json({ message: 'Post not found' })
    logger.info({ id: req.params.id }, 'Blog post deleted')
    res.json({ message: 'Post deleted' })
  } catch (err) { next(err) }
})

module.exports = router
