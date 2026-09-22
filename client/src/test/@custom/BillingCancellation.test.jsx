// @custom — BillingPage guided cancellation survey: handleCancel + cancel payload
// AC6: user picks a preset reason (+ optional free-text feedback) in a guided
// modal and the selected reason/feedback payload is sent to cancelSubscription().
import { render, screen, waitFor } from '../test-utils'
import userEvent from '@testing-library/user-event'
import * as stripeApi from '@/app/api/@system/stripe'
import { BillingPage } from '@/app/pages/app/@system/BillingPage'


// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock the stripe client module used by BillingPage so we can assert the payload
// passed to cancelSubscription is built from the survey selections.
jest.mock('@/app/api/@system/stripe', () => ({
  getMySubscription: jest.fn(),
  getPlans: jest.fn(),
  createCheckoutSession: jest.fn(),
  createPortalSession: jest.fn(),
  cancelSubscription: jest.fn(),
  uncancelSubscription: jest.fn(),
  formatAmount: (amount) => `$${(amount / 100).toFixed(0)}`,
  formatInterval: (interval, count) => `/${count > 1 ? count + ' ' : ''}${interval}`,
}))

// Dashboard barrel pulls in heavily-wired Sidebar/Menu components.
jest.mock('@/app/components/@system/Dashboard', () => {
  const Content = ({ children }) => <div data-testid="billing-content">{children}</div>
  const Layout = ({ children }) => <div>{children}</div>
  Layout.Content = Content
  return { DashboardLayout: Layout }
})


// The Modal wraps radix Dialog (portal + transitions) — render children inline so
// the survey can be exercised headlessly.
jest.mock('@/app/components/@system/Modal', () => ({
  Modal: ({ open, title, description, children }) =>
    open ? (
      <div data-testid="cancel-modal" role="dialog">
        {title && <h2>{title}</h2>}
        {description && <p>{description}</p>}
        {children}
      </div>
    ) : null,
}))

// BillingPage reads the current user (plan tier) and the shared upgrade modal.
jest.mock('@/app/store/@system/auth', () => ({
  useAuthContext: () => ({
    user: { id: 1, name: 'Alice', email: 'alice@example.com', plan: 'pro', subscription: { plan: 'pro' } },
    loading: false,
    isAuthenticated: true,
  }),
}))
jest.mock('@/app/store/@system/upgradeModal', () => ({
  useUpgradeModal: () => ({ openUpgrade: jest.fn(), closeUpgrade: jest.fn(), isOpen: false }),
}))

// react-router-dom hooks need a mounted router; mock them directly.
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(''), jest.fn()],
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}))


// ── Helpers ──────────────────────────────────────────────────────────────────

function activeSubscription() {
  return {
    status: 'active',
    cancel_at_period_end: false,
    stripe_subscription_id: 'sub_123',
    current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString(),
    current_period_start: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
  }
}

async function renderBilling(subscription = activeSubscription()) {
  stripeApi.getMySubscription.mockResolvedValue({ subscription })
  stripeApi.getPlans.mockResolvedValue({ plans: [] })
  stripeApi.cancelSubscription.mockResolvedValue({ message: 'Subscription will cancel at period end' })

  const user = userEvent.setup()
  render(<BillingPage />)
  // Wait for the async load() to finish and expose the Cancel Plan action.
  const cancelPlanBtn = await screen.findByRole('button', { name: /cancel plan/i })
  return { user, cancelPlanBtn }
}

describe('BillingPage cancellation flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders preset reason options inside a survey (no bare confirm)', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, cancelPlanBtn } = await renderBilling()

    await user.click(cancelPlanBtn)

    expect(confirmSpy).not.toHaveBeenCalled()
    for (const label of [
      /too expensive/i,
      /missing features/i,
      /don\u2019t use it enough/i,
      /technical problems/i,
      /switching to another service/i,
      /something else/i,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText(/anything we could do better/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('opens the guided survey (handleCancel) instead of a bare confirm', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, cancelPlanBtn } = await renderBilling()

    await user.click(cancelPlanBtn)

    // The guided survey dialog is rendered.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/we\u2019re sorry to see you go/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('requires a reason before cancelling', async () => {
    const { user, cancelPlanBtn } = await renderBilling()

    await user.click(cancelPlanBtn)
    await user.click(screen.getByRole('button', { name: /cancel subscription/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/why you/i)
    expect(stripeApi.cancelSubscription).not.toHaveBeenCalled()
  })

  it('still requires free-text detail when "Something else" is chosen', async () => {
    const { user, cancelPlanBtn } = await renderBilling()

    await user.click(cancelPlanBtn)
    await user.click(screen.getByText(/something else/i))
    // Leave the "please tell us more" detail blank and try to cancel.
    await user.click(screen.getByRole('button', { name: /cancel subscription/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/why you/i)
    expect(stripeApi.cancelSubscription).not.toHaveBeenCalled()
  })


  it('submits the selected preset reason + optional feedback to cancelSubscription', async () => {
    const { user, cancelPlanBtn } = await renderBilling()

    await user.click(cancelPlanBtn)
    await user.click(screen.getByText(/too expensive/i))
    await user.type(
      screen.getByLabelText(/anything we could do better/i),
      'Would love a mid-tier plan'
    )
    await user.click(screen.getByRole('button', { name: /cancel subscription/i }))

    expect(stripeApi.cancelSubscription).toHaveBeenCalledWith({
      reason: 'too_expensive',
      feedback: 'Would love a mid-tier plan',
    })
  })

  it('uses free text when "Other / Something else" is selected', async () => {
    const { user, cancelPlanBtn } = await renderBilling()

    await user.click(cancelPlanBtn)
    await user.click(screen.getByText(/something else/i))
    await user.type(screen.getByLabelText(/please tell us more/i), 'Company closed down')
    await user.click(screen.getByRole('button', { name: /cancel subscription/i }))

    expect(stripeApi.cancelSubscription).toHaveBeenCalledWith({
      reason: 'Company closed down',
      feedback: undefined,
    })
  })

  it('refreshes the subscription after a successful cancellation', async () => {
    const { user, cancelPlanBtn } = await renderBilling()

    await user.click(cancelPlanBtn)
    await user.click(screen.getByText(/too expensive/i))
    await user.click(screen.getByRole('button', { name: /cancel subscription/i }))

    await waitFor(() => expect(stripeApi.getMySubscription).toHaveBeenCalledTimes(2))
    expect(stripeApi.cancelSubscription).toHaveBeenCalledTimes(1)
  })
})

