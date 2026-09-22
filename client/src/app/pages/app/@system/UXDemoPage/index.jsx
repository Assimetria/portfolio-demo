// @system — UX Components Demo Page
// Comprehensive showcase of all reusable Dashboard, Onboarding, and Settings components
// Route: /app/ux-demo (or similar)

import { useState } from 'react'
import { 
  Users, DollarSign, TrendingUp, Activity, 
  Plus, FileText, Settings, Zap, Star, CheckCircle 
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../components/@system/Tabs'
import { Card } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import {
  DashboardLayout,
  StatCard,
  StatCardGrid,
  RecentActivityList,
  QuickActions,
  DataTable,
  WelcomeCard,
  FiltersBar,
  BulkActions,
  MobileTable,
} from '../../../../components/@system/Dashboard'
import {
  OnboardingWizard,
  GuidedTour,
  ProgressChecklist,
} from '../../../../components/@system/Onboarding'
import {
  UserSettings,
  SettingsSection,
  SettingsRow,
} from '../../../../components/@system/UserSettings'

// Demo data
const DEMO_STATS = [
  {
    label: 'Total Users',
    value: '2,543',
    trend: { value: 12, direction: 'up' },
    description: 'vs last month',
    icon: Users,
  },
  {
    label: 'Revenue',
    value: '$45,231',
    trend: { value: 8, direction: 'up' },
    description: 'vs last month',
    icon: DollarSign,
  },
  {
    label: 'Growth Rate',
    value: '24.5%',
    trend: { value: 3, direction: 'up' },
    description: 'year over year',
    icon: TrendingUp,
  },
  {
    label: 'Active Sessions',
    value: '1,234',
    trend: { value: 5, direction: 'down' },
    description: 'currently online',
    icon: Activity,
  },
]

const DEMO_ACTIVITY = [
  {
    id: 1,
    icon: Users,
    title: 'New user registered',
    description: 'john.doe@example.com',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    variant: 'success',
  },
  {
    id: 2,
    icon: DollarSign,
    title: 'Payment received',
    description: '$99.00 from Premium subscription',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    variant: 'success',
  },
  {
    id: 3,
    icon: FileText,
    title: 'Report generated',
    description: 'Monthly analytics report',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    variant: 'default',
  },
  {
    id: 4,
    icon: Settings,
    title: 'Settings updated',
    description: 'Security preferences changed',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    variant: 'warning',
  },
]

const DEMO_QUICK_ACTIONS = [
  { id: 'new-user', icon: Users, label: 'Add User', onClick: () => alert('Add User clicked') },
  { id: 'new-report', icon: FileText, label: 'New Report', onClick: () => alert('New Report clicked') },
  { id: 'analytics', icon: TrendingUp, label: 'Analytics', onClick: () => alert('Analytics clicked') },
  { id: 'settings', icon: Settings, label: 'Settings', onClick: () => alert('Settings clicked') },
]

const DEMO_TABLE_DATA = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', status: 'active', plan: 'Premium', joined: '2024-01-15' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', status: 'active', plan: 'Free', joined: '2024-02-20' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', status: 'inactive', plan: 'Premium', joined: '2024-01-08' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', status: 'active', plan: 'Business', joined: '2024-03-01' },
  { id: 5, name: 'Ethan Hunt', email: 'ethan@example.com', status: 'active', plan: 'Free', joined: '2024-02-14' },
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

const DEMO_ONBOARDING_TASKS = [
  { id: 'profile', title: 'Complete your profile', description: 'Add your name and photo', completed: false },
  { id: 'billing', title: 'Set up billing', description: 'Add a payment method', completed: false },
  { id: 'invite', title: 'Invite team members', description: 'Collaborate together', completed: false },
  { id: 'api', title: 'Create API key', description: 'Start integrating', completed: false },
]

const TOUR_STEPS = [
  {
    selector: '[data-tour="stats"]',
    title: 'Dashboard Metrics',
    content: 'These StatCards display key metrics with trend indicators and icons.',
  },
  {
    selector: '[data-tour="actions"]',
    title: 'Quick Actions',
    content: 'Access frequently used features with one click.',
  },
  {
    selector: '[data-tour="activity"]',
    title: 'Activity Feed',
    content: 'Stay updated with real-time activity notifications.',
  },
]

export function UXDemoPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tourActive, setTourActive] = useState(false)
  const [selectedRows, setSelectedRows] = useState([])

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">UX Components Showcase</h1>
            <p className="mt-2 text-brand-text-muted">
              Interactive demo of all reusable Dashboard, Onboarding, and Settings components.
              Use these patterns throughout your app for a consistent user experience.
            </p>
          </div>

          {/* Component Demos */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
            </TabsList>

            {/* Dashboard Components Tab */}
            <TabsContent value="dashboard" className="space-y-8">
              {/* Stat Cards */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Stat Cards</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Display key metrics with trend indicators, icons, and descriptions.
                </p>
                <StatCardGrid data-tour="stats">
                  {DEMO_STATS.map((stat) => (
                    <StatCard key={stat.label} {...stat} />
                  ))}
                </StatCardGrid>
              </div>

              {/* Grid Layout */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Activity */}
                <div data-tour="activity">
                  <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                  <p className="text-sm text-brand-text-muted mb-4">
                    Timeline of events with icons, timestamps, and status variants.
                  </p>
                  <RecentActivityList items={DEMO_ACTIVITY} />
                </div>

                {/* Quick Actions */}
                <div data-tour="actions">
                  <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                  <p className="text-sm text-brand-text-muted mb-4">
                    Grid of action buttons for common tasks.
                  </p>
                  <QuickActions actions={DEMO_QUICK_ACTIONS} />
                </div>
              </div>

              {/* Data Table */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Data Table</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Sortable, searchable table with pagination and custom cell rendering.
                </p>
                <DataTable
                  title="Users"
                  description="Manage user accounts"
                  data={DEMO_TABLE_DATA}
                  columns={TABLE_COLUMNS}
                  onRowClick={() => {}}
                  searchPlaceholder="Search users..."
                  emptyMessage="No users found"
                />
              </div>

              {/* Welcome Card */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Welcome Card</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Onboarding checklist for new users with progress tracking.
                </p>
                <WelcomeCard
                  user={{ name: 'Demo User' }}
                  tasks={DEMO_ONBOARDING_TASKS}
                  onTaskClick={(task) => alert(`Task clicked: ${task.title}`)}
                  onDismiss={() => alert('Welcome card dismissed')}
                />
              </div>

              {/* Filters Bar */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Filters Bar</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Advanced filtering interface with search, date range, and dropdowns.
                </p>
                <Card className="p-4">
                  <FiltersBar
                    onSearchChange={() => {}}
                    onDateRangeChange={() => {}}
                    onFiltersChange={() => {}}
                    filters={[
                      { key: 'status', label: 'Status', options: ['active', 'inactive', 'pending'] },
                      { key: 'plan', label: 'Plan', options: ['free', 'premium', 'business'] },
                    ]}
                  />
                </Card>
              </div>

              {/* Bulk Actions */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Bulk Actions</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Multi-select operations for data tables.
                </p>
                <Card className="p-4">
                  <BulkActions
                    selectedCount={selectedRows.length}
                    totalCount={DEMO_TABLE_DATA.length}
                    onSelectAll={() => setSelectedRows(DEMO_TABLE_DATA.map(r => r.id))}
                    onDeselectAll={() => setSelectedRows([])}
                    actions={[
                      { id: 'export', label: 'Export', onClick: () => alert('Export selected') },
                      { id: 'delete', label: 'Delete', onClick: () => alert('Delete selected'), variant: 'destructive' },
                    ]}
                  />
                </Card>
              </div>
            </TabsContent>

            {/* Onboarding Components Tab */}
            <TabsContent value="onboarding" className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">Onboarding Wizard</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Multi-step wizard for first-time user setup with progress indicator.
                </p>
                <Card className="p-6 max-w-2xl mx-auto">
                  <OnboardingWizard />
                </Card>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Guided Tour</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Interactive product tour with spotlight highlights.
                </p>
                <Button onClick={() => setTourActive(true)}>
                  Start Demo Tour
                </Button>
                <GuidedTour
                  steps={TOUR_STEPS}
                  isActive={tourActive}
                  onComplete={() => setTourActive(false)}
                  onSkip={() => setTourActive(false)}
                  storageKey="ux-demo-tour"
                />
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Progress Checklist</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Task list with completion tracking and progress bar.
                </p>
                <Card className="p-6 max-w-2xl mx-auto">
                  <ProgressChecklist
                    title="Get Started"
                    description="Complete these tasks to set up your account"
                    tasks={DEMO_ONBOARDING_TASKS.map(task => ({
                      ...task,
                      action: () => alert(`Action: ${task.title}`)
                    }))}
                    onComplete={() => alert('All tasks completed!')}
                  />
                </Card>
              </div>
            </TabsContent>

            {/* Settings Components Tab */}
            <TabsContent value="settings" className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">User Settings</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Complete settings interface with 7 tabs: Profile, Security, Notifications,
                  Preferences, Connections, Data Export, and Keyboard Shortcuts.
                </p>
                <Card className="p-6">
                  <UserSettings
                    user={{ name: 'Demo User', email: 'demo@example.com' }}
                    onUpdate={() => Promise.resolve({ success: true })}
                  />
                </Card>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Settings Patterns</h2>
                <p className="text-sm text-brand-text-muted mb-4">
                  Reusable components for building custom settings pages.
                </p>
                <Card className="p-6 max-w-2xl">
                  <SettingsSection
                    title="Example Section"
                    description="Use SettingsSection to organize your settings"
                  >
                    <SettingsRow
                      label="Example Setting"
                      description="This is a description of the setting"
                    >
                      <Button size="sm">Edit</Button>
                    </SettingsRow>
                    <SettingsRow
                      label="Another Setting"
                      description="Settings can have any controls"
                    >
                      <Button size="sm" variant="outline">Configure</Button>
                    </SettingsRow>
                  </SettingsSection>
                </Card>
              </div>
            </TabsContent>

            {/* Design Patterns Tab */}
            <TabsContent value="patterns" className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">Design Patterns</h2>
                <div className="prose dark:prose-invert max-w-none">
                  <h3>Consistent Spacing</h3>
                  <ul>
                    <li>Section spacing: <code>mb-8</code></li>
                    <li>Row spacing: <code>py-3</code></li>
                    <li>Card padding: <code>p-4</code> or <code>p-6</code></li>
                  </ul>

                  <h3>Loading States</h3>
                  <ul>
                    <li>Skeleton screens for data components</li>
                    <li>Spinner buttons for actions</li>
                    <li>Pulse animations for placeholders</li>
                  </ul>

                  <h3>Empty States</h3>
                  <ul>
                    <li>Clear messaging</li>
                    <li>Suggested actions</li>
                    <li>Consistent icons</li>
                  </ul>

                  <h3>Form Patterns</h3>
                  <ul>
                    <li>Clear labels above inputs</li>
                    <li>Validation messages below fields</li>
                    <li>Error states with red borders</li>
                    <li>Success feedback with green text</li>
                  </ul>

                  <h3>Responsive Design</h3>
                  <ul>
                    <li>Mobile-first approach</li>
                    <li>Grid systems: 2/3/4 columns on desktop</li>
                    <li>Horizontal scrolling on mobile for tables</li>
                    <li>Collapsible sections for small screens</li>
                  </ul>

                  <h3>Accessibility</h3>
                  <ul>
                    <li>Keyboard navigation (Tab, arrows, Enter, Esc)</li>
                    <li>ARIA labels for screen readers</li>
                    <li>Focus visible indicators</li>
                    <li>Color contrast ratios (4.5:1 minimum)</li>
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Usage Guidelines</h2>
                <Card className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-[var(--color-success)] mt-0.5" />
                      <div>
                        <p className="font-medium">Import from centralized exports</p>
                        <p className="text-sm text-brand-text-muted">
                          Use <code>@/app/components/@system</code> for clean imports
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-[var(--color-success)] mt-0.5" />
                      <div>
                        <p className="font-medium">Handle loading and error states</p>
                        <p className="text-sm text-brand-text-muted">
                          Always show feedback to users during async operations
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-[var(--color-success)] mt-0.5" />
                      <div>
                        <p className="font-medium">Test responsive behavior</p>
                        <p className="text-sm text-brand-text-muted">
                          Verify components work on mobile, tablet, and desktop
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-[var(--color-success)] mt-0.5" />
                      <div>
                        <p className="font-medium">Ensure accessibility</p>
                        <p className="text-sm text-brand-text-muted">
                          Test keyboard navigation and screen reader support
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}
