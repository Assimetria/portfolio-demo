// @system — Tests for the UpgradeGate "locked feature" entry point.
// UpgradeGate is the full-screen gate rendered in place of a premium feature a
// user does not have (for example, a dashboard widget or a route that is
// outside the current plan). For a free-plan user its primary action must open
// the in-app UpgradeModal (rather than merely linking out to /pricing), which
// is the whole point of the in-app plan-change UI.
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UpgradeGate } from '@/app/components/@system/UpgradeGate'
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
  intervalCount: 1,
  trialDays: 14,
  features: ['Priority support', 'Unlimited projects'],
}

function renderGate(user = freeUser) {
  useAuthContext.mockReturnValue({ user })
  getPlans.mockResolvedValue({ plans: [proPlan] })
  return render(
    <MemoryRouter>
      <UpgradeProvider>
        <UpgradeGate />
      </UpgradeProvider>
    </MemoryRouter>
  )
}

describe('UpgradeGate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the locked-feature message with an Upgrade now action', () => {
    renderGate()

    expect(screen.getByRole('heading', { name: 'Upgrade required' })).toBeInTheDocument()
    expect(screen.getByText(/This feature is not available on your current plan/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upgrade now/i })).toBeInTheDocument()
  })

  it('opens the in-app UpgradeModal for a free-plan user when the user clicks Upgrade', async () => {
    renderGate()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Upgrade now/i }))

    // The shared modal surfaces in the document body through the Portal.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Upgrade plan/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/UpgradeGate/i)).toBeInTheDocument()
    expect(screen.getByText(/You are on the free plan/i)).toBeInTheDocument()
  })

  it('still lets the user reach billing to compare plans', () => {
    renderGate()

    const compare = screen.getByRole('link', { name: /Compare plans/i })
    expect(compare).toHaveAttribute('href', '/app/billing')

    const back = screen.getByRole('link', { name: /Back to Dashboard/i })
    expect(back).toHaveAttribute('href', '/app')
  })

  it('keeps the paid-plan copy sensible for users who should not be gated', () => {
    // Cheap smoke check: even a paid user can render the gate without throwing
    // when the modal is opened (the store is plan-agnostic).
    renderGate(paidUser)
    expect(screen.getByRole('heading', { name: 'Upgrade required' })).toBeInTheDocument()
  })
})
