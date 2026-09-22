// @system — User settings with common UX patterns
// Provides tabbed interface for profile, security, notifications, and preferences
//
// Usage:
// <UserSettings />
// or with custom tabs:
// <UserSettings defaultTab="security" />

import { useState } from 'react'
import { User, Shield, Bell, Palette, Link2, Download, Keyboard } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../Tabs'
import { ProfileSettings } from './ProfileSettings'
import { SecuritySettings } from './SecuritySettings'
import { NotificationSettings } from './NotificationSettings'
import { PreferencesSettings } from './PreferencesSettings'
import { ConnectedAccounts } from './ConnectedAccounts'
import { DataExport } from './DataExport'
import { KeyboardShortcuts } from './KeyboardShortcuts'
import { cn } from '@/app/lib/@system/utils'

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'preferences', label: 'Preferences', icon: Palette },
  { id: 'connections', label: 'Connections', icon: Link2 },
  { id: 'data', label: 'Data', icon: Download },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
]

/**
 * UserSettings — Complete user settings interface with tabs
 * @param {Object} props
 * @param {string} [props.defaultTab='profile'] - Default active tab
 * @param {string} [props.className] - Additional CSS classes
 * @param {Object} [props.user] - User data object
 * @param {Function} [props.onUpdate] - Callback when settings update
 * @param {Function} [props.onTabChange] - Callback when tab changes
 */
export function UserSettings({
  defaultTab = 'profile',
  className,
  user,
  onUpdate,
  onTabChange,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (onTabChange) {
      onTabChange(tab)
    }
  }

  return (
    <div className={cn('w-full', className)}>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Tabs navigation */}
        <TabsList className="mb-6 border-b pb-0">
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab content */}
        <TabsContent value="profile">
          <ProfileSettings user={user} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings user={user} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings user={user} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesSettings user={user} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="connections">
          <ConnectedAccounts user={user} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="data">
          <DataExport user={user} />
        </TabsContent>

        <TabsContent value="shortcuts">
          <KeyboardShortcuts />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * SettingsSection — Reusable section component for settings pages
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} [props.description] - Section description
 * @param {React.ReactNode} props.children - Section content
 * @param {string} [props.className] - Additional CSS classes
 */
export function SettingsSection({ title, description, children, className }) {
  return (
    <div className={cn('mb-8 pb-8 border-b last:border-0 last:mb-0 last:pb-0', className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-brand-text-muted mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * SettingsRow — Row layout for settings items (label + control)
 * @param {Object} props
 * @param {string} props.label - Setting label
 * @param {string} [props.description] - Setting description
 * @param {React.ReactNode} props.children - Control element(s)
 * @param {string} [props.className] - Additional CSS classes
 */
export function SettingsRow({ label, description, children, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-3', className)}>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-brand-text-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  )
}
