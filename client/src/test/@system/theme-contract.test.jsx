// @system — Theme contract (light AND dark) across the three layers that must agree:
//   1. generated brand.css scopes tokens on :root / [data-theme="dark"] / [data-theme="light"]
//   2. brandPrePaint.applyDefaultTheme() sets <html data-theme> + .dark before first paint
//   3. ThemeProvider.setTheme() keeps both in sync afterwards
// jsdom resolves custom properties from stylesheets, so we inject the real
// brand.css and assert the COMPUTED token values flip with the theme.
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/app/store/@system/theme'
import { applyDefaultTheme, applyBrandColors } from '@/app/lib/@system/brandPrePaint'
import { info } from '@/config'

const BRAND_CSS = readFileSync(resolve(__dirname, '../../app/styles/@custom/brand.css'), 'utf8')

const block = (selector) => {
  const m = BRAND_CSS.match(new RegExp(selector.replace(/[[\]"]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\n\\}'))
  if (!m) throw new Error(`brand.css has no ${selector} block`)
  return m[1]
}
const declared = (selector, name) => {
  const m = block(selector).match(new RegExp(`${name}: ([^;]+);`))
  return m ? m[1].trim() : null
}
const computed = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

let prefersDark = false

beforeEach(() => {
  localStorage.clear()
  prefersDark = false
  window.matchMedia = () => ({
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener() {},
    removeEventListener() {},
  })
  const root = document.documentElement
  root.removeAttribute('data-theme')
  root.classList.remove('dark')
  root.style.colorScheme = ''
  document.head.innerHTML = ''
  const style = document.createElement('style')
  style.textContent = BRAND_CSS
  document.head.appendChild(style)
})

describe('brand.css token scopes', () => {
  it('defines the shadcn + brand + font tokens on :root and both data-theme scopes', () => {
    for (const sel of [':root', '[data-theme="dark"]', '[data-theme="light"]']) {
      expect(declared(sel, '--background')).toBeTruthy()
      expect(declared(sel, '--primary')).toBeTruthy()
      expect(declared(sel, '--ring')).toBeTruthy()
      expect(declared(sel, '--brand-primary')).toBeTruthy()
      expect(declared(sel, '--brand-bg')).toBeTruthy()
      expect(declared(sel, '--brand-text-on-primary')).toBeTruthy()
    }
    expect(declared(':root', '--font-heading')).toMatch(/^'/)
    expect(declared(':root', '--font-body')).toMatch(/^'/)
    expect(declared(':root', '--font-mono')).toMatch(/^'/)
    expect(declared('[data-theme="dark"]', '--brand-bg')).not.toBe(declared('[data-theme="light"]', '--brand-bg'))
    // brand.json defaultTheme drives the :root default
    const expectedDefault = info.defaultTheme === 'dark' ? '[data-theme="dark"]' : '[data-theme="light"]'
    expect(declared(':root', '--brand-bg')).toBe(declared(expectedDefault, '--brand-bg'))
  })

  it('never contains a legacy .dark token block (data-theme is the only switch)', () => {
    expect(BRAND_CSS).not.toMatch(/^\.dark\s*\{/m)
  })
})

describe('pre-paint theme (brandPrePaint.applyDefaultTheme)', () => {
  it('light default → data-theme="light", no .dark, light tokens computed', () => {
    const resolved = applyDefaultTheme({ defaultTheme: 'light' })
    expect(resolved).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('app-theme')).toBe('light')
    expect(computed('--brand-bg')).toBe(declared('[data-theme="light"]', '--brand-bg'))
    expect(computed('--background')).toBe(declared('[data-theme="light"]', '--background'))
  })

  it('dark default → data-theme="dark" + .dark, dark tokens computed', () => {
    applyDefaultTheme({ defaultTheme: 'dark' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(computed('--brand-bg')).toBe(declared('[data-theme="dark"]', '--brand-bg'))
    expect(computed('--brand-bg')).not.toBe(declared('[data-theme="light"]', '--brand-bg'))
  })

  it('a stored preference wins over the brand default', () => {
    localStorage.setItem('app-theme', 'dark')
    applyDefaultTheme({ defaultTheme: 'light' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('app-theme')).toBe('dark')
  })

  it("'system' resolves through prefers-color-scheme", () => {
    prefersDark = true
    expect(applyDefaultTheme({ defaultTheme: 'system' })).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    prefersDark = false
    expect(applyDefaultTheme({ defaultTheme: 'system' })).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('ThemeProvider keeps data-theme and .dark in sync', () => {
  const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>

  it('toggles both switches and the computed tokens follow', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => result.current.setTheme('dark'))
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(computed('--brand-bg')).toBe(declared('[data-theme="dark"]', '--brand-bg'))

    act(() => result.current.setTheme('light'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(computed('--brand-bg')).toBe(declared('[data-theme="light"]', '--brand-bg'))
    expect(localStorage.getItem('app-theme')).toBe('light')
  })
})

describe('runtime brand colour overrides cover every scope', () => {
  it('applies --brand-primary / --primary / --ring in light and dark', () => {
    applyBrandColors({ brandColor: '#7C3AED', accentColor: '#F59E0B' })
    applyDefaultTheme({ defaultTheme: 'light' })
    expect(computed('--brand-primary')).toBe('#7C3AED')
    expect(computed('--brand-accent')).toBe('#F59E0B')
    applyDefaultTheme({ defaultTheme: 'dark' })
    localStorage.setItem('app-theme', 'dark')
    applyDefaultTheme({ defaultTheme: 'dark' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(computed('--brand-primary')).toBe('#7C3AED')
    expect(computed('--primary')).toBe('262.1 83.3% 57.8%')
    expect(computed('--ring')).toBe(computed('--primary'))
  })
})
