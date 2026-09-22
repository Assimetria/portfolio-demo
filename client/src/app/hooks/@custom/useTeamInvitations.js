// @custom — Team invitations hook. NEVER overwritten during template sync.
// Provides pending invitation count for InvitationBadge component.
import { useState, useEffect } from 'react'
import { api } from '../../lib/@system/api'

export function useTeamInvitations() {
  const [invitationCount, setInvitationCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.get('/teams/invitations/pending')
      .then((data) => {
        if (!cancelled) setInvitationCount(data?.count ?? 0)
      })
      .catch(() => {
        if (!cancelled) setInvitationCount(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { invitationCount, loading }
}
