// @system — Mobile responsiveness showcase and testing page
// Demonstrates all mobile-first patterns, utilities, and components
// Access at: /app/mobile-demo

import { useState } from 'react'
import { Smartphone, Tablet, Monitor, CheckCircle2, Info, Code } from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard/DashboardLayout'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { Badge } from '../../../../components/@system/Badge'
import { FormField, Input } from '../../../../components/@system/Form'
import { Modal } from '../../../../components/@system/Modal'
import { Alert } from '../../../../components/@system/Alert'

export function MobileResponsiveDemo() {
  const [modalOpen, setModalOpen] = useState(false)
  const [currentBreakpoint, setCurrentBreakpoint] = useState('unknown')

  // Detect current breakpoint for demo purposes
  useState(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      if (width < 480) setCurrentBreakpoint('xs (< 480px)')
      else if (width < 640) setCurrentBreakpoint('xs-sm (480-640px)')
      else if (width < 768) setCurrentBreakpoint('sm (640-768px)')
      else if (width < 1024) setCurrentBreakpoint('md (768-1024px)')
      else if (width < 1280) setCurrentBreakpoint('lg (1024-1280px)')
      else if (width < 1536) setCurrentBreakpoint('xl (1280-1536px)')
      else setCurrentBreakpoint('2xl (≥ 1536px)')
    }

    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <DashboardLayout.Header
          title="Mobile Responsiveness"
          description="Interactive showcase of mobile-first design patterns"
          actions={
            <Badge variant="outline" className="gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              {currentBreakpoint}
            </Badge>
          }
        />

        {/* Alert */}
        <Alert className="mb-6" variant="info">
          <Info className="h-4 w-4" />
          <div>
            <p className="font-medium">Resize your browser to test responsiveness</p>
            <p className="text-sm mt-1 text-brand-text-muted">
              Or open DevTools (F12) and use device emulation to test on different screen sizes.
            </p>
          </div>
        </Alert>

        {/* Breakpoint Indicators */}
        <DashboardLayout.Section title="Breakpoint System">
          <Card>
            <CardContent className="pt-6">
              <div className="mobile-grid-stack">
                <BreakpointCard
                  icon={Smartphone}
                  name="Mobile"
                  range="< 640px"
                  classes="xs:, sm:"
                  active={currentBreakpoint.includes('xs') || currentBreakpoint.includes('sm')}
                />
                <BreakpointCard
                  icon={Tablet}
                  name="Tablet"
                  range="640-1024px"
                  classes="md:, lg:"
                  active={currentBreakpoint.includes('md') || currentBreakpoint.includes('lg')}
                />
                <BreakpointCard
                  icon={Monitor}
                  name="Desktop"
                  range="≥ 1024px"
                  classes="xl:, 2xl:"
                  active={currentBreakpoint.includes('xl')}
                />
              </div>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

        {/* Touch Targets */}
        <DashboardLayout.Section
          title="Touch Targets"
          description="All interactive elements meet WCAG 2.1 minimum 44×44px"
        >
          <Card>
            <CardContent className="pt-6 mobile-spacing">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-brand-text-muted mb-3">Button sizes (all touch-optimized):</p>
                  <div className="flex flex-wrap gap-3">
                    <Button size="sm">Small (40px)</Button>
                    <Button size="default">Default (44px)</Button>
                    <Button size="lg">Large (48-56px)</Button>
                    <Button size="icon" variant="outline">
                      <CheckCircle2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-brand-text-muted mb-3">Custom touch targets:</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="touch-target rounded-full border-2 border-primary px-4">
                      .touch-target
                    </button>
                    <button className="touch-target rounded-md bg-brand-surface px-6">
                      44×44px minimum
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

        {/* Layout Patterns */}
        <DashboardLayout.Section
          title="Layout Patterns"
          description="Common responsive layout utilities"
        >
          <div className="space-y-4">
            {/* Mobile Stack */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mobile Stack</CardTitle>
                <CardDescription>Columns on mobile, row on desktop</CardDescription>
                <CodeSnippet code='<div className="mobile-stack">...</div>' />
              </CardHeader>
              <CardContent>
                <div className="mobile-stack">
                  <div className="flex-1 p-4 bg-brand-primary/10 rounded-md text-center">Column 1</div>
                  <div className="flex-1 p-4 bg-brand-primary/10 rounded-md text-center">Column 2</div>
                  <div className="flex-1 p-4 bg-brand-primary/10 rounded-md text-center">Column 3</div>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Grid Stack */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mobile Grid Stack</CardTitle>
                <CardDescription>1 col → 2 cols → 3 cols responsive grid</CardDescription>
                <CodeSnippet code='<div className="mobile-grid-stack">...</div>' />
              </CardHeader>
              <CardContent>
                <div className="mobile-grid-stack">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-4 bg-brand-surface rounded-md text-center">
                      Item {i}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Mobile Scroll X */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Horizontal Scroll</CardTitle>
                <CardDescription>Scrolls on mobile, wraps on desktop</CardDescription>
                <CodeSnippet code='<div className="mobile-scroll-x">...</div>' />
              </CardHeader>
              <CardContent>
                <div className="mobile-scroll-x">
                  <div className="flex gap-3 min-w-max sm:min-w-0 sm:flex-wrap">
                    {['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'].map((f) => (
                      <Badge key={f} className="px-4 py-2 whitespace-nowrap">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout.Section>

        {/* Typography */}
        <DashboardLayout.Section
          title="Mobile Typography"
          description="Responsive text with relaxed line-height"
        >
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <CodeSnippet code='<p className="text-mobile-sm">...' />
                <p className="text-mobile-sm mt-2">
                  Small text with relaxed line-height for better mobile readability.
                </p>
              </div>
              <div>
                <CodeSnippet code='<p className="text-mobile-base">...' />
                <p className="text-mobile-base mt-2">
                  Base text with relaxed line-height for comfortable reading on mobile.
                </p>
              </div>
              <div>
                <CodeSnippet code='<p className="text-mobile-lg">...' />
                <p className="text-mobile-lg mt-2">
                  Large text that scales from lg to xl across breakpoints.
                </p>
              </div>
              <div>
                <CodeSnippet code='<p className="text-mobile-xl">...' />
                <p className="text-mobile-xl mt-2">
                  Extra-large text that scales from xl to 2xl.
                </p>
              </div>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

        {/* Visibility */}
        <DashboardLayout.Section
          title="Visibility Utilities"
          description="Show/hide elements based on breakpoint"
        >
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Alert variant="default" className="mobile-only">
                <Smartphone className="h-4 w-4" />
                <div>
                  <p className="font-medium">Mobile Only (.mobile-only)</p>
                  <p className="text-sm">This alert is only visible on mobile devices</p>
                </div>
              </Alert>

              <Alert variant="default" className="mobile-hide">
                <Monitor className="h-4 w-4" />
                <div>
                  <p className="font-medium">Desktop Only (.mobile-hide)</p>
                  <p className="text-sm">This alert is only visible on desktop devices</p>
                </div>
              </Alert>

              <div className="space-y-2">
                <CodeSnippet code='<div className="mobile-only">Mobile only</div>' />
                <CodeSnippet code='<div className="mobile-hide">Desktop only</div>' />
              </div>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

        {/* Forms */}
        <DashboardLayout.Section
          title="Mobile Forms"
          description="Touch-friendly form inputs and layouts"
        >
          <Card>
            <CardContent className="pt-6">
              <form className="mobile-form-layout" onSubmit={(e) => e.preventDefault()}>
                <div className="mobile-form-row">
                  <FormField label="First Name" required className="flex-1">
                    <Input placeholder="John" />
                  </FormField>
                  <FormField label="Last Name" required className="flex-1">
                    <Input placeholder="Doe" />
                  </FormField>
                </div>

                <FormField label="Email" required>
                  <Input type="email" placeholder="john@example.com" />
                </FormField>

                <FormField label="Phone">
                  <Input type="tel" placeholder="+1 (555) 123-4567" />
                </FormField>

                <div className="mobile-stack pt-2">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto">
                    Submit Form
                  </Button>
                </div>
              </form>

              <div className="mt-6 space-y-2">
                <CodeSnippet code='<form className="mobile-form-layout">...' />
                <CodeSnippet code='<div className="mobile-form-row">...' />
              </div>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

        {/* Modal */}
        <DashboardLayout.Section
          title="Mobile Modal"
          description="Full-screen on mobile, centered modal on desktop"
        >
          <Card>
            <CardContent className="pt-6">
              <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
              <p className="text-sm text-brand-text-muted mt-3">
                Modal adapts automatically: full-screen on mobile with slide-up animation,
                centered overlay on desktop.
              </p>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

        {/* Safe Areas */}
        <DashboardLayout.Section
          title="Safe Area Support"
          description="Respect iPhone notch and rounded corners"
        >
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm">Safe area utilities automatically adjust for device notches:</p>
                <CodeSnippet code='<header className="safe-padding-top">...' />
                <CodeSnippet code='<footer className="safe-padding-bottom">...' />
                <CodeSnippet code='<div className="safe-padding-x">...' />
                <CodeSnippet code='<div className="safe-padding-all">...' />
              </div>

              <Alert variant="default">
                <Info className="h-4 w-4" />
                <div>
                  <p className="font-medium">Testing Safe Areas</p>
                  <p className="text-sm">
                    View this page on an iPhone X+ or use Chrome DevTools device emulation
                    with "Show device frame" enabled to see safe area padding in action.
                  </p>
                </div>
              </Alert>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

        {/* Testing Checklist */}
        <DashboardLayout.Section
          title="Mobile Testing Checklist"
          description="Ensure your mobile experience is production-ready"
        >
          <Card>
            <CardContent className="pt-6">
              <ul className="space-y-2.5">
                <ChecklistItem text="Touch targets are at least 44×44px" />
                <ChecklistItem text="Safe areas respected on notched devices" />
                <ChecklistItem text="No horizontal scroll on mobile viewports" />
                <ChecklistItem text="Text is readable without zooming (16px+ base)" />
                <ChecklistItem text="Forms work with mobile keyboards" />
                <ChecklistItem text="Navigation accessible with one thumb" />
                <ChecklistItem text="Loading states are visible and clear" />
                <ChecklistItem text="Error messages are visible and actionable" />
                <ChecklistItem text="Images load efficiently (lazy loading)" />
                <ChecklistItem text="Animations are performant (60fps)" />
              </ul>
            </CardContent>
          </Card>
        </DashboardLayout.Section>

      </DashboardLayout.Content>

      {/* Demo Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Responsive Modal"
        description="This modal is full-screen on mobile, centered on desktop"
      >
        <div className="space-y-4">
          <p className="text-sm">
            On mobile devices, this modal takes up the full screen with a slide-up animation.
            On desktop, it appears as a centered overlay with a backdrop.
          </p>

          <div className="mobile-form-layout">
            <FormField label="Example Input">
              <Input placeholder="Type something..." />
            </FormField>

            <div className="mobile-stack">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)} className="w-full sm:w-auto">
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}

// Helper Components

function BreakpointCard({ icon: Icon, name, range, classes, active }) {
  return (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${
        active ? 'border-primary bg-brand-primary/5' : 'border-brand-border'
      }`}
    >
      <Icon className={`h-6 w-6 mb-2 ${active ? 'text-brand-primary' : 'text-brand-text-muted'}`} />
      <h3 className="font-semibold">{name}</h3>
      <p className="text-sm text-brand-text-muted mt-1">{range}</p>
      <code className="text-xs bg-brand-surface px-2 py-0.5 rounded mt-2 inline-block">{classes}</code>
      {active && (
        <Badge className="mt-2" variant="default">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Active
        </Badge>
      )}
    </div>
  )
}

function CodeSnippet({ code }) {
  return (
    <div className="flex items-center gap-2 text-xs bg-brand-surface px-3 py-1.5 rounded-md font-mono">
      <Code className="h-3.5 w-3.5 text-brand-text-muted shrink-0" />
      <code className="text-brand-text">{code}</code>
    </div>
  )
}

function ChecklistItem({ text }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <CheckCircle2 className="h-4 w-4 text-brand-primary mt-0.5 shrink-0" />
      <span>{text}</span>
    </li>
  )
}
