import { test as base, expect } from '@playwright/test'

/**
 * Test fixtures shared across all E2E tests.
 *
 * Usage:
 *   import { test, expect, TEST_USER } from '../fixtures/index.js'
 *   test('logs in', async ({ page, authPage }) => {
 *     await authPage.login(TEST_USER.email, TEST_USER.password)
 *   })
 */

/** Shared test user credentials — override with env vars in CI */
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? 'test@example.com',
  password: process.env.TEST_USER_PASSWORD ?? 'TestPassword1',
}

/** True when the suite runs against a server with a real database */
export const HAS_DATABASE = !!process.env.DATABASE_URL

/** CDN URL for auth assets — empty when not configured */
export const CDN_URL = process.env.CDN_URL ?? ''

/** Auth-specific CDN URL — falls back to CDN_URL when not configured */
export const AUTH_CDN_URL = process.env.AUTH_CDN_URL ?? CDN_URL

export const test = base.extend({
  /** Navigate to /auth and expose login helpers */
  authPage: async ({ page }, use) => {
    const emailInput = 'input[name="email"], input[type="email"]'
    const passwordInput = 'input[name="password"], input[type="password"]'
    const helpers = {
      goto: () => page.goto('/auth'),
      fillEmail: (email) => page.fill(emailInput, email),
      fillPassword: (password) => page.fill(passwordInput, password),
      submit: () => page.click('button[type="submit"]'),
      login: async (email, password) => {
        await page.goto('/auth')
        await page.fill(emailInput, email)
        await page.fill(passwordInput, password)
        await page.click('button[type="submit"]')
      },
      getError: async () => {
        const el = page.locator('[role="alert"], .error-message, [data-testid="error"]').first()
        const visible = await el.isVisible().catch(() => false)
        return visible ? el.textContent() : null
      },
    }
    await use(helpers)
  },
})

export { expect }

/** Helper: wait for navigation to a path */
export async function waitForPath(page, pathname, timeout = 10_000) {
  await page.waitForURL(`**${pathname}`, { timeout })
}
