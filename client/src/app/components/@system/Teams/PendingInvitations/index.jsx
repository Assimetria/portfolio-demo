/**
 * PendingInvitations Component
 * Displays pending team invitations for the current user
 */

import React, { useState, useEffect } from 'react'
import { teamsApi } from '../../../../lib/@custom/teams'
import { Card } from '../../Card'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Spinner } from '../../Loading'

export function PendingInvitations({ onInvitationAccepted }) {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accepting, setAccepting] = useState(null)

  useEffect(() => {
    loadInvitations()
  }, [])

  async function loadInvitations() {
    try {
      setLoading(true)
      const data = await teamsApi.getPendingInvitations()
      setInvitations(data.invitations || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(token, teamName) {
    if (!confirm(`Accept invitation to join "${teamName}"?`)) {
      return
    }

    try {
      setAccepting(token)
      await teamsApi.acceptInvitation(token)
      
      setInvitations(invitations.filter(inv => inv.token !== token))
      onInvitationAccepted?.()
    } catch (err) {
      alert(err.message || 'Failed to accept invitation')
    } finally {
      setAccepting(null)
    }
  }

  function getRoleBadgeClass(role) {
    const classes = {
      owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      admin: 'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]/30 dark:text-[var(--color-info)]',
      member: 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]/30 dark:text-[var(--color-success)]',
      viewer: 'bg-brand-surface text-brand-text',
    }
    return classes[role] || classes.viewer
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-[var(--color-error-bg)] border border-[var(--color-error)]/20 rounded-lg">
        <p className="text-[var(--color-error)]">{error}</p>
        <Button onClick={loadInvitations} size="sm" className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  if (invitations.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="text-lg font-semibold mb-2">No pending invitations</h3>
        <p className="text-brand-text-muted">
          You don't have any team invitations at the moment.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold mb-4">
        Pending Invitations ({invitations.length})
      </h2>

      {invitations.map((invitation) => (
        <Card
          key={invitation.id}
          className="p-4 sm:p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg">{invitation.team_name}</h3>
                <Badge className={getRoleBadgeClass(invitation.role)}>
                  {invitation.role}
                </Badge>
              </div>
              
              <div className="text-sm text-brand-text-muted space-y-1">
                <p>Invited by: <span className="font-medium">{invitation.inviter_name}</span></p>
                <p>
                  Expires: {new Date(invitation.expires_at).toLocaleDateString()} at{' '}
                  {new Date(invitation.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={() => handleAccept(invitation.token, invitation.team_name)}
                disabled={accepting === invitation.token}
                className="flex-1 sm:flex-none min-h-touch sm:min-h-0"
              >
                {accepting === invitation.token ? (
                  <>
                    <Spinner className="mr-2" />
                    Accepting...
                  </>
                ) : (
                  'Accept'
                )}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
