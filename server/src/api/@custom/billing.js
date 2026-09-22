// @custom — billing overview route (feature #970: Billing & Subscriptions)
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers')

// In-memory store for billing items (replace with DB in production)
const billingStore = {
  items: [],
  nextId: 1,
}

// Undo/redo history stacks
const history = {
  undoStack: [],
  redoStack: [],
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getItemIndex(id) {
  return billingStore.items.findIndex((item) => item.id === id)
}

function recordAction(action) {
  history.redoStack = [] // clear redo on new action
  history.undoStack.push(action)
  // Cap undo stack at 50 entries
  if (history.undoStack.length > 50) {
    history.undoStack.shift()
  }
}

// ── Existing endpoint ───────────────────────────────────────────────────────

// GET /api/billing — authenticated billing summary
router.get('/billing', authenticate, async (req, res, next) => {
  try {
    res.json({
      user_id: req.user.id,
      subscription: null,
    })
  } catch (err) {
    next(err)
  }
})

// ── Billing Items CRUD ───────────────────────────────────────────────────────

// GET /api/billing/items — list all billing items
router.get('/billing/items', authenticate, async (req, res, next) => {
  try {
    res.json({ items: billingStore.items })
  } catch (err) {
    next(err)
  }
})
// POST /api/billing/items — create a new billing item
router.post('/billing/items', authenticate, async (req, res, next) => {
  try {
    const { description, amount, quantity = 1 } = req.body
    if (!description || amount == null) {
      return res.status(400).json({ message: 'description and amount are required' })
    }

    const item = {
      id: billingStore.nextId++,
      description,
      amount: Number(amount),
      quantity: Number(quantity),
      total: Number(amount) * Number(quantity),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    billingStore.items.push(item)

    recordAction({
      type: 'CREATE',
      item: { ...item },
    })

    res.status(201).json({ item })
  } catch (err) {
    next(err)
  }
})

// PUT /api/billing/items/:id — update a billing item
router.put('/billing/items/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const index = getItemIndex(id)

    if (index === -1) {
      return res.status(404).json({ message: 'Item not found' })
    }

    const previous = { ...billingStore.items[index] }
    const { description, amount, quantity } = req.body

    if (description !== undefined) billingStore.items[index].description = description
    if (amount !== undefined) {
      billingStore.items[index].amount = Number(amount)
    }
    if (quantity !== undefined) {
      billingStore.items[index].quantity = Number(quantity)
    }
    billingStore.items[index].total =
      billingStore.items[index].amount * billingStore.items[index].quantity
    billingStore.items[index].updated_at = new Date().toISOString()

    recordAction({
      type: 'UPDATE',
      itemId: id,
      previous,
      current: { ...billingStore.items[index] },
    })

    res.json({ item: billingStore.items[index] })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/billing/items/:id — delete a billing item
router.delete('/billing/items/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const index = getItemIndex(id)

    if (index === -1) {
      return res.status(404).json({ message: 'Item not found' })
    }

    const removed = billingStore.items.splice(index, 1)[0]

    recordAction({
      type: 'DELETE',
      item: removed,
      itemIndex: index,
    })

    res.json({ message: 'Item deleted', item: removed })
  } catch (err) {
    next(err)
  }
})
// ── Undo/Redo ────────────────────────────────────────────────────────────────

// POST /api/billing/items/undo — undo the last action
router.post('/billing/items/undo', authenticate, async (req, res, next) => {
  try {
    const action = history.undoStack.pop()
    if (!action) {
      return res.status(400).json({ message: 'Nothing to undo' })
    }

    switch (action.type) {
      case 'CREATE': {
        const index = getItemIndex(action.item.id)
        if (index !== -1) {
          billingStore.items.splice(index, 1)
        }
        break
      }
      case 'UPDATE': {
        const index = getItemIndex(action.itemId)
        if (index !== -1) {
          billingStore.items[index] = action.previous
        }
        break
      }
      case 'DELETE': {
        billingStore.items.splice(action.itemIndex, 0, action.item)
        break
      }
      default:
        return res.status(400).json({ message: 'Unknown action type' })
    }

    history.redoStack.push(action)

    res.json({ message: 'Undo successful', items: billingStore.items })
  } catch (err) {
    next(err)
  }
})

// POST /api/billing/items/redo — redo the last undone action
router.post('/billing/items/redo', authenticate, async (req, res, next) => {
  try {
    const action = history.redoStack.pop()
    if (!action) {
      return res.status(400).json({ message: 'Nothing to redo' })
    }

    switch (action.type) {
      case 'CREATE': {
        billingStore.items.push(action.item)
        break
      }
      case 'UPDATE': {
        const index = getItemIndex(action.itemId)
        if (index !== -1) {
          billingStore.items[index] = action.current
        }
        break
      }
      case 'DELETE': {
        const index = getItemIndex(action.item.id)
        if (index !== -1) {
          billingStore.items.splice(index, 1)
        }
        break
      }
      default:
        return res.status(400).json({ message: 'Unknown action type' })
    }

    history.undoStack.push(action)

    res.json({ message: 'Redo successful', items: billingStore.items })
  } catch (err) {
    next(err)
  }
})

module.exports = router
