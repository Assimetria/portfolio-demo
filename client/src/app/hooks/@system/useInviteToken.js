// @system — invite token state hook
// Per Protocol #21: auth-adjacent logic (tokens) belongs in @system.
//
// Manages the short-lived invite_token returned by the API after creating an
// invitation. Encapsulates state + URL construction so @custom pages stay
// free of raw token manipulation.
//
// Usage:
//   const { clearInviteToken, inviteUrl, captureToken } =
//     useInviteToken('/accept-team-invite')
//
//   // after API call — @custom pages pass the full result; token extraction
//   // stays here in @system:
//   captureToken(result)
//
//   // in JSX:
//   {inviteUrl && <div>{inviteUrl}</div>}
import { useState } from 'react'

/**
 * @param {string} acceptPath  The path the invitee will land on, e.g. '/accept-invite'
 *                             or '/accept-team-invite'. A `?token=` query param is appended.
 */
export function useInviteToken(acceptPath) {
  const [inviteToken, setInviteToken] = useState(null)

  function clearInviteToken() {
    setInviteToken(null)
  }

  /** Extract invite_token from an API response and store it.
   *  @custom callers pass the raw result object — token field access stays in @system. */
  function captureToken(result) {
    if (result?.invite_token) {
      setInviteToken(result.invite_token)
    }
  }

  const inviteUrl = inviteToken
    ? `${window.location.origin}${acceptPath}?token=${inviteToken}`
    : null

  return { inviteToken, clearInviteToken, captureToken, inviteUrl }
}
