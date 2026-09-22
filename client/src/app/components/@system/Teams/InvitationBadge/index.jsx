/**
 * InvitationBadge Component
 * Shows count of pending team invitations
 * Can be used in navigation/header
 */

import React from 'react'
import { useTeamInvitations } from '../../../../hooks/@custom/useTeamInvitations'

export function InvitationBadge({ className = '' }) {
  const { invitationCount, loading } = useTeamInvitations()

  if (loading || invitationCount === 0) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-[var(--color-error)]-foreground bg-[var(--color-error)] rounded-full ${className}`}
      aria-label={`${invitationCount} pending team invitation${invitationCount !== 1 ? 's' : ''}`}
    >
      {invitationCount > 9 ? '9+' : invitationCount}
    </span>
  )
}
