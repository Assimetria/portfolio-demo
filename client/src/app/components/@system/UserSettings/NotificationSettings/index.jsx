// @system — Notification settings component
// Manage email, push, and in-app notification preferences

import { useState } from 'react'
import { Mail, Bell, MessageSquare, Activity, CreditCard } from 'lucide-react'
import { SettingsSection, SettingsRow } from '../'
import { Switch } from '../../Switch'
import { Button } from '../../Button'

export function NotificationSettings({ user, onUpdate }) {
  const [loading, setLoading] = useState(false)
  // Server-backed column defaults hydrate from the user record when available.
  const DEFAULT_PREFS = {
    // Email notifications
    emailMarketing: user?.notificationPreferences?.emailMarketing ?? true,
    emailProduct: user?.notificationPreferences?.emailProduct ?? true,
    emailSecurity: user?.notificationPreferences?.emailSecurity ?? true,
    emailActivity: user?.notificationPreferences?.emailActivity ?? false,

    // In-app notifications
    inAppActivity: user?.notificationPreferences?.inAppActivity ?? true,
    inAppMessages: user?.notificationPreferences?.inAppMessages ?? true,
    inAppUpdates: user?.notificationPreferences?.inAppUpdates ?? true,

    // Digest
    weeklyDigest: user?.notificationPreferences?.weeklyDigest ?? false,

    // Push notifications
    pushEnabled: user?.notificationPreferences?.pushEnabled ?? false,
    pushActivity: user?.notificationPreferences?.pushActivity ?? false,
    pushMessages: user?.notificationPreferences?.pushMessages ?? false,
  }
  const [preferences, setPreferences] = useState(DEFAULT_PREFS)

  const togglePreference = (key) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Map the UI toggles that correspond 1:1 with the persisted server columns.
  // Note: emailSecurity is intentionally server-controlled (always on) and not sent.
  const buildCommunicationPreferences = () => ({
    email_marketing: preferences.emailMarketing,
    product_updates: preferences.emailProduct,
    weekly_digest: preferences.weeklyDigest,
    in_app_notifications: preferences.inAppUpdates,
  })

  // Persist the mapped subset to /api/communications (communication_preferences).
  // Auth is the httpOnly session cookie (credentials: 'include') — the client
  // never holds a bearer token, so nothing is read from localStorage here.
  const persistCommunications = async () => {
    const res = await fetch('/api/communications/update', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCommunicationPreferences()),
    })
    if (!res.ok) throw new Error('Failed to save communication preferences')
    return res.json()
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Full profile preferences still go through the user record updater...
      await onUpdate?.({ notificationPreferences: preferences })
      // ...while email/digest/in-app channels persist to the communications API.
      await persistCommunications()
      // Show success toast
    } catch (error) {
      // Show error toast
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = JSON.stringify(preferences) !==
    JSON.stringify({ ...DEFAULT_PREFS, ...(user?.notificationPreferences || {}) })

  return (
    <div className="max-w-2xl">
      {/* Email notifications */}
      <SettingsSection
        title="Email notifications"
        description="Manage which emails you receive from us"
      >
        <div className="space-y-0 divide-y">
          <SettingsRow
            label="Product updates"
            description="News about product features and updates"
          >
            <Switch
              checked={preferences.emailProduct}
              onCheckedChange={() => togglePreference('emailProduct')}
            />
          </SettingsRow>
          
          <SettingsRow
            label="Marketing emails"
            description="Tips, case studies, and special offers"
          >
            <Switch
              checked={preferences.emailMarketing}
              onCheckedChange={() => togglePreference('emailMarketing')}
            />
          </SettingsRow>
          
          <SettingsRow
            label="Account activity"
            description="Summary of your account activity"
          >
            <Switch
              checked={preferences.emailActivity}
              onCheckedChange={() => togglePreference('emailActivity')}
            />
          </SettingsRow>
          
          <SettingsRow
            label="Security alerts"
            description="Important security notifications (always on)"
          >
            <Switch
              checked={preferences.emailSecurity}
              onCheckedChange={() => togglePreference('emailSecurity')}
              disabled
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* In-app notifications */}
      <SettingsSection
        title="In-app notifications"
        description="Notifications shown in the app"
      >
        <div className="space-y-0 divide-y">
          <SettingsRow
            label="Activity notifications"
            description="Updates about your account activity"
          >
            <Switch
              checked={preferences.inAppActivity}
              onCheckedChange={() => togglePreference('inAppActivity')}
            />
          </SettingsRow>
          
          <SettingsRow
            label="Messages"
            description="Direct messages and mentions"
          >
            <Switch
              checked={preferences.inAppMessages}
              onCheckedChange={() => togglePreference('inAppMessages')}
            />
          </SettingsRow>
          
          <SettingsRow
            label="Product updates"
            description="New features and improvements"
          >
            <Switch
              checked={preferences.inAppUpdates}
              onCheckedChange={() => togglePreference('inAppUpdates')}
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Push notifications */}
      <SettingsSection
        title="Push notifications"
        description="Get notified even when the app is closed"
      >
        <div className="space-y-4">
          <div className="rounded-lg border p-4 bg-[var(--brand-primary-5)]0">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-brand-text-muted mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {preferences.pushEnabled ? 'Push notifications enabled' : 'Push notifications disabled'}
                </p>
                <p className="text-xs text-brand-text-muted mt-1">
                  {preferences.pushEnabled
                    ? "You'll receive push notifications for selected events"
                    : 'Enable push notifications to stay updated on the go'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => togglePreference('pushEnabled')}
                >
                  {preferences.pushEnabled ? 'Disable' : 'Enable'} push notifications
                </Button>
              </div>
            </div>
          </div>

          {preferences.pushEnabled && (
            <div className="space-y-0 divide-y">
              <SettingsRow
                label="Activity notifications"
                description="Important account activity"
              >
                <Switch
                  checked={preferences.pushActivity}
                  onCheckedChange={() => togglePreference('pushActivity')}
                />
              </SettingsRow>
              
              <SettingsRow
                label="Messages"
                description="New direct messages"
              >
                <Switch
                  checked={preferences.pushMessages}
                  onCheckedChange={() => togglePreference('pushMessages')}
                />
              </SettingsRow>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Notification digest */}
      <SettingsSection
        title="Notification digest"
        description="Receive a weekly summary of your notifications"
      >
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Weekly digest</p>
              <p className="text-xs text-brand-text-muted mt-0.5">
                Sent every Monday at 9:00 AM
              </p>
            </div>
            <Switch
              aria-label="Toggle weekly digest"
              checked={preferences.weeklyDigest}
              onCheckedChange={() => togglePreference('weeklyDigest')}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Save button */}
      {hasChanges && (
        <div className="flex justify-end gap-2 sticky bottom-4 bg-brand-bg border-t pt-4">
          <Button
            variant="outline"
            onClick={() => setPreferences(user?.notificationPreferences || {})}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  )
}
