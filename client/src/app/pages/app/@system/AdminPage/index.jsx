// @system — admin dashboard: user management, subscriptions, email logs, feature flags
import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../components/@system/Tabs'
import { useAuthContext } from '../../../../store/@system/auth'
import { api } from '../../../../lib/@system/api'
import { PAGE_SIZE } from './parts'
import { OverviewTab } from './OverviewTab'
import { UsersTab } from './UsersTab'
import { SubscriptionsTab } from './SubscriptionsTab'
import { EmailLogsTab } from './EmailLogsTab'
import { FeatureFlagsTab } from './FeatureFlagsTab'

export function AdminPage() {
  const { user } = useAuthContext()

  // ── Analytics state ────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')

  async function fetchStats() {
    setStatsLoading(true)
    setStatsError('')
    try {
      const data = await api.get('/admin/users/stats')
      setStats(data)
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setStatsLoading(false)
    }
  }

  // ── Users state ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [search, setSearch] = useState('')
  const [usersPage, setUsersPage] = useState(1)
  const [roleUpdating, setRoleUpdating] = useState(null) // userId being updated

  const fetchUsers = useCallback(async (page = 1, searchVal = '') => {
    setUsersLoading(true)
    setUsersError('')
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (searchVal.length >= 2) qs.set('search', searchVal)
      const data = await api.get(`/admin/users?${qs}`)
      setUsers(data.users ?? [])
      setUsersTotal(data.total ?? data.users?.length ?? 0)
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  async function handleRoleToggle(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    setRoleUpdating(u.id)
    try {
      await api.patch(`/admin/users/${u.id}/role`, { role: newRole })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setRoleUpdating(null)
    }
  }

  // ── Subscriptions state ────────────────────────────────────────────────────
  const [subscriptions, setSubscriptions] = useState([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [subsError, setSubsError] = useState('')
  const [subsPage, setSubsPage] = useState(1)
  const [subsStatusFilter, setSubsStatusFilter] = useState('')

  async function fetchSubscriptions(page = 1, status = '') {
    setSubsLoading(true)
    setSubsError('')
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (status) qs.set('status', status)
      const data = await api.get(`/admin/subscriptions?${qs}`)
      setSubscriptions(data.subscriptions ?? [])
    } catch (err) {
      setSubsError(err instanceof Error ? err.message : 'Failed to load subscriptions')
    } finally {
      setSubsLoading(false)
    }
  }

  // ── Email logs state ────────────────────────────────────────────────────────
  const [emailLogs, setEmailLogs] = useState([])
  const [emailLogsTotal, setEmailLogsTotal] = useState(0)
  const [emailLogsLoading, setEmailLogsLoading] = useState(false)
  const [emailLogsError, setEmailLogsError] = useState('')
  const [emailLogsPage, setEmailLogsPage] = useState(1)
  const [emailStatusFilter, setEmailStatusFilter] = useState('')
  const [emailStats, setEmailStats] = useState(null)

  async function fetchEmailLogs(page = 1, status = '') {
    setEmailLogsLoading(true)
    setEmailLogsError('')
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) })
      if (status) qs.set('status', status)
      const [logsData, statsData] = await Promise.all([
        api.get(`/email-logs?${qs}`),
        api.get('/email-logs/stats'),
      ])
      setEmailLogs(logsData.logs ?? [])
      setEmailLogsTotal(logsData.total ?? 0)
      setEmailStats(statsData.stats ?? null)
    } catch (err) {
      setEmailLogsError(err instanceof Error ? err.message : 'Failed to load email logs')
    } finally {
      setEmailLogsLoading(false)
    }
  }

  // ── Feature flags state ────────────────────────────────────────────────────
  const [featureFlags, setFeatureFlags] = useState([])
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [flagsError, setFlagsError] = useState('')
  const [flagUpdating, setFlagUpdating] = useState(null)
  const [flagCategoryFilter, setFlagCategoryFilter] = useState('')
  const [showAddFlag, setShowAddFlag] = useState(false)
  const [newFlag, setNewFlag] = useState({ key: '', label: '', description: '', category: 'general' })

  async function fetchFeatureFlags(category = '') {
    setFlagsLoading(true)
    setFlagsError('')
    try {
      const qs = category ? `?category=${category}` : ''
      const data = await api.get(`/admin/feature-flags${qs}`)
      setFeatureFlags(data.flags ?? [])
    } catch (err) {
      setFlagsError(err instanceof Error ? err.message : 'Failed to load feature flags')
    } finally {
      setFlagsLoading(false)
    }
  }

  async function handleFlagToggle(flag) {
    setFlagUpdating(flag.key)
    try {
      await api.patch(`/admin/feature-flags/${flag.key}`, { enabled: !flag.enabled })
      setFeatureFlags(prev => prev.map(f => f.key === flag.key ? { ...f, enabled: !f.enabled } : f))
    } catch (err) {
      setFlagsError(err instanceof Error ? err.message : 'Failed to toggle flag')
    } finally {
      setFlagUpdating(null)
    }
  }

  async function handleAddFlag() {
    if (!newFlag.key || !newFlag.label) return
    try {
      const data = await api.post('/admin/feature-flags', newFlag)
      setFeatureFlags(prev => [...prev, data.flag])
      setNewFlag({ key: '', label: '', description: '', category: 'general' })
      setShowAddFlag(false)
    } catch (err) {
      setFlagsError(err instanceof Error ? err.message : 'Failed to create flag')
    }
  }

  async function handleDeleteFlag(key) {
    try {
      await api.delete(`/admin/feature-flags/${key}`)
      setFeatureFlags(prev => prev.filter(f => f.key !== key))
    } catch (err) {
      setFlagsError(err instanceof Error ? err.message : 'Failed to delete flag')
    }
  }

  // ── Initial loads ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats()
    fetchUsers(1, '')
    fetchSubscriptions(1, '')
    fetchEmailLogs(1, '')
    fetchFeatureFlags()
  }, [fetchUsers])

  // ── Search with debounce ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setUsersPage(1)
      fetchUsers(1, search)
    }, 350)
    return () => clearTimeout(timer)
  }, [search, fetchUsers])

  const usersTotalPages = Math.max(1, Math.ceil((usersTotal || users.length) / PAGE_SIZE))

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Admin</h1>
              <p className="mt-1 text-brand-text-muted">Manage users, subscriptions, and platform settings.</p>
            </div>
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="emails">Email Logs</TabsTrigger>
              <TabsTrigger value="flags">Feature Flags</TabsTrigger>
            </TabsList>

            {/* ── Overview tab ── */}
            <TabsContent value="overview">
              <OverviewTab
                stats={stats}
                statsLoading={statsLoading}
                statsError={statsError}
                onRefresh={fetchStats}
              />
            </TabsContent>

            {/* ── Users tab ── */}
            <TabsContent value="users">
              <UsersTab
                users={users}
                usersTotal={usersTotal}
                usersLoading={usersLoading}
                usersError={usersError}
                search={search}
                setSearch={setSearch}
                usersPage={usersPage}
                setUsersPage={setUsersPage}
                usersTotalPages={usersTotalPages}
                roleUpdating={roleUpdating}
                fetchUsers={fetchUsers}
                handleRoleToggle={handleRoleToggle}
                currentUser={user}
              />
            </TabsContent>

            {/* ── Subscriptions tab ── */}
            <TabsContent value="subscriptions">
              <SubscriptionsTab
                subscriptions={subscriptions}
                subsLoading={subsLoading}
                subsError={subsError}
                subsPage={subsPage}
                setSubsPage={setSubsPage}
                subsStatusFilter={subsStatusFilter}
                setSubsStatusFilter={setSubsStatusFilter}
                fetchSubscriptions={fetchSubscriptions}
              />
            </TabsContent>

            {/* ── Email Logs tab ── */}
            <TabsContent value="emails">
              <EmailLogsTab
                emailLogs={emailLogs}
                emailLogsTotal={emailLogsTotal}
                emailLogsLoading={emailLogsLoading}
                emailLogsError={emailLogsError}
                emailLogsPage={emailLogsPage}
                setEmailLogsPage={setEmailLogsPage}
                emailStatusFilter={emailStatusFilter}
                setEmailStatusFilter={setEmailStatusFilter}
                emailStats={emailStats}
                fetchEmailLogs={fetchEmailLogs}
              />
            </TabsContent>

            {/* ── Feature Flags tab ── */}
            <TabsContent value="flags">
              <FeatureFlagsTab
                featureFlags={featureFlags}
                flagsLoading={flagsLoading}
                flagsError={flagsError}
                flagCategoryFilter={flagCategoryFilter}
                setFlagCategoryFilter={setFlagCategoryFilter}
                showAddFlag={showAddFlag}
                setShowAddFlag={setShowAddFlag}
                newFlag={newFlag}
                setNewFlag={setNewFlag}
                fetchFeatureFlags={fetchFeatureFlags}
                handleFlagToggle={handleFlagToggle}
                handleAddFlag={handleAddFlag}
                handleDeleteFlag={handleDeleteFlag}
              />
            </TabsContent>
          </Tabs>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}
