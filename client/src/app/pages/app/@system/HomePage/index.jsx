// @system — main app dashboard page with modern UX components + REAL COST TRACKING
// @custom — add your dashboard widgets/sections in the main content area
import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, DollarSign, Activity as ActivityIcon, TrendingUp, FileText, AlertCircle } from 'lucide-react'
import { useAuthContext } from '../../../../store/@system/auth'
import { HomePageSkeleton } from '../../../../components/@system/Skeleton'
import { Button } from '../../../../components/@system/ui/button'
import {
  DashboardLayout,
  StatCard,
  StatCardGrid,
  RecentActivityList,
  QuickActions,
  DataTable,
  WelcomeCard,
} from '../../../../components/@system/Dashboard'
import { CommandPalette } from '../../../../components/@system/CommandPalette'
import { GuidedTour } from '../../../../components/@system/Onboarding/GuidedTour'
import { AnnouncementBanner } from '../../../../components/@system/AnnouncementBanner'
import { getUsageDashboard } from '../../../../api/@system/usage'
import { isModuleEnabled, filterByModules } from '@/config/@system/modules'

// Feature modules (brand.json `modules`): with `usage` off this page never
// calls /api/usage/* (the router is not mounted); with `billing` off it shows
// no billing links; onboarding tasks for disabled modules are dropped.
const HAS_USAGE = isModuleEnabled('usage')
const HAS_BILLING = isModuleEnabled('billing')

// @custom — Replace with real activity from your API
const MOCK_ACTIVITY = [
  {
    id: 1,
    icon: Users,
    title: 'New user signed up',
    description: 'john@example.com',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    variant: 'success',
  },
  {
    id: 2,
    icon: DollarSign,
    title: 'Payment received',
    description: '$49.99 from Premium plan',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    variant: 'success',
  },
  {
    id: 3,
    icon: FileText,
    title: 'New document created',
    description: 'Project proposal draft',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    variant: 'default',
  },
  {
    id: 4,
    icon: Users,
    title: 'User upgraded plan',
    description: 'Free → Premium',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    variant: 'success',
  },
  {
    id: 5,
    icon: ActivityIcon,
    title: 'API usage spike',
    description: '1,234 requests in last hour',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    variant: 'warning',
  },
]

// @custom — Replace with real actions relevant to your app
const MOCK_QUICK_ACTIONS = [
  {
    id: 'create-user',
    icon: Users,
    label: 'Add User',
    onClick: () => {},
  },
  {
    id: 'create-invoice',
    icon: FileText,
    label: 'New Invoice',
    onClick: () => {},
  },
  {
    id: 'view-reports',
    icon: TrendingUp,
    label: 'View Reports',
    onClick: () => {},
  },
  {
    id: 'api-docs',
    icon: FileText,
    label: 'API Docs',
    onClick: () => {},
  },
]

// @custom — Replace with real table data from your API
const MOCK_TABLE_DATA = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
    plan: 'Premium',
    joined: '2024-01-15',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    status: 'active',
    plan: 'Free',
    joined: '2024-02-20',
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob@example.com',
    status: 'inactive',
    plan: 'Premium',
    joined: '2024-01-08',
  },
  {
    id: 4,
    name: 'Alice Williams',
    email: 'alice@example.com',
    status: 'active',
    plan: 'Business',
    joined: '2024-03-01',
  },
  {
    id: 5,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    status: 'active',
    plan: 'Free',
    joined: '2024-02-14',
  },
]

const TABLE_COLUMNS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (value) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          value === 'active'
            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]/30 dark:text-[var(--color-success)]'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-brand-text-muted'
        }`}
      >
        {value}
      </span>
    ),
  },
  { key: 'plan', label: 'Plan', sortable: true },
  { key: 'joined', label: 'Joined', sortable: true },
]

// @custom — Configure guided tour steps for your product
const TOUR_STEPS = [
  {
    selector: '[data-tour="stats"]',
    title: 'Your Key Metrics',
    content: 'Track important numbers at a glance. These update in real-time as your data changes.',
  },
  {
    selector: '[data-tour="quick-actions"]',
    title: 'Quick Actions',
    content: 'Access your most-used features in one click. You can also press ⌘K to search for any action.',
  },
  {
    selector: '[data-tour="activity"]',
    title: 'Recent Activity',
    content: 'Stay on top of everything happening in your account with the activity feed.',
  },
  {
    selector: '[data-tour="data-table"]',
    title: 'Data Tables',
    content: 'Search, sort, and filter your data. Click any row to view details.',
  },
]

// @custom — Configure onboarding tasks for new users
const ONBOARDING_TASKS = filterByModules([
  {
    id: 'profile',
    title: 'Complete your profile',
    description: 'Add your name and photo',
    route: '/app/settings',
  },
  {
    id: 'billing',
    title: 'Set up billing',
    description: 'Add a payment method',
    route: '/app/billing',
    module: 'billing',
  },
  {
    id: 'invite',
    title: 'Invite your team',
    description: 'Collaborate with teammates',
    route: '/app/teams',
    module: 'teams',
  },
  {
    id: 'api-key',
    title: 'Create an API key',
    description: 'Start integrating',
    route: '/app/api-keys',
    module: 'apiKeys',
  },
])

export function HomePage() {
  const { user, loading } = useAuthContext()
  const navigate = useNavigate()
  const [tourActive, setTourActive] = useState(false)
  const [usageData, setUsageData] = useState(null)
  const [usageLoading, setUsageLoading] = useState(HAS_USAGE)
  const [usageError, setUsageError] = useState(null)

  // Fetch real cost data — only when the usage module is on
  useEffect(() => {
    if (!HAS_USAGE) return
    async function loadUsageData() {
      try {
        setUsageLoading(true)
        const data = await getUsageDashboard()
        setUsageData(data)
        setUsageError(null)
      } catch (err) {
        console.error('Failed to load usage data:', err)
        setUsageError(err.message)
      } finally {
        setUsageLoading(false)
      }
    }

    if (user && !loading) {
      loadUsageData()
    }
  }, [user, loading])

  // Build stats from real cost data
  const stats = usageData
    ? [
        {
          label: 'Today\'s Cost',
          value: `$${(usageData.today?.cost ?? 0).toFixed(2)}`,
          trend: usageData.yesterday?.change ?? null,
          description: 'vs yesterday',
          icon: DollarSign,
        },
        {
          label: 'This Month',
          value: `$${(usageData.thisMonth?.cost ?? 0).toFixed(2)}`,
          trend: usageData.lastMonth?.change ?? null,
          description: usageData.limits?.monthly
            ? `${usageData.thisMonth?.percentUsed ?? 0}% of $${usageData.limits.monthly} limit`
            : 'this month',
          icon: TrendingUp,
        },
        ...((usageData.topServices ?? []).slice(0, 2).map(service => ({
          label: service.service.charAt(0).toUpperCase() + service.service.slice(1),
          value: `$${(service.cost ?? 0).toFixed(2)}`,
          trend: null,
          description: `${service.requests ?? 0} requests`,
          icon: ActivityIcon,
        }))),
      ]
    : [
        // Fallback mock stats while loading
        {
          label: 'Total Users',
          value: '—',
          trend: null,
          description: 'Loading...',
          icon: Users,
        },
        {
          label: 'Revenue',
          value: '—',
          trend: null,
          description: 'Loading...',
          icon: DollarSign,
        },
      ]

  // @custom — Replace with real completion logic from your API
  const tasks = ONBOARDING_TASKS.map((task) => ({
    ...task,
    completed: user?.onboardingCompleted ? true : false,
  }))

  const handleTaskClick = useCallback(
    (task) => {
      if (task.route) navigate(task.route)
    },
    [navigate]
  )

  if (loading) {
    return <HomePageSkeleton />
  }

  return (
    <DashboardLayout>
      {/* Announcement banner — @custom: change message/variant as needed */}
      {HAS_USAGE && (
        <AnnouncementBanner
          id="welcome-v1"
          message="Real-time cost tracking is now live — monitor your usage across all services."
          variant="gradient"
          action={HAS_BILLING ? { label: 'Learn more', href: '/app/billing' } : undefined}
        />
      )}

      {/* Command palette — available globally via ⌘K */}
      <CommandPalette />

      {/* Guided tour — starts on demand */}
      <GuidedTour
        steps={TOUR_STEPS}
        isActive={tourActive}
        onComplete={() => setTourActive(false)}
        onSkip={() => setTourActive(false)}
        storageKey="dashboard-tour-completed"
      />

      <DashboardLayout.Content>
        {/* Welcome card with onboarding checklist for new users */}
        {!user?.onboardingCompleted && (
          <div className="mb-6">
            <WelcomeCard
              user={user}
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onDismiss={() => {}}
            />
          </div>
        )}

        {/* Cost limit warning */}
        {usageData?.limits?.monthly && usageData?.thisMonth?.percentUsed > 80 && (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-900/20">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Approaching monthly cost limit
                </h3>
                <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                  You've used {usageData.thisMonth.percentUsed}% of your ${usageData.limits.monthly} monthly limit.
                  {HAS_BILLING && (
                    <>
                      {' '}
                      <a href="/app/billing" className="font-medium underline">Adjust limits</a>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page header */}
        <DashboardLayout.Header
          title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
          description="Here's what's happening with your account today."
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTourActive(true)}
                className="text-brand-text-muted"
              >
                Take a tour
              </Button>
              {HAS_USAGE && HAS_BILLING && (
                <Button variant="outline" size="sm" onClick={() => navigate('/app/billing')}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  View Usage
                </Button>
              )}
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Item
              </Button>
            </>
          }
        />

        {/* Stats grid with REAL cost data — usage module only */}
        {HAS_USAGE && (
          <StatCardGrid data-tour="stats">
            {usageLoading ? (
              <div className="col-span-4 text-center text-brand-text-muted py-8">
                Loading cost data...
              </div>
            ) : usageError ? (
              <div className="col-span-4 text-center text-brand-text-muted py-8">
                {usageError}
              </div>
            ) : (
              stats.map((stat) => <StatCard key={stat.label} {...stat} />)
            )}
          </StatCardGrid>
        )}

        {/* Cost trends chart */}
        {usageData?.trends && (
          <div className="mt-6">
            <div className="rounded-lg border bg-brand-surface p-6">
              <h3 className="text-lg font-semibold mb-4">7-Day Cost Trend</h3>
              <div className="h-64 flex items-end justify-between gap-2">
                {usageData.trends.map((day, i) => {
                  const maxCost = Math.max(...usageData.trends.map(d => d.cost), 1)
                  const height = (day.cost / maxCost) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-brand-primary/10 rounded-t relative" style={{ height: `${height}%` }}>
                        <div className="absolute inset-0 bg-brand-primary rounded-t hover:bg-brand-primary/80 transition-colors" />
                      </div>
                      <span className="text-xs text-brand-text-muted mt-2">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-xs font-medium">${day.cost.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Recent activity */}
          <div data-tour="activity">
            <RecentActivityList items={MOCK_ACTIVITY} />
          </div>

          {/* Quick actions */}
          <div data-tour="quick-actions">
            <QuickActions actions={MOCK_QUICK_ACTIONS} />
          </div>
        </div>

        {/* Data table */}
        <div className="mt-6" data-tour="data-table">
          <DataTable
            title="Recent Users"
            description="Overview of user activity"
            data={MOCK_TABLE_DATA}
            columns={TABLE_COLUMNS}
            onRowClick={() => {}}
            searchPlaceholder="Search users..."
            emptyMessage="No users found."
          />
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}
