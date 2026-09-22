/**
 * InvitationManager Component
 * Manages team invitations (send, view, revoke)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { teamsApi } from '../../../../lib/@custom/teams'
import { Card } from '../../Card'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Spinner } from '../../Loading'

export function InvitationManager({ teamId, userRole }) {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [formData, setFormData] = useState({ email: '', role: 'member' })
  const [actionLoading, setActionLoading] = useState({})
  const [error, setError] = useState(null)

  const loadInvitations = useCallback(async () => {
    try {
      setLoading(true)
      const data = await teamsApi.listInvitations(teamId, { includeExpired: false })
      setInvitations(data.invitations || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    if (teamId && (userRole === 'admin' || userRole === 'owner')) {
      loadInvitations()
    }
  }, [teamId, userRole, loadInvitations])

  async function handleInvite(e) {
    e.preventDefault()
    
    if (!formData.email.trim()) {
      alert('Email is required')
      return
    }

    try {
      setActionLoading({ ...actionLoading, invite: true })
      await teamsApi.inviteMember(teamId, {
        email: formData.email.trim(),
        role: formData.role,
      })
      setFormData({ email: '', role: 'member' })
      setShowInviteForm(false)
      await loadInvitations()
    } catch (err) {
      alert(err.message || 'Failed to send invitation')
    } finally {
      setActionLoading({ ...actionLoading, invite: false })
    }
  }

  async function handleRevoke(invitationId) {
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return
    }

    try {
      setActionLoading({ ...actionLoading, [invitationId]: true })
      await teamsApi.revokeInvitation(teamId, invitationId)
      await loadInvitations()
    } catch (err) {
      alert(err.message || 'Failed to revoke invitation')
    } finally {
      setActionLoading({ ...actionLoading, [invitationId]: false })
    }
  }

  function getStatusBadgeClass(invitation) {
    if (invitation.accepted_at) return 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]/30 dark:text-[var(--color-success)]'
    if (new Date(invitation.expires_at) < new Date()) return 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
    return 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]/30 dark:text-[var(--color-warning)]'
  }

  function getStatusText(invitation) {
    if (invitation.accepted_at) return 'Accepted'
    if (new Date(invitation.expires_at) < new Date()) return 'Expired'
    return 'Pending'
  }

  if (userRole !== 'admin' && userRole !== 'owner') {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Invitations</h3>
        <Button
          onClick={() => setShowInviteForm(!showInviteForm)}
          size="sm"
        >
          {showInviteForm ? 'Cancel' : '+ Send Invitation'}
        </Button>
      </div>

      {showInviteForm && (
        <Card className="p-4">
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="colleague@example.com"
                className="w-full px-3 py-2 border border-[var(--brand-border-subtle)] rounded-lg bg-brand-bg text-brand-text focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-[var(--brand-border-subtle)] rounded-lg bg-brand-bg text-brand-text focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="viewer">Viewer - Read only access</option>
                <option value="member">Member - Can create and edit</option>
                {userRole === 'owner' && (
                  <option value="admin">Admin - Can manage members</option>
                )}
              </select>
            </div>

            <Button
              type="submit"
              disabled={actionLoading.invite}
              className="w-full"
            >
              {actionLoading.invite ? 'Sending...' : 'Send Invitation'}
            </Button>
          </form>
        </Card>
      )}

      {error && (
        <div className="p-4 bg-[var(--color-error-bg)] border border-[var(--color-error)]/20 rounded-lg">
          <p className="text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {invitations.length === 0 ? (
        <Card className="p-8 text-center text-brand-text-muted">
          No pending invitations
        </Card>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{invitation.email}</span>
                    <Badge className={getStatusBadgeClass(invitation)}>
                      {getStatusText(invitation)}
                    </Badge>
                    <Badge variant="secondary">
                      {invitation.role}
                    </Badge>
                  </div>
                  <div className="text-sm text-brand-text-muted">
                    Invited by {invitation.inviter_name} •{' '}
                    {!invitation.accepted_at && (
                      <>Expires {new Date(invitation.expires_at).toLocaleDateString()}</>
                    )}
                    {invitation.accepted_at && (
                      <>Accepted {new Date(invitation.accepted_at).toLocaleDateString()}</>
                    )}
                  </div>
                </div>

                {!invitation.accepted_at && new Date(invitation.expires_at) > new Date() && (
                  <button
                    onClick={() => handleRevoke(invitation.id)}
                    disabled={actionLoading[invitation.id]}
                    className="text-[var(--color-error)] hover:text-[var(--color-error)]/80 disabled:opacity-50"
                  >
                    {actionLoading[invitation.id] ? (
                      <Spinner size="sm" />
                    ) : (
                      'Revoke'
                    )}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
