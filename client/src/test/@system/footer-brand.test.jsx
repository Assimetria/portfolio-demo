// @system — Consumer-rendering contract test for the @custom override chain
// task #1024401 criterion #3: the merged @/config identity must actually reach
// the DOM through a real consumer component. The landing <Footer> renders the
// product name, tagline and logo from `info` (resolved in @/config as
// { ...@system/info, ...@custom/info } → @custom wins). Asserting the footer's
// rendered text proves the @custom override flows all the way to the rendered
// consumer, not just to the config object.
//
// This deliberately does NOT mock @/config — we render the real merge so any
// drift between @custom/info.js, the config resolver and the Footer is caught.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Footer } from '@/app/components/@system/Footer'
import { info } from '@/config'
// @custom/info.js is generated from brand.json (scripts/apply-brand.js, run by
// prebuild) — assert against the source of truth rather than a literal so the
// test survives re-branding.
import brand from '../../../../brand.json'

// NOTE: lucide-react is auto-mocked globally via jest moduleNameMapper
// (src/test/__mocks__/lucide-react.js) — no per-file mock needed.

const NAME = brand.companyName
const TAGLINE = brand.tagline
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function renderFooter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Footer />
    </MemoryRouter>
  )
}

describe('Footer renders the @custom identity from the merged @/config', () => {
  it('shows the @custom product name (overrides the @system default)', () => {
    expect(info.name).toBe(NAME)
    renderFooter()
    // Appears in the brand column link and again in the legal bar.
    expect(screen.queryAllByText(NAME).length).toBeGreaterThan(0)
  })

  it('shows the @custom tagline in the brand column', () => {
    expect(info.tagline).toBe(TAGLINE)
    renderFooter()
    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
  })

  it('links the brand logo to the @custom logo asset', () => {
    renderFooter()
    const brandLink = screen.getByRole('link', { name: NAME })
    const logo = brandLink.querySelector('img')
    expect(logo).not.toBeNull()
    expect(logo.getAttribute('src')).toBe(info.logo)
  })

  it('renders the legal links and the @custom name inside the legal bar', () => {
    renderFooter()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
    expect(screen.getByText('Cookie Policy')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`© \\d{4} ${escapeRe(NAME)}\\. All rights reserved\\.`))).toBeInTheDocument()
  })

  it('hides the social icon section when @custom/info.social has no configured links', () => {
    renderFooter()
    expect(screen.queryByText('GitHub')).not.toBeInTheDocument()
    expect(screen.queryByText('Twitter / X')).not.toBeInTheDocument()
  })
})
