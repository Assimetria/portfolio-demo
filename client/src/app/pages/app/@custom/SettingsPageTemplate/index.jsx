// @custom — Settings page layout TEMPLATE
//
// Copy this file to create a product-specific settings page. It demonstrates
// the standard two-column settings layout used across Assimetria products:
//   ┌────────────────┬────────────────────────────────────────┐
//   │ Section nav    │ Section content (form, cards, etc.)    │
//   │ (sticky)       │                                        │
//   └────────────────┴────────────────────────────────────────┘
//
// Sections are driven by the ?section= query param so links, browser back /
// forward and refresh all preserve state without extra client state.
//
// To use:
//   1. Copy this folder to client/src/app/pages/app/@custom/<YourPage>/
//   2. Replace SECTIONS with your product's sections
//   3. Implement each section component (or inline the JSX)
//   4. Wire the route in client/src/app/routes/@custom/index.jsx
//
// Uses shadcn/ui primitives, lucide-react icons, Tailwind tokens (no hex).
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Plug,
  Palette,
} from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/ui/card'
import { Button } from '../../../../components/@system/ui/button'
import { Separator } from '../../../../components/@system/ui/separator'
import { cn } from '../../../../lib/@system/utils'

// ─── Section definitions ────────────────────────────────────────────────────
// Replace these with the sections your product actually needs. Each `render`
// returns the JSX shown on the right side when the section is active.

const SECTIONS = [
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    description: 'Public profile and account details.',
    render: () => <PlaceholderSection title="Profile" hint="Name, email, avatar, timezone." />,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Email and in-app notification preferences.',
    render: () => <PlaceholderSection title="Notifications" hint="Toggle email/push categories here." />,
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    description: 'Password, 2FA, active sessions.',
    render: () => <PlaceholderSection title="Security" hint="Change password, manage 2FA, revoke sessions." />,
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    description: 'Plan, invoices and payment method.',
    render: () => <PlaceholderSection title="Billing" hint="Plan, payment method, invoices." />,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    description: 'Connected apps and API keys.',
    render: () => <PlaceholderSection title="Integrations" hint="OAuth apps, API keys, webhooks." />,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Theme and display preferences.',
    render: () => <PlaceholderSection title="Appearance" hint="Theme, density, language." />,
  },
]

export function SettingsPageTemplate() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeId = searchParams.get('section') ?? SECTIONS[0].id
  const active = useMemo(
    () => SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0],
    [activeId]
  )

  function handleSelect(id) {
    setSearchParams({ section: id }, { replace: true })
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Manage your account, workspace and preferences.
            </p>
          </header>

          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <SectionNav
              sections={SECTIONS}
              activeId={active.id}
              onSelect={handleSelect}
            />

            <section aria-labelledby="settings-section-title">
              <Card>
                <CardHeader>
                  <CardTitle id="settings-section-title">{active.label}</CardTitle>
                  <CardDescription>{active.description}</CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">{active.render()}</CardContent>
              </Card>
            </section>
          </div>
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

// ─── Sidebar navigation ─────────────────────────────────────────────────────

function SectionNav({ sections, activeId, onSelect }) {
  return (
    <nav
      aria-label="Settings sections"
      className="lg:sticky lg:top-6 lg:self-start"
    >
      <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = section.id === activeId
          return (
            <li key={section.id}>
              <Button
                variant="ghost"
                onClick={() => onSelect(section.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full justify-start gap-2 whitespace-nowrap',
                  isActive
                    ? 'bg-brand-surface-hover text-brand-text'
                    : 'text-brand-text-muted hover:text-brand-text'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{section.label}</span>
              </Button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ─── Placeholder — replace with real section content ────────────────────────

function PlaceholderSection({ title, hint }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title} settings go here.</p>
      <p className="text-sm text-brand-text-muted">{hint}</p>
    </div>
  )
}

export default SettingsPageTemplate
