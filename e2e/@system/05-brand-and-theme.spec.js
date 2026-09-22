import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Brand & theme contract
 *
 * brand.json is the single source of truth for a product's identity. These
 * tests assert the built app actually reflects it:
 *   - <title> carries the brand name (companyName)
 *   - <html data-theme> exposes the resolved theme (brand.css keys its dark /
 *     light token blocks on [data-theme])
 *   - the --brand-primary CSS custom property equals brand.json primaryColor
 *   - the header theme toggle (where present) flips data-theme
 *   - the landing page renders without console errors
 *
 * No database required.
 */

/** brand.json lives one level above the Playwright testDir (e2e/). */
function loadBrand(testInfo) {
  const file = path.resolve(testInfo.config.rootDir, '..', 'brand.json')
  return JSON.parse(readFileSync(file, 'utf8'))
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Normalise "#64748B" / "rgb(100, 116, 139)" / "rgb(100,116,139)" to "rgb(r, g, b)". */
function normaliseColor(value) {
  const v = String(value).trim().toLowerCase()
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    const n = parseInt(h, 16)
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) return `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`
  return v
}

test.describe('Brand & theme', () => {
  let brand
  let brandName
  let primary

  test.beforeAll(({}, testInfo) => {
    brand = loadBrand(testInfo)
    brandName = brand.companyName || brand.name
    primary = brand.primaryColor || brand.brand_color
  })

  test('document <title> contains the brand name from brand.json', async ({ page }) => {
    expect(brandName, 'brand.json must define companyName').toBeTruthy()
    await page.goto('/')
    await expect(page).toHaveTitle(new RegExp(escapeRegExp(brandName), 'i'))
  })

  test('<html data-theme> is set to the resolved theme', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/)
  })

  test('--brand-primary equals brand.json primaryColor', async ({ page }) => {
    expect(primary, 'brand.json must define primaryColor').toBeTruthy()
    await page.goto('/')
    const computed = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--brand-primary'),
    )
    expect(computed.trim(), '--brand-primary must be defined on :root').not.toBe('')
    expect(normaliseColor(computed)).toBe(normaliseColor(primary))
  })

  test('header theme toggle switches data-theme', async ({ page }) => {
    // Start from an explicit light theme so the first click is deterministic.
    await page.addInitScript(() => {
      try { localStorage.setItem('app-theme', 'light') } catch { /* ignore */ }
    })
    // The shared Header (with the toggle) is used on public content pages.
    await page.goto('/contact')
    const toggle = page.getByRole('button', { name: /switch theme|toggle theme|theme/i }).first()
    if ((await toggle.count()) === 0) {
      test.skip(true, 'No theme toggle in the header on this product')
    }
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'light')
    await toggle.click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })

  test('landing page renders without console errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Third-party analytics/CDN requests blocked in test environments are not app bugs.
    const relevant = errors.filter(
      (e) => !/plausible|fonts\.g(oogle)?apis|ERR_BLOCKED_BY_CLIENT|net::ERR_/i.test(e),
    )
    expect(relevant, `console errors:\n${relevant.join('\n')}`).toHaveLength(0)
  })
})
