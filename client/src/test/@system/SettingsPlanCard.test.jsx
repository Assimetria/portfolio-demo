// @system — Tests for the Settings "billing & plan" entry point.
// SettingsPlanCard is rendered at the top of /app/settings. For a free-plan user
// its primary action must open the shared in-app UpgradeModal (so they can change
// plan without leaving the app), while paid users get a "manage billing" path.
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SettingsPlanCard } from '@/app/components/@system/SettingsPlanCard'
import { UpgradeProvider } from '@/app/store/@system/upgradeModal'
import { getPlans } from '@/app/api/@system/stripe'

// Mock the auth store so we control the current user's plan.
jest.mock('@/app/store/@system/auth', () => ({
  useAuthContext: jest.fn(),
}))
const { useAuthContext } = require('@/app/store/@system/auth')

jest.mock('@/app/api/@system/stripe', () => {
  const actual = jest.requireActual('@/app/api/@system/stripe')
  return {
    ...actual,
    getPlans: jest.fn(),
  }
})

const freeUser = { id: 1, name: 'Alice', email: 'alice@example.com', subscription: null, plan: 'free' }
const paidUser = { id: 2, name: 'Bob', email: 'bob@example.com', subscription: { plan: 'pro' }, plan: 'pro' }

const proPlan = {
  id: 'plan_pro',
  name: 'Pro',
  priceId: 'price_pro',
  amount: 2000,
  currency: 'usd',
  interval: 'month',
  features: ['Priority support', 'Unlimited projects'],
}

function renderCard(user = freeUser) {
  useAuthContext.mockReturnValue({ user })
  getPlans.mockResolvedValue({ plans: [proPlan] })
  return render(
    <MemoryRouter>
      <UpgradeProvider>
        <SettingsPlanCard />
      </UpgradeProvider>
    </MemoryRouter>
  )
}

describe('SettingsPlanCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows an upgrade callout for a free-plan user', () => {
    renderCard(freeUser)

    expect(screen.getByRole('heading', { name: /You are on the free plan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upgrade plan/i })).toBeInTheDocument()
  })

  it('opens the in-app UpgradeModal from Settings for a free-plan user', async () => {
    renderCard(freeUser)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Upgrade plan/i }))

    // The shared modal surfaces in the document body through the Portal. Scope
    // assertions to modal-only copy so the banner's own "free plan" heading does
    // not produce ambiguous matches.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Upgrade plan/i })).toBeInTheDocument()
    })
    expect(
      screen.getByText(/Settings · You are on the free plan\. Pick a plan below/i)
    ).toBeInTheDocument()
  })

  it('always lets the user reach the full billing page to manage their account', () => {
    renderCard(freeUser)

    const manage = screen.getByRole('link', { name: /Manage billing/i })
    expect(manage).toHaveAttribute('href', '/app/billing')
  })

  it('renders a manage-billing card for paid users instead of an upgrade prompt', () => {
    renderCard(paidUser)

    expect(screen.getByRole('heading', { name: /Pro plan/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Upgrade plan/i })).not.toBeInTheDocument()

    const manage = screen.getByRole('link', { name: /Manage billing/i })
    expect(manage).toHaveAttribute('href', '/app/billing')
  })
})
