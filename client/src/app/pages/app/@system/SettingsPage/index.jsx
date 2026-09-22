// @system — user profile / settings page
// Now uses the unified UserSettings component with all UX features
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { UserSettings } from '../../../../components/@system/UserSettings'
import { useAuthContext } from '../../../../store/@system/auth'
import { SettingsPageSkeleton } from '../../../../components/@system/Skeleton'

export function SettingsPage() {
  const { user, loading: authLoading, updateUser } = useAuthContext()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab state driven by ?tab= query param
  const activeTab = searchParams.get('tab') ?? 'profile'

  function handleTabChange(tab) {
    setSearchParams({ tab }, { replace: true })
  }

  async function handleSettingsUpdate(updates) {
    try {
      await updateUser(updates)
      return { success: true }
    } catch (error) {
      console.error('Failed to update settings:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save settings' 
      }
    }
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        {authLoading ? (
          <SettingsPageSkeleton />
        ) : (
          <div className="mx-auto max-w-4xl">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="mt-1 text-brand-text-muted">
                Manage your account preferences and security settings.
              </p>
            </div>

            <UserSettings
              defaultTab={activeTab}
              user={user}
              onUpdate={handleSettingsUpdate}
              onTabChange={handleTabChange}
            />
          </div>
        )}
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}
