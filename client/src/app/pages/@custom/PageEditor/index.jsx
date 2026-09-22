// @custom — Billing Editor with undo/redo support
// Provides a full billing line-item editor with:
// - Add, edit, delete billing items
// - Undo/redo for all operations (Ctrl+Z / Ctrl+Shift+Z)
// - Keyboard shortcut support
import { useState, useEffect, useCallback } from 'react'
import { Undo2, Redo2, Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react'
import { Button } from '../../../components/@system/ui/button'
import { Input } from '../../../components/@system/ui/input'
import { Textarea } from '../../../components/@system/Textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/@system/Card'
import { Modal } from '../../../components/@system/Modal'
import { useUndoRedo } from '../../../hooks/@custom/useUndoRedo'
import {
  getBillingItems,
  createBillingItem,
  updateBillingItem,
  deleteBillingItem,
  undoBillingAction,
  redoBillingAction,
} from '../../../api/@custom'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── Main component ──────────────────────────────────────────────────────────

export default function BillingEditor() {
  const { state: items, pushState, undo, redo, canUndo, canRedo, resetHistory } = useUndoRedo([])
  const [loading, setLoading] = useState(true)
  const [apiLoading, setApiLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({ description: '', amount: '', quantity: 1 })
  const [error, setError] = useState('')
  // Load items on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getBillingItems()
        if (!cancelled) {
          resetHistory(res.items || [])
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load billing items')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [resetHistory])

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAddModal() {
    setEditingItem(null)
    setFormData({ description: '', amount: '', quantity: 1 })
    setError('')
    setShowModal(true)
  }

  function openEditModal(item) {
    setEditingItem(item)
    setFormData({
      description: item.description,
      amount: String(item.amount),
      quantity: item.quantity,
    })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingItem(null)
    setError('')
  }
  // ── CRUD operations with undo/redo recording ──────────────────────────────

  const handleSave = useCallback(async () => {
    if (!formData.description || !formData.amount) {
      setError('Description and amount are required')
      return
    }
    setApiLoading(true)
    setError('')

    try {
      if (editingItem) {
        const res = await updateBillingItem(editingItem.id, {
          description: formData.description,
          amount: Number(formData.amount),
          quantity: Number(formData.quantity),
        })
        const updated = res.item
        const newItems = items.map((item) =>
          item.id === updated.id ? updated : item
        )
        pushState(newItems)
      } else {
        const res = await createBillingItem({
          description: formData.description,
          amount: Number(formData.amount),
          quantity: Number(formData.quantity),
        })
        const newItem = res.item
        pushState([...items, newItem])
      }
      closeModal()
    } catch (err) {
      setError(err.message || 'Failed to save item')
    } finally {
      setApiLoading(false)
    }
  }, [formData, editingItem, items, pushState])

  const handleDelete = useCallback(async (id) => {
    setApiLoading(true)
    try {
      await deleteBillingItem(id)
      const newItems = items.filter((item) => item.id !== id)
      pushState(newItems)
    } catch (err) {
      setError(err.message || 'Failed to delete item')
    } finally {
      setApiLoading(false)
    }
  }, [items, pushState])
  // ── Undo/Redo with server sync ────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    try {
      await undoBillingAction()
      undo()
    } catch (err) {
      setError(err.message || 'Failed to undo')
    }
  }, [undo])

  const handleRedo = useCallback(async () => {
    try {
      await redoBillingAction()
      redo()
    } catch (err) {
      setError(err.message || 'Failed to redo')
    }
  }, [redo])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if ((e.metaKey || e.ctrlKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // ── Grand total ───────────────────────────────────────────────────────────

  const grandTotal = items.reduce((sum, item) => sum + (item.total || 0), 0)
  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="page-editor mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing Editor</h1>
          <p className="text-sm text-brand-text-muted">
            Manage billing line items with undo/redo support
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo || apiLoading} className="gap-1.5" title="Undo (Ctrl+Z)">
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo || apiLoading} className="gap-1.5" title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="h-4 w-4" />
            Redo
          </Button>
          <Button size="sm" onClick={openAddModal} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>
      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-4 py-3 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Line Items</CardTitle>
          <CardDescription>
            {items.length} item{items.length !== 1 ? 's' : ''} &middot; Total: {formatCurrency(grandTotal)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-brand-text-muted">No billing items yet.</p>
              <p className="text-sm text-brand-text-muted">
                Click &quot;Add Item&quot; to create your first billing line item.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="px-4 py-3 text-left font-medium text-brand-text-muted">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-brand-text-muted">Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-brand-text-muted">Qty</th>
                    <th className="px-4 py-3 text-right font-medium text-brand-text-muted">Total</th>
                    <th className="px-4 py-3 text-right font-medium text-brand-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-brand-border/50 last:border-0 hover:bg-brand-surface-hover/50">
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(item)} disabled={apiLoading}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} disabled={apiLoading} className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-brand-border font-medium">
                    <td className="px-4 py-3" colSpan={3}>Grand Total</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(grandTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingItem ? 'Edit Billing Item' : 'Add Billing Item'}
        description="Enter the billing line item details below."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="item-description" className="mb-1.5 block text-sm font-medium text-brand-text">
              Description
            </label>
            <Textarea
              id="item-description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Web Development Services"
              className="min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-amount" className="mb-1.5 block text-sm font-medium text-brand-text">
                Amount ($)
              </label>
              <Input
                id="item-amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="item-quantity" className="mb-1.5 block text-sm font-medium text-brand-text">
                Quantity
              </label>
              <Input
                id="item-quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </div>
          </div>

          {formData.amount && (
            <div className="rounded-md bg-brand-surface/50 px-3 py-2 text-sm">
              <span className="text-brand-text-muted">Line total: </span>
              <span className="font-medium">
                {formatCurrency(Number(formData.amount) * Number(formData.quantity || 1))}
              </span>
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-[var(--color-error)]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeModal} disabled={apiLoading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={apiLoading} className="gap-2">
              {apiLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {editingItem ? 'Update' : 'Add'} Item
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
