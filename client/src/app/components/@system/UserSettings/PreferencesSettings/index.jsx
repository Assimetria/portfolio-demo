// @system — Preferences settings component
// Manage app appearance, language, timezone, and other preferences

import { useState } from 'react'
import { Sun, Moon, Monitor, Globe, Clock, Layout } from 'lucide-react'
import { SettingsSection, SettingsRow } from '../'
import { Select } from '../../Select'
import { Button } from '../../Button'
import { useTheme } from '@/app/store/@system/theme'
import { cn } from '@/app/lib/@system/utils'

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun, description: 'Clean and bright' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { value: 'system', label: 'System', icon: Monitor, description: 'Match your OS' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
]

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
]

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
]

export function PreferencesSettings({ user, onUpdate }) {
  const [loading, setLoading] = useState(false)
  // The theme is owned by the global ThemeProvider (shared with the sidebar and
  // header toggles) which persists it to localStorage and keeps every surface in
  // sync. Only the account-level preferences below are managed locally + saved.
  const { theme, setTheme } = useTheme()

  const [preferences, setPreferences] = useState({
    language: user?.preferences?.language || 'en',
    timezone: user?.preferences?.timezone || 'UTC',
    dateFormat: user?.preferences?.dateFormat || 'MM/DD/YYYY',
    compactMode: user?.preferences?.compactMode || false,
    sidebarCollapsed: user?.preferences?.sidebarCollapsed || false,
  })

  const userPrefs = user?.preferences || {}

  const handleThemeChange = (value) => {
    setTheme(value)
  }

  const updatePreference = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await onUpdate?.({ preferences })
      // Show success toast
    } catch (error) {
      // Show error toast
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = Object.keys(preferences).some((key) => preferences[key] !== userPrefs[key])

  return (
    <div className="max-w-2xl">
      {/* Appearance */}
      <SettingsSection
        title="Appearance"
        description="Customize how the app looks"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-3">Theme</p>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map(({ value, label, icon: Icon, description }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center',
                    'hover:border-brand-primary/60 hover:bg-brand-surface-hover',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                    theme === value
                      ? 'border-brand-primary bg-brand-primary/5'
                      : 'border-[var(--brand-border-subtle)]'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-brand-text-muted">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <SettingsRow
            label="Compact mode"
            description="Reduce spacing and font sizes"
          >
            <Switch
              checked={preferences.compactMode}
              onCheckedChange={(checked) => updatePreference('compactMode', checked)}
            />
          </SettingsRow>

          <SettingsRow
            label="Collapsed sidebar"
            description="Show icons only in the sidebar"
          >
            <Switch
              checked={preferences.sidebarCollapsed}
              onCheckedChange={(checked) => updatePreference('sidebarCollapsed', checked)}
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Localization */}
      <SettingsSection
        title="Localization"
        description="Set your language and regional preferences"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-brand-text-muted" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Language</p>
              <Select
                value={preferences.language}
                onValueChange={(value) => updatePreference('language', value)}
                options={LANGUAGES}
                placeholder="Select language"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-brand-text-muted" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Timezone</p>
              <Select
                value={preferences.timezone}
                onValueChange={(value) => updatePreference('timezone', value)}
                options={TIMEZONES}
                placeholder="Select timezone"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Layout className="h-5 w-5 text-brand-text-muted" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Date format</p>
              <Select
                value={preferences.dateFormat}
                onValueChange={(value) => updatePreference('dateFormat', value)}
                options={DATE_FORMATS}
                placeholder="Select format"
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Accessibility */}
      <SettingsSection
        title="Accessibility"
        description="Adjust the app to your needs"
      >
        <div className="rounded-lg border p-4 bg-[var(--brand-primary-5)]0">
          <p className="text-sm text-brand-text-muted">
            More accessibility options coming soon, including:
          </p>
          <ul className="text-xs text-brand-text-muted mt-2 space-y-1 ml-4 list-disc">
            <li>High contrast mode</li>
            <li>Keyboard shortcuts customization</li>
            <li>Screen reader optimizations</li>
          </ul>
        </div>
      </SettingsSection>

      {/* Data & Privacy */}
      <SettingsSection
        title="Data & Privacy"
        description="Manage how your data is used"
      >
        <div className="space-y-0 divide-y">
          <SettingsRow
            label="Analytics"
            description="Help us improve by sharing anonymous usage data"
          >
            <Switch checked={true} />
          </SettingsRow>
          
          <SettingsRow
            label="Crash reports"
            description="Automatically send error reports"
          >
            <Switch checked={true} />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Save button */}
      {hasChanges && (
        <div className="flex justify-end gap-2 sticky bottom-4 bg-brand-bg border-t pt-4">
          <Button
            variant="outline"
            onClick={() => setPreferences(user?.preferences || {})}
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

// Simple Switch component (if not exists)
function Switch({ checked, onCheckedChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-primary' : 'bg-brand-surface'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-brand-bg shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}
