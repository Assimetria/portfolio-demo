# UX Components Guide

> Purpose: usage examples for the dashboard, onboarding and settings components in `client/src/app/components/@system/`. Prop-level reference: `SYSTEM_COMPONENTS_API.md`. Live examples: `/app/ux-demo` and `/app/mobile-demo` in a running app.
> Last verified: 2026-09-20.

This guide documents the UX features and reusable components added to the product template.

## 📊 Dashboard Components

### DashboardLayout
Main layout component providing consistent structure across all app pages.

**Features:**
- Sidebar with navigation
- Header with user menu
- Responsive design
- Customizable navigation items

**Usage:**
```jsx
import { DashboardLayout } from '@/app/components/@system/Dashboard'

<DashboardLayout>
  <DashboardLayout.Header 
    title="Dashboard" 
    description="Welcome back!"
    actions={<Button>Action</Button>}
  />
  <DashboardLayout.Content>
    {/* Your content */}
  </DashboardLayout.Content>
</DashboardLayout>
```

### StatCard
Display key metrics with optional trends and actions.

**Features:**
- Trend indicators (up/down)
- Custom icons
- Action buttons
- Loading states
- Responsive grid layout

**Usage:**
```jsx
import { StatCard, StatCardGrid } from '@/app/components/@system/Dashboard'

<StatCardGrid>
  <StatCard
    label="Total Users"
    value="1,234"
    trend={{ value: 12, direction: 'up' }}
    description="vs last month"
    icon={Users}
  />
</StatCardGrid>
```

### RecentActivityList
Chronological activity feed with timestamps and variants.

**Features:**
- Relative timestamps
- Visual variants (success, warning, error)
- Clickable items
- Empty states
- Compact mode for sidebars

**Usage:**
```jsx
import { RecentActivityList } from '@/app/components/@system/Dashboard'

<RecentActivityList
  items={[
    {
      id: 1,
      icon: User,
      title: 'Profile updated',
      timestamp: '2024-03-07T10:30:00Z',
      variant: 'success'
    }
  ]}
/>
```

### QuickActions
Grid of frequently used actions.

**Features:**
- Grid or list layout
- Icon-based buttons
- Disabled states
- Compact horizontal scroll variant

**Usage:**
```jsx
import { QuickActions } from '@/app/components/@system/Dashboard'

<QuickActions
  actions={[
    { 
      id: 'create', 
      icon: Plus, 
      label: 'Create new',
      onClick: () => {}
    }
  ]}
/>
```

### DataTable
Advanced table with sorting, filtering, and pagination.

**Features:**
- Column sorting
- Search/filter
- Pagination
- Custom cell rendering
- Loading states
- Empty states
- Row click handlers

**Usage:**
```jsx
import { DataTable } from '@/app/components/@system/Dashboard'

<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { 
      key: 'status', 
      label: 'Status', 
      render: (value) => <Badge>{value}</Badge> 
    }
  ]}
  data={rows}
  searchable
  paginated
  onRowClick={(row) => console.log(row)}
/>
```

## 🎯 Onboarding

### OnboardingWizard
Multi-step wizard for first-time users.

**Features:**
- 4-step flow: Welcome → Use Case → Referral → Done
- Animated transitions
- Progress indicators
- Skip options
- Data collection

**Steps:**
1. **Welcome** - Collect user's name
2. **Use Case** - Understand how they'll use the app
3. **Referral Source** - Track acquisition channels
4. **Completion** - Smooth transition to dashboard

**Usage:**
```jsx
import { OnboardingWizard } from '@/app/components/@system/OnboardingWizard'

// Render in OnboardingPage
<OnboardingWizard />
```

## ⚙️ User Settings

### UserSettings
Complete settings interface with tabbed navigation.

**Features:**
- 4 main tabs: Profile, Security, Notifications, Preferences
- Consistent layout patterns
- Auto-save indicators
- Form validation

**Tabs:**

#### 1. Profile Settings
- Avatar upload
- Name and email management
- Bio editor
- Account deletion (danger zone)

#### 2. Security Settings
- Password change
- Two-factor authentication
- Active sessions management
- Security recommendations checklist

#### 3. Notification Settings
- Email preferences
- In-app notifications
- Push notifications
- Notification digest

#### 4. Preferences Settings
- Theme selection (light/dark/system)
- Language and timezone
- Date format
- Compact mode
- Accessibility options

**Usage:**
```jsx
import { UserSettings } from '@/app/components/@system/UserSettings'

<UserSettings 
  user={currentUser}
  onUpdate={(updates) => saveSettings(updates)}
  defaultTab="security"
/>
```

### Reusable Settings Components

**SettingsSection** - Organize settings into sections:
```jsx
<SettingsSection
  title="Security"
  description="Manage your account security"
>
  {/* Settings content */}
</SettingsSection>
```

**SettingsRow** - Label + control layout:
```jsx
<SettingsRow
  label="Two-factor authentication"
  description="Extra security for your account"
>
  <Switch checked={enabled} />
</SettingsRow>
```

## 🎨 Design Patterns

### Consistent Spacing
- Section spacing: `mb-8`
- Row spacing: `py-3`
- Card padding: `p-4` or `p-6`

### Loading States
- Skeleton screens for all data components
- Spinner buttons for actions
- Pulse animations for placeholders

### Empty States
- Clear messaging
- Suggested actions
- Consistent icons

### Form Patterns
- Clear labels
- Validation messages
- Error states
- Success feedback

### Responsive Design
- Mobile-first approach
- Grid systems (2/3/4 columns)
- Horizontal scrolling on mobile
- Collapsible sections

## 🚀 Implementation Checklist

When implementing these components:

- [ ] Import from centralized exports
- [ ] Provide proper TypeScript types (if using TS)
- [ ] Handle loading and error states
- [ ] Test responsive behavior
- [ ] Ensure accessibility (keyboard navigation, ARIA labels)
- [ ] Add proper icons from lucide-react
- [ ] Implement actual API calls (components use mock handlers)
- [ ] Add analytics tracking for user actions
- [ ] Test with real user data

## 🔧 Customization

All components accept `className` props for custom styling:

```jsx
<StatCard className="custom-class" />
```

Theme customization via Tailwind config and CSS variables.

## 📝 Best Practices

1. **Consistency** - Use the same patterns across your app
2. **Feedback** - Always show loading/success/error states
3. **Progressive Disclosure** - Don't overwhelm users with options
4. **Accessibility** - Keyboard navigation, screen reader support
5. **Performance** - Lazy load heavy components
6. **Mobile** - Test on actual devices

## 🐛 Troubleshooting

**Components not rendering?**
- Check imports are correct
- Verify dependencies are installed
- Check console for errors

**Styling issues?**
- Ensure Tailwind CSS is configured
- Check CSS variable definitions
- Verify component hierarchy

**TypeScript errors?**
- Add proper type definitions
- Check prop types match
- Use TypeScript-friendly patterns

## 📚 Additional Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)
- [React Router](https://reactrouter.com)
- [Framer Motion](https://www.framer.com/motion/) (used in OnboardingWizard)

---

**Created for:** Task #9432 - Add UX features to product template  
**Components:** Dashboard, Onboarding, User Settings  
**Status:** ✅ Complete and ready to use
