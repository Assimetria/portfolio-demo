// @system — Tests for the reusable PricingSection landing component
import { render, screen } from '../test-utils'
import { MemoryRouter } from 'react-router-dom'
import { PricingSection } from '@/app/components/@system/PricingSection'

// Keep the test focused on PricingSection logic by stubbing presentational deps.
jest.mock('@/app/components/@system/Card', () => ({
  Card: ({ children, className, ...props }) => <div data-testid="card" className={className} {...props}>{children}</div>,
  CardContent: ({ children, className, ...props }) => <div className={className} {...props}>{children}</div>,
}))

jest.mock('@/app/components/@system/ui/button', () => ({
  Button: ({ asChild, children, ...props }) => <button data-testid="button" {...props}>{children}</button>,
}))

function renderSection(props = {}) {
  return render(
    <MemoryRouter>
      <PricingSection {...props} />
    </MemoryRouter>
  )
}

describe('PricingSection', () => {
  it('renders the default heading, subtitle and eyebrow', () => {
    renderSection()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument()
    expect(screen.getByText('No hidden fees. No surprise charges. Cancel anytime.')).toBeInTheDocument()
  })

  it('renders every default plan with its price, description and CTA', () => {
    renderSection()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.getByText('For individuals and small projects')).toBeInTheDocument()
    expect(screen.getByText('Get Started Free')).toBeInTheDocument()

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('$29')).toBeInTheDocument()
    expect(screen.getByText('Start Free Trial')).toBeInTheDocument()

    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.getByText('Contact Sales')).toBeInTheDocument()
  })

  it('lists the features of a plan', () => {
    renderSection()
    expect(screen.getByText('Up to 3 projects')).toBeInTheDocument()
    expect(screen.getByText('Team collaboration')).toBeInTheDocument()
    expect(screen.getByText('SSO / SAML')).toBeInTheDocument()
  })

  it('flags the highlighted plan with "Most Popular"', () => {
    renderSection()
    expect(screen.getByText('Most Popular')).toBeInTheDocument()
  })

  it('respects a custom heading, subtitle and eyebrow', () => {
    renderSection({
      eyebrow: 'Plans',
      heading: 'Pick your tier',
      subtitle: 'Pricing that scales with you.',
    })
    expect(screen.getByText('Plans')).toBeInTheDocument()
    expect(screen.getByText('Pick your tier')).toBeInTheDocument()
    expect(screen.getByText('Pricing that scales with you.')).toBeInTheDocument()
  })

  it('renders custom plans supplied via the plans prop', () => {
    const plans = [
      {
        name: 'Starter',
        price: '$10',
        period: '/month',
        description: 'Kick things off',
        features: ['1 seat', 'Basic metrics'],
        cta: 'Choose Starter',
        ctaLink: '/register?plan=starter',
        highlighted: false,
      },
    ]
    renderSection({ plans })
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('$10')).toBeInTheDocument()
    expect(screen.getByText('1 seat')).toBeInTheDocument()
    expect(screen.getByText('Choose Starter')).toBeInTheDocument()
  })

  it('does not show the highlight label when no plan is highlighted', () => {
    renderSection({
      plans: [
        {
          name: 'Basic',
          price: '$5',
          period: '/month',
          description: 'A single plan',
          features: ['Basic access'],
          cta: 'Get Started',
          ctaLink: '/register',
          highlighted: false,
        },
      ],
    })
    expect(screen.queryByText('Most Popular')).not.toBeInTheDocument()
  })

  it('falls back to default plans when an empty array is supplied', () => {
    renderSection({ plans: [] })
    // Default tiers are rendered instead of an empty grid.
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
  })
})
