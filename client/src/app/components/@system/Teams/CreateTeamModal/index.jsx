/**
 * CreateTeamModal Component
 * Modal for creating a new team
 */

import React, { useState } from 'react'
import { teamsApi } from '../../../../lib/@custom/teams'
import { Button } from '../../ui/button'
import { X } from 'lucide-react'

export function CreateTeamModal({ isOpen, onClose, onTeamCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('Team name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await teamsApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      })
      
      setFormData({ name: '', description: '' })
      onTeamCreated?.(result.team)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setFormData({ name: '', description: '' })
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-[var(--brand-bg)]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-brand-surface text-brand-text rounded-lg border border-[var(--brand-border-subtle)] max-w-md w-full p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Create New Team</h2>
          <button
            onClick={handleClose}
            className="text-brand-text-muted hover:text-brand-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Awesome Team"
              className="w-full px-3 py-2 border border-[var(--brand-border-subtle)] rounded-lg bg-brand-bg text-brand-text focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What's this team about?"
              rows={3}
              className="w-full px-3 py-2 border border-[var(--brand-border-subtle)] rounded-lg bg-brand-bg text-brand-text focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>

          {error && (
            <div className="p-3 bg-[var(--color-error-bg)] border border-[var(--color-error)]/20 rounded-lg text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Team'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
