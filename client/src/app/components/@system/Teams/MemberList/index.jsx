/**
 * MemberList Component
 * Displays and manages team members
 */

import React, { useState, useEffect, useCallback } from 'react'
import { teamsApi } from '../../../../lib/@custom/teams'
import { Card } from '../../Card'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Spinner } from '../../Loading'
import { Trash2 } from 'lucide-react'

export function MemberList({ teamId, userRole, onInviteMember }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState({})

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await teamsApi.listMembers(teamId)
      setMembers(data.members || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    if (teamId) {
      loadMembers()
    }
  }, [teamId, loadMembers])

  async function handleRemoveMember(userId) {
    if (!confirm('Are you sure you want to remove this member?')) {
      return
    }

    try {
      setActionLoading({ ...actionLoading, [userId]: 'removing' })
      await teamsApi.removeMember(teamId, userId)
      await loadMembers()
    } catch (err) {
      alert(err.message || 'Failed to remove member')
    } finally {
      setActionLoading({ ...actionLoading, [userId]: null })
    }
  }

  async function handleUpdateRole(userId, newRole) {
    try {
      setActionLoading({ ...actionLoading, [userId]: 'updating' })
      await teamsApi.updateMemberRole(teamId, userId, newRole)
      await loadMembers()
    } catch (err) {
      alert(err.message || 'Failed to update role')
    } finally {
      setActionLoading({ ...actionLoading, [userId]: null })
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

  function canManageMember(memberRole) {
    const roleHierarchy = { viewer: 1, member: 2, admin: 3, owner: 4 }
    return roleHierarchy[userRole] > roleHierarchy[memberRole]
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
        <Button onClick={loadMembers} className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Team Members ({members.length})
        </h3>
        {(userRole === 'admin' || userRole === 'owner') && onInviteMember && (
          <Button onClick={onInviteMember} size="sm">
            + Invite Member
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <Card key={member.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-surface rounded-full flex items-center justify-center">
                  <span className="text-brand-text-muted font-semibold">
                    {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {member.name || member.email}
                    </span>
                    <Badge className={getRoleBadgeClass(member.role)}>
                      {member.role}
                    </Badge>
                  </div>
                  <span className="text-sm text-brand-text-muted">{member.email}</span>
                </div>
              </div>

              {canManageMember(member.role) && (
                <div className="flex items-center gap-2">
                  {actionLoading[member.user_id] ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                        className="px-2 py-1 border border-[var(--brand-border-subtle)] rounded text-sm bg-brand-bg text-brand-text"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="member">Member</option>
                        {userRole === 'owner' && (
                          <option value="admin">Admin</option>
                        )}
                      </select>

                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="text-[var(--color-error)] hover:text-[var(--color-error)]/80 p-1"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
