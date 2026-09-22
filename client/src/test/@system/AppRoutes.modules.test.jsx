// @system — AppRoutes ↔ feature modules.
//
// With billing / teams / selfRegistration switched off (the informational
// template's brand.json), the SaaS routes must not be registered at all —
// /pricing and /app/billing fall through to NotFound — and /register lands on
// the plain login tab. The module resolver is mocked (webpack normally feeds
// it __MODULES__ from brand.json); heavy lazy pages are stubbed.

import { render, screen } from '../test-utils'
import { MemoryRouter, useLocation } from 'react-router-dom'

const OFF = ['billing', 'teams', 'selfRegistration']

jest.mock('@/config/@system/modules', () => {
  const actual = jest.requireActual('@/config/@system/modules')
  const map = Object.fromEntries(actual.MODULE_KEYS.map((k) => [k, !['billing', 'teams', 'selfRegistration'].includes(k)]))
  const isModuleEnabled = (key) => map[key] !== false
  return {
    ...actual,
    modules: map,
    isModuleEnabled,
    filterByModules: (entries) => entries.filter((e) => !e?.module || isModuleEnabled(e.module)),
  }
})

jest.mock('@/config', () => ({
  info: { name: 'Acme', plans: [] },
  text: {},
  site: {},
  isModuleEnabled: (key) => !['billing', 'teams', 'selfRegistration'].includes(key),
  filterByModules: (entries) => entries.filter((e) => !e?.module || !['billing', 'teams', 'selfRegistration'].includes(e.module)),
}))

jest.mock('@/app/store/@system/auth', () => ({
  useAuthContext: () => ({ isAuthenticated: false, loading: false, user: null }),
}))

// Stub the pages this test can land on so the lazy chunks stay tiny.
jest.mock('@/app/pages/static/@system/NotFoundPage', () => ({ NotFoundPage: () => <div>not-found-page</div> }))
jest.mock('@/app/pages/static/@system/PricingPage', () => ({ PricingPage: () => <div>pricing-page</div> }))
jest.mock('@/app/pages/static/@system/AuthPage', () => ({ AuthPage: () => <div>auth-page</div> }))
jest.mock('@/app/pages/static/@custom/SitePage', () => ({ SitePage: () => <div>site-page</div> }))
jest.mock('@/app/pages/static/@system/HelpCenterPage', () => ({ HelpCenterPage: () => <div>help-page</div> }))
jest.mock('@/app/components/@system/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }) => <div data-testid="protected">{children}</div>,
}))

import { AppRoutes } from '@/app/routes/@system/AppRoutes'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>
  )
}

describe(`AppRoutes with ${OFF.join(', ')} off`, () => {
  it('does not register /pricing (billing) — falls through to NotFound', async () => {
    renderAt('/pricing')
    expect(await screen.findByText('not-found-page')).toBeInTheDocument()
    expect(screen.queryByText('pricing-page')).not.toBeInTheDocument()
  })

  it('does not register /app/billing or /app/teams', async () => {
    renderAt('/app/billing')
    expect(await screen.findByText('not-found-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
  })

  it('redirects /register to the plain login page (no ?tab=register) when selfRegistration is off', async () => {
    renderAt('/register')
    expect(await screen.findByText('auth-page')).toBeInTheDocument()
    expect(screen.getByTestId('loc')).toHaveTextContent('/auth')
    expect(screen.getByTestId('loc')).not.toHaveTextContent('tab=register')
  })

  it('keeps always-on public routes', async () => {
    renderAt('/help')
    expect(await screen.findByText('help-page')).toBeInTheDocument()
  })
})
