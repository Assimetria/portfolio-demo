// @system — Tests for UpgradeModal and the UpgradeProvider/useUpgradeModal pair
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { UpgradeModal } from '@/app/components/@system/UpgradeModal'
import { isFreeUser } from '@/app/lib/@system/plans'
import { UpgradeProvider, useUpgradeModal } from '@/app/store/@system/upgradeModal'
import { getPlans, createCheckoutSession } from '@/app/api/@system/stripe'

// Mock the auth store so we control the current user's plan.
jest.mock('@/app/store/@system/auth', () => ({
  useAuthContext: jest.fn(),
}))
const { useAuthContext } = require('@/app/store/@system/auth')

// Keep the real amount/interval formatters, but stub the two network helpers.
jest.mock('@/app/api/@system/stripe', () => {
  const actual = jest.requireActual('@/app/api/@system/stripe')
  return {
    ...actual,
    getPlans: jest.fn(),
    createCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay_cs_test_123' }),
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
  features: ['Unlimited projects', 'Priority support'],
  metadata: { popular: 'true' },
}

const teamPlan = {
  id: 'plan_team',
  name: 'Team',
  priceId: 'price_team',
  amount: 5000,
  currency: 'usd',
  interval: 'month',
  intervalCount: 1,
  features: ['Everything in Pro', 'Unlimited seats'],
}

describe('isFreeUser', () => {
  it('returns true for users with no subscription and a free plan', () => {
    expect(isFreeUser({ id: 1, subscription: null, plan: 'free' })).toBe(true)
  })

  it('returns false for users on a paid plan', () => {
    expect(isFreeUser({ id: 2, subscription: { plan: 'pro' }, plan: 'pro' })).toBe(false)
    expect(isFreeUser({ id: 3, subscription: null, plan: 'business' })).toBe(false)
  })

  it('defaults an unknown user without a plan to the free tier', () => {
    expect(isFreeUser({ id: 4 })).toBe(true)
  })
})

describe('UpgradeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthContext.mockReturnValue({ user: freeUser })
  })

  function renderModal(props = {}) {
    return render(
      <MemoryRouter>
        <UpgradeModal open onClose={jest.fn()} {...props} />
      </MemoryRouter>
    )
  }

  it('renders plan options for a free user and starts checkout on upgrade', async () => {
    getPlans.mockResolvedValue({ plans: [proPlan, teamPlan] })

    renderModal()

    // Dialog content mounts after plans resolve.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Upgrade plan' })).toBeInTheDocument()
    })
    expect(screen.getByText("You are on the free plan. Pick a plan below to unlock everything.")).toBeInTheDocument()

    const upgradePro = await screen.findByRole('button', { name: /Upgrade to Pro/i })
    expect(upgradePro).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(upgradePro)

    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledWith('price_pro', 14)
    })
  })

  it('hides rows for plans at or below the current plan', async () => {
    getPlans.mockResolvedValue({ plans: [proPlan, teamPlan] })

    useAuthContext.mockReturnValue({
      user: { ...paidUser }, // current tier 'pro'
    })

    renderModal()

    // 'pro' is not strictly above the current 'pro' tier so it must not be offered,
    // while 'team' (strictly above) still appears.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Upgrade to Team/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Upgrade to Pro/i })).not.toBeInTheDocument()
  })

  it('renders a fallback link to billing when no paid plans are available', async () => {
    getPlans.mockResolvedValue({ plans: [] })

    renderModal()

    await waitFor(() => {
      expect(screen.getByText(/View plans and billing/i)).toBeInTheDocument()
    })
    const link = screen.getByRole('link', { name: /View plans and billing/i })
    expect(link).toHaveAttribute('href', '/app/billing')
  })

  it('uses provided plans and does not call the network API', async () => {
    renderModal({ plans: [teamPlan] })

    expect(await screen.findByRole('button', { name: /Upgrade to Team/i })).toBeInTheDocument()
    expect(getPlans).not.toHaveBeenCalled()
  })
})

describe('UpgradeProvider / useUpgradeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthContext.mockReturnValue({ user: freeUser })
    getPlans.mockResolvedValue({ plans: [proPlan] })
  })

  function OpenButton() {
    const { openUpgrade } = useUpgradeModal()
    return (
      <button type="button" data-testid="open-upgrade" onClick={() => openUpgrade('Settings · Billing')}>
        Open upgrade
      </button>
    )
  }

  it('opens the shared modal with the provided source label', async () => {
    render(
      <MemoryRouter>
        <UpgradeProvider>
          <OpenButton />
        </UpgradeProvider>
      </MemoryRouter>
    )

    const user = userEvent.setup()
    await user.click(screen.getByTestId('open-upgrade'))

    // The global modal surfaces the dialog in the document body.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Upgrade plan' })).toBeInTheDocument()
    })
    expect(screen.getByText(/Settings · Billing/i)).toBeInTheDocument()
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
  })
})
