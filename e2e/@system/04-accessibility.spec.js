import { test, expect } from '@playwright/test'

/**
 * Basic accessibility checks
 * These are smoke-level a11y tests — not a full audit.
 * For deeper audits consider adding axe-playwright.
 */

const PUBLIC_ROUTES = [
  { path: '/', name: 'Landing' },
  { path: '/auth', name: 'Auth / Login' },
  { path: '/register', name: 'Register' },
  { path: '/pricing', name: 'Pricing' },
  { path: '/help', name: 'Help Center' },
]

for (const { path, name } of PUBLIC_ROUTES) {
  test(`${name} (${path}): has a page title`, async ({ page }) => {
    await page.goto(path)
    const title = await page.title()
    // A non-empty title is the minimum bar
    expect(title.length).toBeGreaterThan(0)
  })

  test(`${name} (${path}): has at least one heading`, async ({ page }) => {
    await page.goto(path)
    // Pages are lazy-loaded chunks — wait for the first heading rather than
    // counting synchronously right after `load`.
    await expect(page.locator('h1, h2, h3').first()).toBeAttached()
  })

  test(`${name} (${path}): images have alt text`, async ({ page }) => {
    await page.goto(path)
    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt')
      // alt="" (decorative) is acceptable; null/missing is not
      expect(alt).not.toBeNull()
    }
  })
}

test('landing page: no console errors on load', async ({ page }) => {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    // playwright.config.js blackholes fonts.googleapis.com / fonts.gstatic.com /
    // plausible.io so offline runners do not stall; those resource failures are
    // expected and not an application error.
    const url = msg.location()?.url ?? ''
    if (/ERR_NAME_NOT_RESOLVED/.test(msg.text()) && /googleapis|gstatic|plausible/.test(url)) return
    errors.push(`${msg.text()} (${url})`)
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Filter out known non-critical errors (e.g. browser extension noise)
  const criticalErrors = errors.filter(
    (e) => !e.includes('extension') && !e.includes('favicon')
  )
  expect(criticalErrors).toHaveLength(0)
})

test('auth page: form inputs have associated labels', async ({ page }) => {
  await page.goto('/auth')
  const inputs = page.locator('input[type="email"], input[type="password"], input[type="text"]')
  const count = await inputs.count()
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i)
    const id = await input.getAttribute('id')
    const ariaLabel = await input.getAttribute('aria-label')
    const ariaLabelledBy = await input.getAttribute('aria-labelledby')
    // Each input should have either an id (for <label for=...>) or an aria-label
    const hasLabel = id !== null || ariaLabel !== null || ariaLabelledBy !== null
    expect(hasLabel).toBe(true)
  }
})
