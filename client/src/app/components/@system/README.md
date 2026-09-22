# System Components - Quick Reference

> Purpose: orientation for `client/src/app/components/@system/`. Full prop reference: `docs/SYSTEM_COMPONENTS_API.md`; usage guide: `docs/UX_COMPONENTS_GUIDE.md`; styling rules: `docs/DESIGN-SYSTEM.md`. These files are template-managed: extend or shadow them from `components/@custom/` (`docs/CUSTOM-OVERRIDES.md` section 5).
> Last verified: 2026-09-20.

This directory contains reusable, production-ready UX components organized by category.

## 📁 Directory Structure

- **Dashboard/** - Dashboard layouts, stats, tables, activity feeds
- **Onboarding/** - User onboarding wizards, guided tours, progress checklists
- **UserSettings/** - Complete settings interface with multiple panels
- **Form/** - Form inputs, validation, mobile-friendly forms
- **Modal/** - Modal dialogs and overlays
- **Card/** - Card containers with headers and content sections
- **Button/** - Button components with variants
- **Loading/** - Loading spinners and skeleton screens
- **Sidebar/** - Navigation sidebars
- **Header/** - App headers with navigation
- **Tabs/** - Tabbed interfaces
- **Table/** - Data tables
- **ui/** - Base UI primitives (shadcn/ui style)

## 🚀 Quick Start

### Dashboard
```jsx
import { DashboardLayout, StatCard, DataTable } from '@/app/components/@system/Dashboard'

<DashboardLayout>
  <DashboardLayout.Content>
    <DashboardLayout.Header title="Dashboard" />
    <StatCard label="Users" value="1,234" />
    <DataTable columns={cols} data={data} />
  </DashboardLayout.Content>
</DashboardLayout>
```

### Onboarding
```jsx
import { OnboardingWizard, GuidedTour, ProgressChecklist } from '@/app/components/@system/Onboarding'

<OnboardingWizard onComplete={completeSetup} />
<GuidedTour steps={tourSteps} onComplete={finishTour} />
<ProgressChecklist items={tasks} />
```

### Settings
```jsx
import {
  UserSettings,
  ProfileSettings,
  SecuritySettings,
  NotificationSettings
} from '@/app/components/@system/UserSettings'

<UserSettings>
  <UserSettings.Tab id="profile" label="Profile">
    <ProfileSettings />
  </UserSettings.Tab>
</UserSettings>
```

## 📖 Full Documentation

See `docs/UX_COMPONENTS_GUIDE.md` and `docs/SYSTEM_COMPONENTS_API.md` for comprehensive documentation with:
- Detailed component APIs
- Usage examples
- Best practices
- Customization guide
- Common patterns

## 🎨 Live Demo

Visit `/app/ux-demo` (and `/app/mobile-demo`) in your running app to see the components in action with interactive examples.

## 🔧 Customization

All components:
- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Dark mode support
- ✅ Accessible (WCAG 2.1)
- ✅ Customizable via Tailwind classes
- ✅ TypeScript friendly

To customize:
1. Change colours, fonts and theme in `brand.json` (regenerates the tokens in `styles/@custom/brand.css`)
2. Pass custom classes via the `className` prop
3. Extend or shadow components in `components/@custom/` (same export name wins in the barrel)

## 🤝 Contributing

When adding new components:
1. Follow existing patterns and naming conventions
2. Add PropTypes or TypeScript types
3. Ensure responsive design
4. Test accessibility
5. Update this README and main docs

## 📦 Component Index

### Dashboard
- `DashboardLayout` - Page layout with sidebar
- `StatCard` / `StatCardGrid` - Metric cards
- `RecentActivityList` - Activity timeline
- `QuickActions` - Action shortcuts
- `DataTable` - Feature-rich table
- `WelcomeCard` - Dismissible welcome message
- `FiltersBar` - Filter controls
- `BulkActions` - Bulk operation toolbar
- `MobileTable` - Mobile-optimized table view

### Onboarding
- `OnboardingWizard` - Multi-step wizard
- `GuidedTour` - Interactive UI tour
- `ProgressChecklist` - Task checklist

### User Settings
- `UserSettings` - Settings container
- `ProfileSettings` - Profile management
- `SecuritySettings` - Security & 2FA
- `NotificationSettings` - Notification preferences
- `PreferencesSettings` - App preferences
- `KeyboardShortcuts` - Shortcut management
- `DataExport` - Data export (GDPR)
- `ConnectedAccounts` - OAuth accounts

### UI Primitives
- `Button` - Buttons with variants
- `Card` / `CardHeader` / `CardContent` - Cards
- `Input` / `FormField` - Form inputs
- `Switch` - Toggle switches
- `Badge` - Status badges
- `Tabs` - Tabbed interface
- `Modal` - Modal dialogs
- `Alert` - Alert messages

## 📝 Notes

- Components in `@system` are framework components - stable and rarely change
- Customize by creating variants in `@custom` directory
- All components lazy-load where appropriate
- Icons use `lucide-react` for consistency
