# @system Components — API Reference

> Purpose: prop reference for every component under `client/src/app/components/@system/`. Styling rules are in `DESIGN-SYSTEM.md`; how to shadow a component from `@custom` is in `CUSTOM-OVERRIDES.md`.
> Last verified: 2026-09-20 (directory listing of `components/@system`).

Complete API reference for all reusable components under `client/src/app/components/@system/`.

- **Import base:** `@/app/components/@system/<ComponentName>`
- **Read-only:** These components are template-managed. Do not edit — extend or wrap in `@custom/` instead.
- **Styling:** Tailwind + shadcn/ui primitives, dark-mode aware, WCAG 2.1.
- **Icons:** `lucide-react` (no emoji, no FontAwesome).

---

## Table of Contents

- [Feedback & Overlay](#feedback--overlay) — Alert, AnnouncementBanner, Modal, MobileModal, BottomSheet, Toast/Toaster
- [Inputs & Forms](#inputs--forms) — Form, FileUpload, MobileForm, Select, Switch, Textarea
- [Auth](#auth) — LoginForm, RegisterForm, PasswordResetForm, OAuthButtons, OAuthCallback, TwoFactor, PrivateRoute, ProtectedRoute, MetaMaskConnect
- [Navigation](#navigation) — Header, Footer, Sidebar, LandingNavbar, Breadcrumbs, Pagination, Tabs, SkipToContent
- [Data Display](#data-display) — Table, ResponsiveTable, Card, MetricCard, Badge, Avatar, ProgressBar, Skeleton, EmptyState
- [Utility & Widgets](#utility--widgets) — Button, Dropdown, CommandPalette, ErrorBoundary, PageLayout, OgMeta, Spinner, Loading, FeedbackWidget, HelpWidget, NotificationCenter, EmailVerificationBanner, CookieConsentBanner, FeatureSpotlight, UpgradeGate, TestimonialsSection
- [Dashboard](#dashboard) — DashboardLayout, StatCard, DataTable, FiltersBar, BulkActions, MobileTable, QuickActions, RecentActivityList, WelcomeCard
- [Onboarding](#onboarding) — OnboardingWizard, GuidedTour, ProgressChecklist
- [User Settings](#user-settings) — UserSettings + panels
- [Teams](#teams) — TeamList, MemberList, InvitationManager, PendingInvitations, InvitationBadge, CreateTeamModal
- [UI Primitives (shadcn)](#ui-primitives-shadcn)

---

## Feedback & Overlay

### Alert
Callout with semantic icon and optional dismiss.

**Import:** `import { Alert } from '@/app/components/@system/Alert'`

| Prop          | Type                                                          | Default     | Description               |
| ------------- | ------------------------------------------------------------- | ----------- | ------------------------- |
| `variant`     | `'default' \| 'info' \| 'success' \| 'warning' \| 'destructive'` | `'default'` | Visual variant + icon     |
| `title`       | `string`                                                      | —           | Alert title               |
| `dismissible` | `boolean`                                                     | `false`     | Renders close button      |
| `onClose`     | `() => void`                                                  | —           | Fires on dismiss          |
| `className`   | `string`                                                      | —           | Extra classes             |
| `children`    | `ReactNode`                                                   | —           | Body content              |

```jsx
<Alert variant="success" title="Saved" dismissible onClose={hide}>
  Your changes have been saved.
</Alert>
```

### AnnouncementBanner
Sticky top banner with optional CTA + localStorage-persisted dismissal.

**Import:** `import { AnnouncementBanner } from '@/app/components/@system/AnnouncementBanner'`

| Prop          | Type                                                             | Default     | Description                             |
| ------------- | ---------------------------------------------------------------- | ----------- | --------------------------------------- |
| `id`          | `string`                                                         | required    | Unique key for persisted dismiss state  |
| `message`     | `ReactNode`                                                      | required    | Banner content                          |
| `variant`     | `'default' \| 'info' \| 'warning' \| 'success' \| 'gradient'`     | `'default'` | Visual style                            |
| `action`      | `{ label: string; href?: string; onClick?: () => void }`         | —           | Optional CTA                            |
| `dismissible` | `boolean`                                                        | `true`      | Show close button                       |
| `persist`     | `boolean`                                                        | `true`      | Persist dismissal in localStorage       |
| `className`   | `string`                                                         | —           | Extra classes                           |

### Modal
General-purpose modal dialog + confirmation variant.

**Import:** `import { Modal, ConfirmModal } from '@/app/components/@system/Modal'`

Modal props:

| Prop          | Type                                          | Default | Description                |
| ------------- | --------------------------------------------- | ------- | -------------------------- |
| `open`        | `boolean`                                     | —       | Controlled open state      |
| `onClose`     | `() => void`                                  | —       | Close handler              |
| `title`       | `string`                                      | —       | Header title               |
| `description` | `string`                                      | —       | Header description         |
| `children`    | `ReactNode`                                   | —       | Body content               |
| `footer`      | `ReactNode`                                   | —       | Footer node                |
| `size`        | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'`      | `'md'`  | Max width                  |
| `className`   | `string`                                      | —       | Extra classes              |

ConfirmModal adds: `onConfirm`, `confirmText='Confirm'`, `cancelText='Cancel'`, `variant: 'default' | 'destructive'`, `loading=false`.

```jsx
<ConfirmModal
  open={open}
  onClose={close}
  onConfirm={handleDelete}
  title="Delete project?"
  description="This cannot be undone."
  variant="destructive"
/>
```

### MobileModal
Mobile-optimized modal (full-screen on small viewports).

**Import:** `import { MobileModal } from '@/app/components/@system/MobileModal'`

| Prop                   | Type                                     | Default | Description                    |
| ---------------------- | ---------------------------------------- | ------- | ------------------------------ |
| `open`                 | `boolean`                                | —       | Controlled open state          |
| `onClose`              | `() => void`                             | —       | Close handler                  |
| `title`                | `string`                                 | —       | Header title                   |
| `description`          | `string`                                 | —       | Header description             |
| `fullScreenOnMobile`   | `boolean`                                | `true`  | Full-screen ≤sm breakpoint     |
| `closeOnOverlayClick`  | `boolean`                                | `true`  | Overlay click closes           |
| `size`                 | `'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'`  | `'md'`  | Desktop width                  |

Subcomponents: `MobileModal.Content`, `MobileModal.Actions`.

### BottomSheet
Mobile bottom-drawer overlay (desktop falls back to centered dialog).

**Import:** `import { BottomSheet, BottomSheetAction, BottomSheetDivider } from '@/app/components/@system/BottomSheet'`

| Prop         | Type          | Default | Description               |
| ------------ | ------------- | ------- | ------------------------- |
| `open`       | `boolean`     | —       | Open state                |
| `onClose`    | `() => void`  | —       | Close handler             |
| `title`      | `string`      | —       | Optional title            |
| `description`| `string`      | —       | Optional description      |
| `showHandle` | `boolean`     | `true`  | Show drag handle          |
| `className`  | `string`      | —       | Extra classes             |

BottomSheetAction props: `icon`, `onClick`, `destructive=false`, `disabled=false`.

### Toast / Toaster
Re-exports of shadcn/ui toast primitives + preconfigured `<Toaster />` viewport.

**Import:**
```jsx
import { Toaster } from '@/app/components/@system/Toaster';
import { Toast, ToastAction, ToastClose, ToastDescription, ToastTitle, ToastViewport, ToastProvider } from '@/app/components/@system/Toast';
```

Mount `<Toaster />` once near the root. Trigger toasts via the `useToast` hook (from ui/toast).

---

## Inputs & Forms

### Form
Composable form helpers.

**Import:** `import { Form, FormField, FormLabel, Input, Textarea } from '@/app/components/@system/Form'`

- `Form`: `onSubmit`, `children`.
- `FormField`: `label`, `error`, `required`, `className`, `children`.
- `Input` / `Textarea`: `forwardRef` wrappers accepting `error` + native props.
- `FormLabel`: native label props.

```jsx
<Form onSubmit={handleSubmit}>
  <FormField label="Email" error={errors.email} required>
    <Input type="email" {...register('email')} />
  </FormField>
</Form>
```

### FileUpload
Drag-and-drop uploader with per-file progress.

**Import:** `import { FileUpload } from '@/app/components/@system/FileUpload'`

| Prop        | Type                                                        | Default          | Description                          |
| ----------- | ----------------------------------------------------------- | ---------------- | ------------------------------------ |
| `accept`    | `string`                                                    | —                | MIME/extension filter                |
| `maxSize`   | `number`                                                    | `10 * 1024 * 1024` | Max byte size                       |
| `multiple`  | `boolean`                                                   | `true`           | Allow multiple files                 |
| `onFiles`   | `(files: File[]) => void`                                   | —                | Selected files                       |
| `onRemove`  | `(file: File) => void`                                      | —                | Remove callback                      |
| `files`     | `Array<{ name, size, status, progress? }>`                  | —                | Controlled render list               |
| `disabled`  | `boolean`                                                   | `false`          | Disable input                        |

### MobileForm
Mobile-first form scaffold.

**Import:** `import { MobileForm } from '@/app/components/@system/MobileForm'`

Namespace: `MobileForm.Field`, `MobileForm.Group`, `MobileForm.Actions`, `MobileForm.Section`.
- `MobileForm`: `onSubmit`, `children`, `className`.
- `MobileForm.Field`: `label`, `description`, `error`, `required=false`.
- `MobileForm.Actions`: `align: 'start' | 'end' | 'between'` (default `'end'`).
- `MobileForm.Section`: `title`, `description`.

### Select
Re-export of shadcn `Select` — see [UI Primitives](#ui-primitives-shadcn).

**Import:**
```jsx
import { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator } from '@/app/components/@system/Select';
```

### Switch
Re-export of shadcn `Switch`.

### Textarea
`forwardRef` textarea supporting `error` and standard textarea props.

---

## Auth

### LoginForm
Email + password login.

**Import:** `import { LoginForm } from '@/app/components/@system/LoginForm'`

| Prop        | Type                                          | Description                              |
| ----------- | --------------------------------------------- | ---------------------------------------- |
| `onSuccess` | `(result: { totp_required?: boolean, ... }) => void` | Called on successful login (or 2FA gate) |

### RegisterForm
Email + password + confirm (with zod strong-password rules).

**Props:** `onSuccess(result)`.

### PasswordResetForm
Auto step-1 (request email) or step-2 (submit new password when `?token=` present).

**Props:** `onSuccess?()`.

### OAuthButtons
Renders provider buttons (currently Google).

| Prop         | Type      | Default | Description                        |
| ------------ | --------- | ------- | ---------------------------------- |
| `className`  | `string`  | `''`    | Extra classes                      |
| `showDivider`| `boolean` | `true`  | Show "or continue with" divider    |

### OAuthCallback
Mount at `/auth/callback`.

| Prop         | Type     | Default   | Description                       |
| ------------ | -------- | --------- | --------------------------------- |
| `redirectTo` | `string` | `'/app'`  | Post-auth redirect path           |

### TwoFactor
Multi-step TOTP setup (`TwoFactorSetup`).

**Import:** `import { TwoFactorSetup } from '@/app/components/@system/TwoFactor'`

| Prop             | Type                    | Description                     |
| ---------------- | ----------------------- | ------------------------------- |
| `enabled`        | `boolean`               | Current 2FA status              |
| `onStatusChange` | `(enabled: boolean) => void` | Fires when status changes   |

### PrivateRoute
Redirects unauthenticated users to `/auth`.

| Prop     | Type          | Description                   |
| -------- | ------------- | ----------------------------- |
| `children` | `ReactNode` | Protected UI                  |
| `role`   | `'admin'`     | Optional role gate            |

### ProtectedRoute
Superset of PrivateRoute — adds onboarding, plan gate, `RouteErrorBoundary`, `EmailVerificationBanner`.

**Props:** `children`, `role?: 'admin'`.

### MetaMaskConnect
Web3 wallet connect button.

**Import:** `import MetaMaskConnect from '@/app/components/@system/MetaMaskConnect'`

| Prop        | Type                       | Description             |
| ----------- | -------------------------- | ----------------------- |
| `onConnect` | `(address: string) => void`| Fires on connect        |
| `onError`   | `(err: Error) => void`     | Fires on failure        |

---

## Navigation

### Header
Auth-aware app header (user menu, theme toggle, mobile drawer).

**Import:** `import { Header } from '@/app/components/@system/Header'`

**Props:** `className`.

### Footer
No props. Site footer with link columns, social icons, and legal bar.

### Sidebar
Composable app sidebar.

**Import:**
```jsx
import { Sidebar, SidebarLogo, SidebarSection, SidebarItem } from '@/app/components/@system/Sidebar';
```

- `Sidebar`: `mobileOpen=false`, `onMobileClose`, `className`.
- `SidebarLogo`: `name`, `href='/app'`.
- `SidebarItem`: `icon`, `label`, `active`, `onClick`.

### LandingNavbar
Sticky landing-page nav with scroll shadow and CTAs.

**Props:** `className`.

### Breadcrumbs
```jsx
import { Breadcrumbs, BreadcrumbItem, BreadcrumbsFromPath } from '@/app/components/@system/Breadcrumbs';

<Breadcrumbs>
  <BreadcrumbItem href="/app">Home</BreadcrumbItem>
  <BreadcrumbItem>Settings</BreadcrumbItem>
</Breadcrumbs>

// or auto-generate from location.pathname:
<BreadcrumbsFromPath basePath="/app" labels={{ users: 'Users' }} />
```

`Breadcrumbs`: `separator` (default `<ChevronRight/>`), `className`.
`BreadcrumbItem`: `href?`, `icon?`.
`BreadcrumbsFromPath`: `basePath=''`, `labels={}`, `showHome=true`.

### Pagination
```jsx
import { Pagination, SimplePagination } from '@/app/components/@system/Pagination';
```

| Prop            | Type       | Default | Description                     |
| --------------- | ---------- | ------- | ------------------------------- |
| `currentPage`   | `number`   | —       | 1-indexed current page          |
| `totalPages`    | `number`   | —       | Total pages                     |
| `onPageChange`  | `(page: number) => void` | — | Page click handler          |
| `siblingCount`  | `number`   | `1`     | Adjacent sibling links          |
| `showFirstLast` | `boolean`  | `true`  | Show first/last jump buttons    |

### Tabs
Re-exports shadcn tabs with mobile horizontal-scroll `TabsList` wrapper.

```jsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/@system/Tabs';
```

### SkipToContent
Accessibility skip link. Renders a keyboard-visible anchor focusing `#main-content`. No props.

---

## Data Display

### Table
Base table primitives (`Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) — each accepts `className` and native element props.

### ResponsiveTable
Mobile-aware wrappers: `ResponsiveTableWrapper`, `ResponsiveTableCell`, `ResponsiveTableHead`.

### Card
```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/app/components/@system/Card';
```

All accept `className` + native props (div/heading/p).

### MetricCard
KPI / stat display.

```jsx
import { MetricCard, MetricGroup, CompactMetric } from '@/app/components/@system/MetricCard';
```

MetricCard props:

| Prop          | Type                                | Default             | Description                       |
| ------------- | ----------------------------------- | ------------------- | --------------------------------- |
| `title`       | `string`                            | —                   | Metric label                      |
| `value`       | `string \| number`                  | —                   | Metric value                      |
| `change`      | `string \| number`                  | —                   | Delta (e.g. `"+12%"`)             |
| `trend`       | `'up' \| 'down' \| 'neutral'`       | —                   | Colors change/arrow               |
| `period`      | `string`                            | `'vs last month'`   | Comparison label                  |
| `icon`        | `LucideIcon`                        | —                   | Header icon                       |
| `description` | `string`                            | —                   | Sub-caption                       |
| `loading`     | `boolean`                           | `false`             | Skeleton state                    |

MetricGroup: `columns: 1 | 2 | 3 | 4` (default `3`).
CompactMetric: `label`, `value`, `change`, `className`.

### Badge
```jsx
import { Badge } from '@/app/components/@system/Badge';
```

Variants: `'default' | 'secondary' | 'success' | 'outline' | 'destructive'`. Accepts span props.

### Avatar
```jsx
import { Avatar, AvatarGroup } from '@/app/components/@system/Avatar';
```

Avatar props:

| Prop     | Type                                                | Default | Description                    |
| -------- | --------------------------------------------------- | ------- | ------------------------------ |
| `src`    | `string`                                            | —       | Image URL                      |
| `alt`    | `string`                                            | —       | Alt text                       |
| `name`   | `string`                                            | —       | For initials fallback          |
| `size`   | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'`              | `'md'`  | Diameter                       |
| `status` | `'online' \| 'offline' \| 'away' \| 'busy'`         | —       | Status dot                     |
| `onClick`| `() => void`                                        | —       | Click handler                  |

AvatarGroup: `users=[]`, `max=3`, `size='md'`.

### ProgressBar
```jsx
import { ProgressBar, CircularProgress } from '@/app/components/@system/ProgressBar';
```

ProgressBar props: `value`, `max=100`, `label`, `showPercentage=false`, `size: 'sm'|'md'|'lg'` (`'md'`), `variant: 'default'|'success'|'warning'|'danger'`, `animated=false`.
CircularProgress props: `value`, `size='md'`, `showPercentage=true`, `variant='default'`.

### Skeleton
```jsx
import {
  Skeleton, SkeletonCard, SkeletonRow,
  HomePageSkeleton, ApiKeysPageSkeleton, AdminUsersTableSkeleton,
  ErrorTrackingPageSkeleton, SettingsPageSkeleton,
} from '@/app/components/@system/Skeleton';
```

`Skeleton`: `className`, `circle`.
`SkeletonRow`: `cols=4`.
Page skeletons are prebuilt for common routes.

### EmptyState
```jsx
<EmptyState
  icon={Inbox}
  title="No messages yet"
  description="Once you receive a message it will appear here."
  action={<Button>Compose</Button>}
/>
```

Props: `icon=FileQuestion`, `title`, `description`, `action`.

---

## Utility & Widgets

### Button
Re-export of shadcn button: `Button`, `buttonVariants`.

Variants: `default | destructive | outline | secondary | ghost | link`.
Sizes: `default | sm | lg | icon`.

### Dropdown
```jsx
import { Dropdown, DropdownItem, DropdownSeparator, DropdownLabel, DropdownSubmenu } from '@/app/components/@system/Dropdown';

<Dropdown trigger={<Button>Actions</Button>} align="right">
  <DropdownLabel>Manage</DropdownLabel>
  <DropdownItem icon={Edit} onClick={edit}>Edit</DropdownItem>
  <DropdownSeparator />
  <DropdownItem icon={Trash2} variant="danger" onClick={remove}>Delete</DropdownItem>
</Dropdown>
```

- `Dropdown`: `trigger`, `align: 'left' | 'right'` (`'left'`), `className`.
- `DropdownItem`: `icon`, `shortcut`, `checked`, `disabled`, `variant: 'default' | 'danger'`.
- `DropdownSubmenu`: `label`, `icon`, `children`.

### CommandPalette
Cmd/Ctrl+K palette.

```jsx
import { CommandPalette, useCommandPalette } from '@/app/components/@system/CommandPalette';
```

| Prop           | Type                                                                                | Default                    | Description               |
| -------------- | ----------------------------------------------------------------------------------- | -------------------------- | ------------------------- |
| `commands`     | `Array<{id, label, category, keywords[], icon, shortcut, description, action, href}>` | `[]`                       | Command list              |
| `onSelect`     | `(cmd) => void`                                                                     | —                          | Selection callback        |
| `placeholder`  | `string`                                                                            | `'Search commands...'`     | Input placeholder         |
| `open` / `onOpenChange` | controlled state                                                            | —                          | Controlled mode           |

`useCommandPalette()` returns `{ open, setOpen, toggle }` and binds ⌘K / Ctrl+K.

### ErrorBoundary
Class boundary with reset UI + optional Sentry reporting.

```jsx
import { ErrorBoundary, withErrorBoundary } from '@/app/components/@system/ErrorBoundary';

<ErrorBoundary fallback={({ error, resetError }) => <MyFallback />}>
  <App />
</ErrorBoundary>
```

### PageLayout
`min-h-screen bg-background` wrapper. Props: `className`, `children`.

### OgMeta
Sets `<title>` + OG/Twitter meta tags via effect.

| Prop           | Type      | Default                   | Description         |
| -------------- | --------- | ------------------------- | ------------------- |
| `title`        | `string`  | —                         | Page title          |
| `description`  | `string`  | —                         | Meta description    |
| `image`        | `string`  | —                         | OG image URL        |
| `url`          | `string`  | —                         | Canonical URL       |
| `type`         | `string`  | `'website'`               | og:type             |
| `twitterCard`  | `string`  | `'summary_large_image'`   | twitter:card        |

### Spinner / Loading
Two spinners are exported. Both accept `size` (default `20`) and `className`.

```jsx
import { Spinner } from '@/app/components/@system/Spinner';
// or
import { Spinner } from '@/app/components/@system/Loading';
```

### FeedbackWidget
Floating feedback button (3-step form). Defaults to POST `/feedback`.

| Prop        | Type                                                                     | Default          |
| ----------- | ------------------------------------------------------------------------ | ---------------- |
| `position`  | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'`           | `'bottom-left'`  |
| `onSubmit`  | `(payload) => Promise<void>`                                             | —                |

### HelpWidget
Floating help button with searchable article list.

| Prop       | Type     | Default          | Description                   |
| ---------- | -------- | ---------------- | ----------------------------- |
| `position` | `string` | `'bottom-right'` | Corner position               |
| `context`  | `string` | —                | Article context filter        |

### NotificationCenter
Bell + unread dropdown.

| Prop                  | Type                                                            | Default | Description               |
| --------------------- | --------------------------------------------------------------- | ------- | ------------------------- |
| `notifications`       | `Array<{id, variant, icon?, title, description?, timestamp, read}>` | `[]`    | Notifications to render   |
| `onMarkRead`          | `(id) => void`                                                  | —       | Per-item mark read        |
| `onMarkAllRead`       | `() => void`                                                    | —       | Bulk mark read            |
| `onNotificationClick` | `(n) => void`                                                   | —       | Notification click        |
| `onDismiss`           | `(id) => void`                                                  | —       | Dismiss item              |

### EmailVerificationBanner
Global banner prompting email verification (reads user from auth context; POSTs `/users/email/verify/request`). No props.

### CookieConsentBanner
GDPR cookie consent (persists to localStorage + POSTs `/gdpr/consent`).

```jsx
import { CookieConsentBanner, useCookieConsent } from '@/app/components/@system/CookieConsentBanner';

const { consent } = useCookieConsent();  // 'all' | 'essential' | null
```

### FeatureSpotlight
Modal to highlight new features + hook to track "seen" per feature.

```jsx
import { FeatureSpotlight, useFeatureSpotlight } from '@/app/components/@system/FeatureSpotlight';
```

Props: `isOpen`, `onClose`, `feature: { title, description, image?, content?, cta?, badge? }`.

### UpgradeGate
Full-screen upgrade prompt for locked plans. No props.

### TestimonialsSection
Landing testimonials grid (static content). No props.

---

## Dashboard

**Import:** `import { ... } from '@/app/components/@system/Dashboard'`

Exports: `DashboardLayout`, `StatCard`, `StatCardGrid`, `RecentActivityList`, `QuickActions`, `DataTable`, `WelcomeCard`, `FiltersBar`, `BulkActions`, `commonBulkActions`, `MobileTable`.

```jsx
<DashboardLayout>
  <DashboardLayout.Content>
    <DashboardLayout.Header title="Dashboard" description="Welcome back" />
    <StatCardGrid>
      <StatCard label="Users" value="1,234" trend="up" change="+12%" />
      <StatCard label="Revenue" value="$4.5k" />
    </StatCardGrid>
    <FiltersBar filters={filters} onChange={setFilters} />
    <BulkActions selection={selection} actions={commonBulkActions} />
    <DataTable columns={cols} data={rows} onRowClick={open} />
    <MobileTable columns={cols} data={rows} />
    <RecentActivityList items={activity} />
    <QuickActions actions={quickActions} />
    <WelcomeCard title="Getting started" onDismiss={dismiss} />
  </DashboardLayout.Content>
</DashboardLayout>
```

- **DashboardLayout** — Page shell (`.Content`, `.Header`, `.Sidebar` subcomponents).
- **StatCard / StatCardGrid** — Metric tiles.
- **DataTable** — Sortable/filterable table with row selection.
- **MobileTable** — Vertical-card layout for narrow viewports.
- **FiltersBar** — Filter controls with badge indicators.
- **BulkActions** — Toolbar for multi-row operations (import `commonBulkActions` for defaults).
- **RecentActivityList** — Timeline of recent events.
- **QuickActions** — Grid of shortcut cards.
- **WelcomeCard** — Dismissible onboarding banner.

---

## Onboarding

**Import:** `import { OnboardingWizard, GuidedTour, ProgressChecklist } from '@/app/components/@system/Onboarding'`

- **OnboardingWizard** — Multi-step signup/setup wizard. Props include `steps`, `onComplete`, `onSkip`.
- **GuidedTour** — Interactive tooltip tour (`steps`, `onComplete`).
- **ProgressChecklist** — Task checklist with completion state (`items`, `onItemClick`).

```jsx
<OnboardingWizard onComplete={completeSetup} />
<GuidedTour steps={tourSteps} onComplete={finishTour} />
<ProgressChecklist items={tasks} />
```

---

## User Settings

**Import:** `import { ... } from '@/app/components/@system/UserSettings'`

Exports: `UserSettings`, `SettingsSection`, `SettingsRow`, `ProfileSettings`, `SecuritySettings`, `NotificationSettings`, `PreferencesSettings`, `ConnectedAccounts`, `DataExport`, `KeyboardShortcuts`, `PrivacySettings`.

UserSettings props:

| Prop           | Type                    | Default      | Description                        |
| -------------- | ----------------------- | ------------ | ---------------------------------- |
| `defaultTab`   | `string`                | `'profile'`  | Active tab id on mount             |
| `user`         | `object`                | —            | Current user                       |
| `onUpdate`     | `(patch) => void`       | —            | Save handler                       |
| `onTabChange`  | `(tabId) => void`       | —            | Fires when tab changes             |

`SettingsSection`: `title`, `description`, `className`.
`SettingsRow`: `label`, `description`, `className`.

Preconfigured panels — each self-contained, all safe to compose in any order:
- **ProfileSettings** — name, email, avatar.
- **SecuritySettings** — password, 2FA, sessions.
- **NotificationSettings** — email + in-app preferences.
- **PreferencesSettings** — theme, language, timezone.
- **ConnectedAccounts** — linked OAuth providers.
- **DataExport** — GDPR data export request.
- **KeyboardShortcuts** — customizable shortcut list.
- **PrivacySettings** — visibility and data-sharing controls.

```jsx
<UserSettings defaultTab="security">
  <UserSettings.Tab id="profile" label="Profile"><ProfileSettings /></UserSettings.Tab>
  <UserSettings.Tab id="security" label="Security"><SecuritySettings /></UserSettings.Tab>
</UserSettings>
```

---

## Teams

**Import:** `import { ... } from '@/app/components/@system/Teams'`

Exports: `TeamList`, `MemberList`, `InvitationManager`, `PendingInvitations`, `InvitationBadge`, `CreateTeamModal`.

- **TeamList** — Renders user's teams with switch/create actions.
- **MemberList** — Team members table with role + remove.
- **InvitationManager** — Send + revoke pending invites.
- **PendingInvitations** — Inbox of invitations the user has received.
- **InvitationBadge** — Small unread-invitations indicator (for header).
- **CreateTeamModal** — Modal form to create a new team.

Backed by `/api/teams/*` routes (see `server/src/api/@system/teams/`).

---

## UI Primitives (shadcn)

Base primitives live in `client/src/app/components/@system/ui/`. Import directly:

```jsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Toast, Toaster, useToast } from '@/components/ui/toast';
```

Available primitive directories:

| Primitive       | Purpose                                     |
| --------------- | ------------------------------------------- |
| `accordion`     | Collapsible sections                        |
| `alert-dialog`  | Confirmation dialogs                        |
| `avatar`        | Base avatar (image/initials)                |
| `badge`         | Semantic pills                              |
| `button`        | Buttons (`variant`, `size`, `asChild`)      |
| `card`          | Card / CardHeader / CardContent / CardFooter |
| `checkbox`      | Checkbox input                              |
| `collapsible`   | Collapsible container                       |
| `dialog`        | Modal dialog                                |
| `dropdown-menu` | Contextual menu                             |
| `input`         | Text input                                  |
| `label`         | `<label>` primitive                         |
| `popover`       | Anchored floating panel                     |
| `scroll-area`   | Custom scrollbar area                       |
| `select`        | Native-like select                          |
| `separator`     | Horizontal / vertical divider               |
| `sheet`         | Slide-in drawer                             |
| `skeleton`      | Loading placeholder block                   |
| `switch`        | Toggle switch                               |
| `tabs`          | Tabbed interface                            |
| `textarea`      | Multi-line text input                       |
| `toast`         | Toast + provider + `useToast` hook          |
| `tooltip`       | Hover/focus tooltip                         |

All primitives follow shadcn conventions: `className`, `forwardRef`, and `asChild` (via Radix Slot where applicable).

---

## Conventions & Common Rules

- **Path aliases:** `@/` maps to `client/src/` (see `webpack.config.mjs`). Both `@/components/@system/…` and `@/app/components/@system/…` resolve depending on the alias — prefer whichever the surrounding file uses.
- **Icons:** All components use `lucide-react`. When passing an `icon` prop, pass the component reference (`icon={Search}`), not JSX.
- **Theming:** All components consume CSS variables (`bg-primary`, `text-muted-foreground`, `border-border`, …) defined in `design-tokens.json` / `brand.css`. Never hardcode hex.
- **Dark mode:** Automatic — no per-component setup required.
- **Extending:** To customize behavior, wrap the component in `client/src/app/components/@custom/` — never edit `@system/`.
- **Types:** All components accept `className` (merged via `cn`) and forward common HTML attrs unless noted.

## Extending in @custom

```jsx
// client/src/app/components/@custom/BrandedButton/index.jsx
import { Button } from '@/app/components/@system/Button';
import { cn } from '@/lib/@system/utils';

export function BrandedButton({ className, ...props }) {
  return <Button className={cn('shadow-glow', className)} {...props} />;
}
```

---

**Last updated:** 2026-08-06 · **Source of truth:** `client/src/app/components/@system/`
