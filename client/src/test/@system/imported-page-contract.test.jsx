// @system — The cloner emit contract (docs/INFORMATIONAL-SPEC.md §6) exercised
// end to end with the reference fixtures in fixtures/imported/:
//   pages/@custom/imported/<Name>/index.jsx  default-exports a page wrapped in ImportedRoot
//   styles/@custom/imported/site.css          imported by the page (scoped by PostCSS)
//   routes/@custom/index.jsx → customRoutes   `/` replaces SitePage via mergeRoutes
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mergeRoutes } from '@/app/routes/@system/utils'
import { ImportedRoot } from '@/app/components/@system/site'
import Home from './fixtures/imported/Home'
import { customRoutes } from './fixtures/imported/routes'

describe('ImportedRoot', () => {
  it('renders the [data-imported-root] wrapper the scoped CSS targets', () => {
    const { container } = render(<ImportedRoot className="x"><p>hi</p></ImportedRoot>)
    const root = container.querySelector('[data-imported-root]')
    expect(root).not.toBeNull()
    expect(root.tagName).toBe('DIV')
    expect(root).toHaveClass('x')
    expect(root).toHaveTextContent('hi')
  })

  it('can render as another element', () => {
    const { container } = render(<ImportedRoot as="section" />)
    expect(container.querySelector('section[data-imported-root]')).not.toBeNull()
  })
})

describe('reference imported page', () => {
  it('wraps its markup in ImportedRoot and serves assets from /imported/assets/', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const root = document.querySelector('[data-imported-root]')
    expect(root).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Casa do Norte')
    expect(screen.getByRole('img', { name: /dining room/i })).toHaveAttribute('src', '/imported/assets/hero.jpg')
  })
})

describe('routes merge — customRoutes replace `/` and add pages', () => {
  const systemRoutes = [
    { path: '/', element: <div data-testid="site-page" /> },
    { path: '/privacy', element: <div data-testid="privacy" /> },
    { path: '*', element: <div data-testid="404" /> },
  ]

  it('custom `/` wins by path, system-only routes survive, new routes are appended', () => {
    const merged = mergeRoutes(systemRoutes, customRoutes)
    const byPath = Object.fromEntries(merged.map((r) => [r.path, r]))
    expect(byPath['/'].element).toBe(customRoutes[0].element)
    expect(byPath['/menu']).toBeDefined()
    expect(byPath['/blog/:slug']).toBeDefined()
    expect(byPath['/privacy']).toBe(systemRoutes[1])
    expect(byPath['*']).toBe(systemRoutes[2])
    expect(merged.filter((r) => r.path === '/')).toHaveLength(1)
  })
})
