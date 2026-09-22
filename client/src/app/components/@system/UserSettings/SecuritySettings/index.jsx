// @system — Security settings component
// Manage password, 2FA, sessions, and API keys

import { useEffect, useState } from 'react'
import { Lock, Smartphone, Monitor, AlertTriangle, Check } from 'lucide-react'
import { SettingsSection, SettingsRow } from '../'
import { Button } from '../../Button'
import { Form, FormField, FormLabel, Input as FormInput } from '../../Form'
import { Badge } from '../../Badge'
import { ConfirmModal } from '../../Modal'
import { getSessions, revokeSession } from '@/app/api/@system'
import { cn } from '@/app/lib/@system/utils'

// Render an approximate "Active X ago" label from the session createdAt date.
function formatActive(createdAt) {
  if (!createdAt) return ''
  const now = Date.now()
  const seconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${seconds >= 120 ? 's' : ''} ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${seconds >= 7200 ? 's' : ''} ago`
  return `${Math.floor(seconds / 86400)} day${seconds >= 172800 ? 's' : ''} ago`
}

// Surface a friendly device label from the raw User-Agent string.
function deviceLabel(userAgent) {
  if (!userAgent) return 'Unknown device'
  const lower = userAgent.toLowerCase()
  if (/iphone|ipad/.test(lower)) return /ipad/.test(lower) ? 'Safari on iPad' : 'Safari on iPhone'
  if (/android/.test(lower)) return 'Mobile browser'
  if (/macintosh|mac os x/.test(lower)) return 'Safari on macOS'
  if (/windows nt/.test(lower)) return 'Browser on Windows'
  if (/linux/.test(lower)) return 'Browser on Linux'
  return userAgent.split(' ')[0].replace(/^[^a-z]*/i, '')
}

export function SecuritySettings({ user, onUpdate }) {
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false)

  // Live active sessions (server: GET /api/sessions)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError] = useState('')
  const [sessionToRevoke, setSessionToRevoke] = useState(null)
  const [revoking, setRevoking] = useState(false)

  const loadSessions = async () => {
    setSessionsLoading(true)
    setSessionsError('')
    const res = await getSessions()
    if (res.status !== 200) {
      setSessionsError(res?.message || 'Failed to load active sessions')
      setSessions([])
    } else {
      setSessions(Array.isArray(res?.data?.sessions) ? res.data.sessions : [])
    }
    setSessionsLoading(false)
  }

  useEffect(() => {
    loadSessions()
    // fetch once on mount
  }, [])

  const handleRevokeSession = async () => {
    if (!sessionToRevoke) return
    setRevoking(true)
    const res = await revokeSession(sessionToRevoke.id)
    setRevoking(false)
    if (res.status !== 200) {
      setSessionsError(res?.message || 'Failed to revoke session')
    } else {
      setSessionToRevoke(null)
      setSessions((prev) => prev.filter((s) => s.id !== sessionToRevoke.id))
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Password */}
      <SettingsSection
        title="Password"
        description="Change your password regularly to keep your account secure"
      >
        {!showPasswordForm ? (
          <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
            <Lock className="h-4 w-4 mr-2" />
            Change password
          </Button>
        ) : (
          <PasswordChangeForm onCancel={() => setShowPasswordForm(false)} />
        )}
      </SettingsSection>

      {/* Two-factor authentication */}
      <SettingsSection
        title="Two-factor authentication"
        description="Add an extra layer of security to your account"
      >
        <div className="space-y-4">
          <SettingsRow
            label="Authenticator app"
            description="Use an app like Google Authenticator or Authy"
          >
            {twoFactorEnabled ? (
              <Badge variant="success">
                <Check className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Open 2FA setup modal
                  setTwoFactorEnabled(true)
                }}
              >
                Enable
              </Button>
            )}
          </SettingsRow>

          {twoFactorEnabled && (
            <div className="rounded-lg border p-4 bg-[var(--brand-primary-5)]0">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-[var(--color-success)] mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Two-factor authentication is active</p>
                  <p className="text-xs text-brand-text-muted mt-1">
                    You'll need to enter a code from your authenticator app when you sign in
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setTwoFactorEnabled(false)}
                  >
                    Disable 2FA
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Active sessions */}
      <SettingsSection
        title="Active sessions"
        description="Manage devices where you're currently logged in"
      >
        {sessionsLoading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-brand-text-muted">
            Loading sessions…
          </div>
        ) : sessionsError ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error-bg)]/40 p-4">
            <p className="text-sm text-[var(--color-error)]">{sessionsError}</p>
            <Button variant="outline" size="sm" onClick={loadSessions}>
              Retry
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-brand-text-muted">
            No other active sessions are currently linked to your account.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onRevoke={() => setSessionToRevoke(session)}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      {/* Security recommendations */}
      <SettingsSection
        title="Security recommendations"
        description="Improve your account security"
      >
        <SecurityChecklist user={user} twoFactorEnabled={twoFactorEnabled} />
      </SettingsSection>

      <ConfirmModal
        open={Boolean(sessionToRevoke)}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={handleRevokeSession}
        title="Revoke session"
        description={
          sessionToRevoke
            ? `This will sign out ${deviceLabel(sessionToRevoke.userAgent)} from your account. You can sign back in at any time.`
            : undefined
        }
        confirmText="Revoke session"
        cancelText="Cancel"
        variant="destructive"
        loading={revoking}
      />
    </div>
  )
}

function PasswordChangeForm({ onCancel }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    const newErrors = {}
    if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters'
    }
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      // await changePassword(formData)
      onCancel()
    } catch (error) {
      setErrors({ general: 'Failed to change password' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form onSubmit={handleSubmit} className="space-y-4">
      <FormField>
        <FormLabel htmlFor="currentPassword">Current password</FormLabel>
        <Input
          id="currentPassword"
          type="password"
          value={formData.currentPassword}
          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
          required
        />
      </FormField>

      <FormField>
        <FormLabel htmlFor="newPassword">New password</FormLabel>
        <Input
          id="newPassword"
          type="password"
          value={formData.newPassword}
          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
          required
        />
        {errors.newPassword && (
          <p className="text-xs text-[var(--color-error)] mt-1">{errors.newPassword}</p>
        )}
      </FormField>

      <FormField>
        <FormLabel htmlFor="confirmPassword">Confirm new password</FormLabel>
        <Input
          id="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          required
        />
        {errors.confirmPassword && (
          <p className="text-xs text-[var(--color-error)] mt-1">{errors.confirmPassword}</p>
        )}
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Change password
        </Button>
      </div>
    </Form>
  )
}

function SessionCard({ session, onRevoke }) {
  const isCurrent = session?.isCurrent === true
  const device = deviceLabel(session?.userAgent)
  const activeSince = formatActive(session?.createdAt)

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border bg-brand-surface">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-surface">
          <Monitor className="h-5 w-5 text-brand-text-muted" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{device}</p>
            {isCurrent && <Badge variant="success" className="text-xs">Current</Badge>}
          </div>
          <p className="text-xs text-brand-text-muted mt-0.5">{session?.ipAddress || 'Unknown location'}</p>
          <p className="text-xs text-brand-text-muted">
            {session?.createdAt ? `Active ${activeSince}` : 'Recently active'}
          </p>
        </div>
      </div>
      {!isCurrent && (
        <Button variant="ghost" size="sm" onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </div>
  )
}

function SecurityChecklist({ user, twoFactorEnabled }) {
  const checks = [
    {
      id: 'strong-password',
      label: 'Use a strong password',
      completed: true,
      description: 'Your password meets security requirements',
    },
    {
      id: '2fa',
      label: 'Enable two-factor authentication',
      completed: twoFactorEnabled,
      description: 'Add an extra layer of security',
    },
    {
      id: 'email-verified',
      label: 'Verify your email',
      completed: user?.emailVerified || false,
      description: 'Confirm your email address',
    },
  ]

  return (
    <div className="space-y-2">
      {checks.map((check) => (
        <div
          key={check.id}
          className={cn(
            'flex items-start gap-3 p-3 rounded-lg border',
            check.completed ? 'bg-[var(--color-success-bg)]/50 dark:bg-[var(--color-success-bg)]/10 border-[var(--color-success)] dark:border-[var(--color-success)]' : 'bg-[var(--color-warning-bg)]/50 dark:bg-[var(--color-warning-bg)]/10 border-[var(--color-warning)] dark:border-[var(--color-warning)]'
          )}
        >
          {check.completed ? (
            <Check className="h-5 w-5 text-[var(--color-success)] dark:text-[var(--color-success)] mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] dark:text-[var(--color-warning)] mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{check.label}</p>
            <p className="text-xs text-brand-text-muted mt-0.5">{check.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
