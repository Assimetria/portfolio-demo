// @custom — activity reorder endpoint (SV4-112: drag-and-drop activity feed)
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')
const db = require('../../lib/@system/PostgreSQL')

// POST /api/activity/reorder — persist custom drag-and-drop order for activity feed items
router.post('/activity/reorder', authenticate, async (req, res, next) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'items array is required' })
    }

    // Validate each item
    for (const item of items) {
      if (!item.id || typeof item.position !== 'number') {
        return res.status(400).json({ message: 'Each item must have an id (number) and position (number)' })
      }
    }

    const userId = req.user.id

    // Upsert activity order entries for this user
    await db.tx(async (t) => {
      // Delete existing order entries for items in the payload to avoid stale rows
      const ids = items.map((i) => i.id)
      await t.none(
        `DELETE FROM activity_order WHERE user_id = $1 AND activity_id = ANY($2::int[])`,
        [userId, ids],
      )

      // Insert new order entries
      for (const item of items) {
        await t.none(
          `INSERT INTO activity_order (user_id, activity_id, position, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, activity_id) DO UPDATE SET position = $3, updated_at = NOW()`,
          [userId, item.id, item.position],
        )
      }
    })

    res.json({ success: true, items })
  } catch (err) {
    next(err)
  }
})

// GET /api/activity/order — retrieve saved order for activity feed items
router.get('/activity/order', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id
    const rows = await db.any(
      `SELECT activity_id AS id, position FROM activity_order
       WHERE user_id = $1
       ORDER BY position ASC`,
      [userId],
    )
    res.json({ order: rows })
  } catch (err) {
    next(err)
  }
})

module.exports = router