import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration
 * Docs: https://playwright.dev/docs/test-configuration
 *
 * Default: Chromium only, against a locally started production build
 * (scripts/e2e-server.js boots Express with NODE_ENV=production serving
 * client/dist — the same way the Docker image runs; no database needed, the
 * server comes up degraded).
 *
 *   npm run test:e2e                          # builds client/dist if missing, starts server, runs specs
 *   PLAYWRIGHT_ALL_BROWSERS=1 npm run test:e2e  # + Firefox, WebKit, mobile Chrome
 *   BASE_URL=https://acme.orkosi.app npm run test:e2e  # against a deployed app (no local server)
 *   DATABASE_URL=postgresql://... npm run test:e2e     # enables specs that need a real database
 *   E2E_ALLOW_EXTERNAL=1 npm run test:e2e              # do not blackhole fonts/analytics CDNs
 */

const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`
const ALL_BROWSERS = process.env.PLAYWRIGHT_ALL_BROWSERS === '1'
const IS_CI = !!process.env.CI

// Third-party hosts the app references from index.html. In sandboxed/offline
// runners they can stall the `load` event for 30 s+; resolving them to NOTFOUND
// makes those requests fail instantly instead (Chromium only).
const EXTERNAL_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'plausible.io']
const chromiumArgs = process.env.E2E_ALLOW_EXTERNAL
  ? []
  : [`--host-resolver-rules=${EXTERNAL_HOSTS.map((h) => `MAP ${h} ~NOTFOUND`).join(', ')}`]

// CDN host resolver rules — when CDN_URL or AUTH_CDN_URL is set in the e2e
// environment, blocklist them too so CI does not reach out to the real CDN.
const CDN_HOSTS = []
if (process.env.CDN_URL) {
  try { CDN_HOSTS.push(new URL(process.env.CDN_URL).hostname) } catch (_) { /* skip */ }
}
if (process.env.AUTH_CDN_URL) {
  try { CDN_HOSTS.push(new URL(process.env.AUTH_CDN_URL).hostname) } catch (_) { /* skip */ }
}
if (CDN_HOSTS.length > 0 && !process.env.E2E_ALLOW_EXTERNAL) {
  chromiumArgs.push(...CDN_HOSTS.map((h) => `MAP ${h} ~NOTFOUND`))
}

const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: chromiumArgs } } },
]
if (ALL_BROWSERS) {
  projects.push(
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'], launchOptions: { args: chromiumArgs } } },
  )
}

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.js$/,

  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: IS_CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['github']]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects,

  // Start the production build locally unless BASE_URL points at a deployed app.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node scripts/e2e-server.js',
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !IS_CI,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { E2E_PORT: String(PORT) },
      },
})
