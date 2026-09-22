# E2E Tests — Playwright

End-to-end tests for the product template using [Playwright](https://playwright.dev/).
They run against the **production build** (Express serving `client/dist`), the same way
the Docker image runs on App Runner — no database is required for the default suite.

## Structure

```
e2e/
  @system/                         # Template tests (synced from upstream — do not edit)
    01-public-pages.spec.js        — Public marketing/legal pages load, mailto links are branded
    02-auth.spec.js                — Auth/register/reset UI, protected-route guards
    03-navigation.spec.js          — Client-side routing, redirects, 404 handling
    04-accessibility.spec.js       — Titles, headings, alt text, labels, no console errors
    05-brand-and-theme.spec.js     — brand.json → <title>, data-theme, --brand-primary, theme toggle
    retention.spec.js              — Retention API rejects unauthenticated calls
  @custom/                         # Product-specific tests (add yours here)
  fixtures/
    index.js                       — Shared fixtures (authPage helper, TEST_USER, waitForPath)
```

## Running

```bash
# From the repo root. First time only:
npx playwright install chromium

npm run test:e2e              # Chromium — builds client/dist if missing, boots the server, runs specs
npm run test:e2e:all          # + Firefox, WebKit, mobile Chrome
npm run test:e2e:ui           # interactive UI mode
npm run test:e2e:headed       # visible browser
npm run test:e2e:report       # open the last HTML report
```

How the server is started: `playwright.config.js` declares a `webServer` that runs
`scripts/e2e-server.js` — `NODE_ENV=production`, `SPA_HTML_DIR=client/dist`, an
ephemeral RS256 key pair, and an **unreachable** `DATABASE_URL` unless you provide one,
so the app boots degraded (`/api/health` → `{ status: "degraded", db: "disconnected" }`)
and never touches a real local database by accident.

| Variable | Default | Effect |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Set to a deployed app URL to skip the local server entirely |
| `E2E_PORT` | `3000` | Port for the local server |
| `DATABASE_URL` | unreachable | Provide a real database to enable DB-backed specs (login with credentials, …) |
| `PLAYWRIGHT_ALL_BROWSERS` | — | `1` runs all four browser projects |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | `test@example.com` / `TestPassword1` | Credentials used by DB-backed auth specs |
| `CI` | — | Enables retries (2), `forbidOnly`, GitHub reporter |

Specs that need a database call `test.skip(!process.env.DATABASE_URL, ...)` so the
default run stays green without one.

## Adding product tests

Create files in `e2e/@custom/` — they are picked up automatically.

```js
// e2e/@custom/my-feature.spec.js
import { test, expect } from '@playwright/test'

test('my feature works', async ({ page }) => {
  await page.goto('/my-route')
  await expect(page.locator('h1')).toContainText('My Feature')
})
```

For login flows use the shared fixture: `import { test, expect, TEST_USER } from '../fixtures/index.js'`
and `await authPage.login(TEST_USER.email, TEST_USER.password)`.

## CI

`.github/workflows/e2e.yml` runs this suite nightly and on demand (`workflow_dispatch`,
optionally against a `base_url`). It is intentionally **not** part of the `ci` merge gate;
the gate runs lint, unit tests, the production build and a Docker smoke test instead.
