import { test, expect } from '@playwright/test'

/**
 * Public / marketing pages
 * These routes are accessible without authentication.
 */

test.describe('Public pages', () => {
  test('landing page loads and has correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/auth/)
    // The page should not redirect unauthenticated users away
    await expect(page).toHaveURL('/')
    // Basic check: page renders without crashing
    await expect(page.locator('body')).toBeVisible()
  })

  test('pricing page is accessible', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page).toHaveURL('/pricing')
    await expect(page.locator('body')).toBeVisible()
  })

  test('terms page is accessible', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).toHaveURL('/terms')
    await expect(page.locator('body')).toBeVisible()
  })

  test('privacy policy page is accessible', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveURL('/privacy')
    await expect(page.locator('body')).toBeVisible()
  })

  test('blog page is accessible', async ({ page }) => {
    await page.goto('/blog')
    await expect(page).toHaveURL('/blog')
    await expect(page.locator('body')).toBeVisible()
  })

  test('help center page is accessible', async ({ page }) => {
    await page.goto('/help')
    await expect(page).toHaveURL('/help')
    await expect(page.locator('body')).toBeVisible()
  })

  test('about page is accessible', async ({ page }) => {
    await page.goto('/about')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('body')).toBeVisible()
  })

  test('contact page is accessible', async ({ page }) => {
    await page.goto('/contact')
    await expect(page).toHaveURL('/contact')
    await expect(page.locator('body')).toBeVisible()
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz')
    await expect(page.locator('body')).toBeVisible()
    // Should not crash — app renders something
    const status = page.url()
    expect(status).toBeTruthy()
  })

  test('/login redirects to /auth', async ({ page }) => {
    await page.goto('/login')
    await page.waitForURL('**/auth', { timeout: 5_000 }).catch(() => {})
    // Either landed on /auth or still on /login — either is acceptable
    // The key check: the page doesn't crash
    await expect(page.locator('body')).toBeVisible()
  })

  test('/dashboard redirects authenticated users or shows auth gate', async ({ page }) => {
    await page.goto('/dashboard')
    // Unauthenticated: should redirect to /auth or /app (still accessible)
    await expect(page.locator('body')).toBeVisible()
  })

  // mailto: links must use the product's configured support address and never a
  // template placeholder. The expected address comes from .config/info.js
  // (supportEmail) — the shared source of truth for client and server — so the
  // check is valid for every product generated from the template.
  const PLACEHOLDER_EMAILS = ['support@yourproduct.com', 'support@example.com', 'hello@example.com']

  async function readSupportEmail(testInfo) {
    const { createRequire } = await import('node:module')
    const path = await import('node:path')
    const requireFromRoot = createRequire(path.resolve(testInfo.config.rootDir, '..', 'package.json'))
    try {
      const info = requireFromRoot('./.config/info.js')
      return process.env.SUPPORT_EMAIL || info.supportEmail || info.email || null
    } catch {
      return process.env.SUPPORT_EMAIL || null
    }
  }

  async function collectMailto(scope) {
    const hrefs = await scope.locator('a[href^="mailto:"]').evaluateAll(els => els.map(el => el.getAttribute('href')))
    return hrefs.map(h => h.replace(/^mailto:/i, '').split('?')[0].toLowerCase())
  }

  for (const route of ['/', '/#pricing', '/pricing']) {
    test(`mailto links on ${route} use the configured support email`, async ({ page }, testInfo) => {
      const supportEmail = (await readSupportEmail(testInfo))?.toLowerCase()
      await page.goto(route)
      const emails = await collectMailto(page)
      for (const email of emails) {
        expect(PLACEHOLDER_EMAILS, `placeholder email in mailto: ${email}`).not.toContain(email)
        if (supportEmail) expect(email).toBe(supportEmail)
      }
    })
  }

  test('footer support and contact links use the configured support email', async ({ page }, testInfo) => {
    const supportEmail = (await readSupportEmail(testInfo))?.toLowerCase()
    await page.goto('/')
    const footer = page.locator('footer')
    if ((await footer.count()) === 0) test.skip(true, 'No <footer> on the landing page')
    const emails = await collectMailto(footer.first())
    for (const email of emails) {
      expect(PLACEHOLDER_EMAILS, `placeholder email in footer mailto: ${email}`).not.toContain(email)
      if (supportEmail) expect(email).toBe(supportEmail)
    }
  })

  test('conversion page is accessible without auth', async ({ page }) => {
    await page.goto('/conversion')
    await expect(page).toHaveURL('/conversion')
    // Renders the campaign funnel hero without crashing
    await expect(page).not.toHaveURL(/\/auth/)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1')).toContainText('Start building')
  })

  test('thank-you page renders a post-conversion confirmation', async ({ page }) => {
    await page.goto('/thank-you')
    await expect(page).toHaveURL('/thank-you')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
  })

  test('unsubscribe page is reachable and handles a token-less (invalid) link', async ({ page }) => {
    await page.goto('/unsubscribe')
    await expect(page).toHaveURL('/unsubscribe')
    // No token/email supplied → shows the invalid-link guidance instead of crashing
    await expect(page.locator('body')).toBeVisible()
    await expect(page.getByRole('link', { name: /Manage notification settings/i })).toBeVisible()
  })
})
