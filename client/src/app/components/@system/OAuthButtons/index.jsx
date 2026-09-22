/**
 * @system -- OAuthButtons
 *
 * Renders "Continue with Google" button using the @system Button component.
 * Google "G" icon is rendered in the brand-primary color (monochrome).
 * Clicking triggers a full-page redirect to the backend OAuth
 * initiation endpoint (/api/auth/google).
 */

import { Button } from "../ui/button"
import { Separator } from "../ui/separator"

function GoogleIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api"

export function OAuthButtons({ className = "", showDivider = true }) {
  function initiateOAuth(provider) {
    window.location.href = `${API_BASE}/auth/${provider}`
  }

  return (
    <div className={className}>
      {showDivider && (
        <div className="relative flex items-center py-2">
          <Separator className="flex-1" />
          <span className="mx-3 text-xs text-brand-text-muted">or continue with</span>
          <Separator className="flex-1" />
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        iconLeft={<GoogleIcon className="text-brand-primary" />}
        onClick={() => initiateOAuth("google")}
      >
        Continue with Google
      </Button>
    </div>
  )
}
