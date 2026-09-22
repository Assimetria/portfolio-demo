// @custom — import data table route with server-side sorting, filtering, and pagination
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')

// In-memory import data store (in production this would come from a database/repo)
const importData = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: `Import ${i + 1}`,
  source: ['CSV', 'API', 'Manual', 'SFTP', 'Webhook'][i % 5],
  status: ['Pending', 'Processing', 'Completed', 'Failed', 'Cancelled'][i % 5],
  records: Math.floor(Math.random() * 10000),
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
}))

/**
 * GET /api/data-table/imports
 * Returns paginated, sorted, and filtered import data.
 *
 * Query params:
 *   sort      — column to sort by (default: 'id')
 *   direction — 'asc' or 'desc' (default: 'asc')
 *   page      — page number (default: 1)
 *   pageSize  — items per page (default: 10)
 *   search    — optional search query
 *
 * Response: { data: { imports: [...], pagination: { page, pageSize, total, totalPages } } }
 */
router.get('/data-table/imports', authenticate, async (req, res, next) => {
  try {
    const sort = req.query.sort || 'id'
    const direction = req.query.direction === 'desc' ? 'desc' : 'asc'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize, 10) || 10))
    const search = (req.query.search || '').trim().toLowerCase()

    let result = [...importData]

    // Filter by search
    if (search) {
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(search)
        )
      )
    }

    // Server-side sort with null-safe, locale-aware comparison
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
      ignorePunctuation: true,
    })

    result.sort((a, b) => {
      const aVal = a[sort]
      const bVal = b[sort]

      // Handle null/undefined — sort to the end
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      let comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = collator.compare(aVal, bVal)
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime()
      } else {
        comparison = collator.compare(String(aVal), String(bVal))
      }

      return direction === 'asc' ? comparison : -comparison
    })

    // Paginate
    const total = result.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const paginatedResult = result.slice(start, start + pageSize)

    res.json({
      data: {
        imports: paginatedResult,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router