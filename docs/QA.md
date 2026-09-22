# QA Strategy — Product Template

> Purpose: QA philosophy, coverage goals and the manual release checklist. Concrete test commands and CI gates live in `TESTING.md`.
> Last verified: 2026-09-20.

---

## Table of Contents

1. [Overview](#overview)
2. [QA Philosophy](#qa-philosophy)
3. [Testing Pyramid](#testing-pyramid)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [E2E Testing](#e2e-testing)
7. [Test Coverage Goals](#test-coverage-goals)
8. [Performance Testing](#performance-testing)
9. [Security Testing](#security-testing)
10. [Accessibility Testing](#accessibility-testing)
11. [Cross-Browser Testing](#cross-browser-testing)
12. [Manual Testing Checklist](#manual-testing-checklist)
13. [CI/CD Testing](#cicd-testing)
14. [Bug Tracking](#bug-tracking)
15. [Quality Metrics](#quality-metrics)

---

## Overview

The Product Template serves as the **foundation for all Assimetria products**. Its quality directly impacts every product built from it, making thorough testing critical.

### Testing Goals

1. **Stability** — Template updates must not break existing products
2. **Reliability** — Core features (auth, billing, database) must be rock-solid
3. **Security** — Vulnerabilities in the template propagate to all products
4. **Performance** — Slow template = slow products
5. **Accessibility** — WCAG 2.1 AA compliance out of the box

---

## QA Philosophy

### Principles

1. **Test what matters** — Focus on critical paths (auth, billing, data integrity)
2. **Automate ruthlessly** — Manual testing for exploration only
3. **Shift left** — Catch bugs in development, not production
4. **Test like a user** — E2E tests simulate real user behavior
5. **Security first** — Every PR scanned for vulnerabilities

### Critical Path

The template's **critical path** (features that must never break):

1. ✅ **Registration** — User can create account
2. ✅ **Email verification** — Verification link works
3. ✅ **Login** — User can authenticate
4. ✅ **Protected routes** — Auth guards work
5. ✅ **JWT validation** — Tokens verified correctly
6. ✅ **Password reset** — Reset flow works end-to-end
7. ✅ **Subscription creation** — Stripe checkout completes
8. ✅ **Subscription management** — Cancel, upgrade work
9. ✅ **Webhook handling** — Stripe events processed
10. ✅ **Database migrations** — Schema changes apply cleanly

---

## Testing Pyramid

The template follows the **testing pyramid** strategy:

```
         /\
        /  \
       / E2E \        5%  — End-to-end (Playwright)
      /--------\
     /          \
    / Integration \   15% — API integration (Supertest)
   /--------------\
  /                \
 /   Unit Tests     \ 80% — Unit tests (Jest)
/____________________\
```

### Rationale

- **Unit tests:** Fast, isolated, catch logic errors
- **Integration tests:** Test API endpoints, database interactions
- **E2E tests:** Expensive but validate complete user flows

---

## Unit Testing

### Framework

- **Jest** — Fast, zero-config, great DX

### Scope

**Backend (`server/test/unit/`):**

- Utility functions (crypto, validation, JWT)
- Repository methods (database queries)
- Middleware (auth, rate limiting)
- Business logic (subscription calculations)

**Frontend (`client/src/test/unit/`):**

- React components (with React Testing Library)
- API client wrappers
- Utility functions (cn, formatters)

### Example: Unit Test (Backend)

```js
// server/test/unit/lib/crypto.test.js
const { encrypt, decrypt } = require('../../../src/lib/@system/crypto')

describe('Crypto utilities', () => {
  test('encrypts and decrypts text', () => {
    const plaintext = 'secret data'
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)

    expect(encrypted).not.toBe(plaintext) // Encrypted is different
    expect(decrypted).toBe(plaintext)     // Decryption restores original
  })

  test('produces different ciphertext each time', () => {
    const plaintext = 'test'
    const encrypted1 = encrypt(plaintext)
    const encrypted2 = encrypt(plaintext)

    expect(encrypted1).not.toBe(encrypted2) // IV ensures randomness
  })
})
```

### Example: Unit Test (Frontend)

```jsx
// client/src/test/unit/components/Button.test.jsx
import { render, screen } from '@testing-library/react'
import { Button } from '../../../app/components/@system/ui/Button'

describe('Button component', () => {
  test('renders text correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  test('applies variant styles', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-destructive')
  })

  test('calls onClick handler', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    screen.getByRole('button').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Running Unit Tests

```bash
cd server
npm test -- --testPathPattern=test/unit

cd ../client
npm run test
```

---

## Integration Testing

### Framework

- **Supertest** — HTTP assertions for Express
- **Jest** — Test runner

### Scope

Integration tests verify **API endpoints with real database**:

- Auth endpoints (register, login, logout)
- User management (CRUD)
- Billing endpoints (create subscription, cancel)
- Webhooks (Stripe event handling)
- Admin endpoints (user management, stats)

### Example: Integration Test

```js
// server/test/api/sessions.test.js
const request = require('supertest')
const { createApp } = require('../../src/app')
const { db } = require('../../src/lib/@system/db')

describe('POST /api/sessions (login)', () => {
  let app

  beforeAll(() => {
    app = createApp()
  })

  beforeEach(async () => {
    // Clean database
    await db.none('DELETE FROM users')
  })

  test('logs in with valid credentials', async () => {
    // Create user
    await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', password: 'Password123', name: 'Test' })

    // Login
    const res = await request(app)
      .post('/api/sessions')
      .send({ email: 'test@example.com', password: 'Password123' })

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('test@example.com')
    expect(res.headers['set-cookie']).toBeDefined() // JWT cookie set
  })

  test('rejects invalid password', async () => {
    await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', password: 'Password123', name: 'Test' })

    const res = await request(app)
      .post('/api/sessions')
      .send({ email: 'test@example.com', password: 'WrongPassword' })

    expect(res.status).toBe(401)
  })

  test('rate limits after 5 failed attempts', async () => {
    await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', password: 'Password123', name: 'Test' })

    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/sessions')
        .send({ email: 'test@example.com', password: 'Wrong' })
    }

    // 6th attempt blocked
    const res = await request(app)
      .post('/api/sessions')
      .send({ email: 'test@example.com', password: 'Password123' })

    expect(res.status).toBe(429) // Too Many Requests
  })
})
```

### Running Integration Tests

```bash
cd server

# Set test database URL
export DATABASE_URL=postgresql://user:pass@localhost:5432/test_db

# Run tests
npm test -- --testPathPattern=test/api
```

---

## E2E Testing

### Framework

- **Playwright** — Cross-browser automation

### Scope

E2E tests simulate **real user behavior** in a browser:

- Landing page loads correctly
- User can register, verify email, login
- Protected routes redirect unauthenticated users
- Subscription checkout flow works
- Dashboard pages render without errors
- 404 page displays for unknown routes

### Test Suites

**1. Public Pages (`e2e/@system/01-public-pages.spec.ts`)**

Tests that public pages load without errors:

```ts
import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.locator('body')).toBeVisible()
  })

  test('pricing page loads', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page).toHaveURL('/pricing')
    await expect(page.locator('body')).toBeVisible()
  })

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).toHaveURL('/terms')
  })

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveURL('/privacy')
  })

  test('blog page loads', async ({ page }) => {
    await page.goto('/blog')
    await expect(page).toHaveURL('/blog')
  })

  test('help center loads', async ({ page }) => {
    await page.goto('/help')
    await expect(page).toHaveURL('/help')
  })

  test('about page loads', async ({ page }) => {
    await page.goto('/about')
    await expect(page).toHaveURL('/about')
  })

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact')
    await expect(page).toHaveURL('/contact')
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await expect(page.locator('body')).toBeVisible()
  })
})
```

**2. Auth Flow (`e2e/@system/02-auth.spec.ts`)**

Tests authentication workflows:

```ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('user can register', async ({ page }) => {
    await page.goto('/register')

    await page.fill('[name="email"]', 'newuser@example.com')
    await page.fill('[name="password"]', 'TestPassword123')
    await page.fill('[name="name"]', 'New User')
    await page.click('button[type="submit"]')

    // Should redirect to onboarding or dashboard
    await page.waitForURL(/\/(onboarding|app)/, { timeout: 5000 })
    expect(page.url()).toMatch(/\/(onboarding|app)/)
  })

  test('user can login', async ({ page }) => {
    await page.goto('/auth')

    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'TestPassword123')
    await page.click('button[type="submit"]')

    // Should redirect to /app
    await page.waitForURL('/app', { timeout: 5000 })
    expect(page.url()).toContain('/app')
  })

  test('unauthenticated user redirected from protected route', async ({ page }) => {
    await page.goto('/app/settings')

    // Should redirect to /auth
    await page.waitForURL('/auth', { timeout: 5000 })
    expect(page.url()).toContain('/auth')
  })

  test('user can logout', async ({ page, context }) => {
    // Login first
    await page.goto('/auth')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'TestPassword123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/app')

    // Logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')

    // Should redirect to /
    await page.waitForURL('/', { timeout: 5000 })
    expect(page.url()).toBe(page.url().replace(/\/app.*/, '/'))
  })

  test('password reset flow works', async ({ page }) => {
    await page.goto('/forgot-password')

    await page.fill('[name="email"]', 'test@example.com')
    await page.click('button[type="submit"]')

    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible()
  })
})
```

**3. Navigation (`e2e/@system/03-navigation.spec.ts`)**

Tests client-side routing:

```ts
import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('clicking nav links works', async ({ page }) => {
    await page.goto('/')

    // Click pricing link
    await page.click('a[href="/pricing"]')
    await expect(page).toHaveURL('/pricing')

    // Click blog link
    await page.click('a[href="/blog"]')
    await expect(page).toHaveURL('/blog')
  })

  test('/login redirects to /auth', async ({ page }) => {
    await page.goto('/login')
    await page.waitForURL('/auth', { timeout: 5000 })
    expect(page.url()).toContain('/auth')
  })

  test('/dashboard redirects to /app', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/(app|auth)/, { timeout: 5000 })
    // Either /app (if logged in) or /auth (if not)
    expect(page.url()).toMatch(/\/(app|auth)/)
  })
})
```

**4. Accessibility (`e2e/@system/04-accessibility.spec.ts`)**

Basic accessibility checks:

```ts
import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
  test('landing page has page title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Product Template/)
  })

  test('auth page has heading', async ({ page }) => {
    await page.goto('/auth')
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
  })

  test('buttons have accessible labels', async ({ page }) => {
    await page.goto('/')
    const buttons = page.locator('button')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      const text = await button.textContent()
      const ariaLabel = await button.getAttribute('aria-label')
      expect(text || ariaLabel).toBeTruthy()
    }
  })

  test('images have alt text', async ({ page }) => {
    await page.goto('/')
    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      expect(alt).toBeDefined()
    }
  })
})
```

### Running E2E Tests

```bash
# From project root

# Start dev servers first:
# Terminal 1: cd client && npm run dev
# Terminal 2: cd server && npm run dev

# Then run tests:

# Headless (CI mode)
npm run test:e2e

# With browser UI (interactive debugging)
npm run test:e2e:ui

# Headed (visible browser)
npm run test:e2e:headed

# View last test report
npm run test:e2e:report
```

### E2E Test Best Practices

1. **Use data-testid attributes** — `<button data-testid="login-button">` for stable selectors
2. **Avoid flaky waits** — Use Playwright's auto-waiting, not `setTimeout`
3. **Test user flows, not implementation** — Test what users do, not how code works
4. **Run against production build** — E2E tests should validate production behavior
5. **Parallelize when possible** — Playwright runs tests in parallel by default

---

## Test Coverage Goals

### Target Coverage

| Layer | Coverage Goal | Current |
|-------|---------------|---------|
| **Backend** | 80% | TBD |
| **Frontend** | 70% | TBD |
| **E2E (critical paths)** | 100% | ✅ |

### Measuring Coverage

**Backend:**

```bash
cd server
npm test -- --coverage
```

**Frontend:**

```bash
cd client
npm run test:coverage
```

### Coverage Exceptions

**Not required for 100% coverage:**

- Error handling branches for impossible cases
- Development-only code (debugging logs)
- Third-party library wrappers (Stripe SDK, SES SDK)

---

## Performance Testing

### Goals

- **API latency:** < 200ms (p50), < 500ms (p95)
- **Page load:** < 2s (First Contentful Paint)
- **Database queries:** < 50ms (p95)

### Tools

- **Lighthouse CI** — Frontend performance audits
- **k6** — Load testing (API endpoints)
- **pg-stat-statements** — PostgreSQL query profiling

### Example: k6 Load Test

```js
// scripts/load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '10s', target: 0 },   // Ramp down
  ],
}

export default function () {
  const res = http.get('http://localhost:3000/api/sessions/me')
  check(res, { 'status is 200': (r) => r.status === 200 })
  sleep(1)
}
```

**Running:**

```bash
k6 run scripts/load-test.js
```

---

## Security Testing

### Automated Scans

1. **npm audit** — Dependency vulnerabilities
2. **Snyk** — Security scanning (optional)
3. **GitHub Dependabot** — Automated PR for CVEs

### Manual Security Testing

**Checklist:**

- [ ] SQL injection attempts (parameterized queries protect)
- [ ] XSS attempts (HTTP-only cookies, CSP headers)
- [ ] CSRF attacks (SameSite cookies)
- [ ] JWT manipulation (RS256 signature verification)
- [ ] Rate limiting bypass attempts
- [ ] Unauthorized access to admin endpoints

### Example: SQL Injection Test

```js
// server/test/security/sql-injection.test.js
const request = require('supertest')
const { createApp } = require('../../src/app')

describe('SQL Injection Protection', () => {
  let app

  beforeAll(() => {
    app = createApp()
  })

  test('rejects SQL injection in email field', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ email: "' OR '1'='1", password: 'test' })

    expect(res.status).toBe(401) // Invalid credentials (not SQL error)
  })

  test('rejects SQL injection in search query', async () => {
    const res = await request(app)
      .get('/api/users?search=test\'; DROP TABLE users; --')
      .set('Cookie', 'token=valid-admin-jwt')

    expect(res.status).not.toBe(500) // Should not crash server
  })
})
```

### OWASP Top 10 Coverage

| Vulnerability | Protection |
|---------------|------------|
| **A01: Broken Access Control** | Role-based auth middleware (`requireRole`) |
| **A02: Cryptographic Failures** | AES-256 for sensitive data, RS256 for JWT |
| **A03: Injection** | Parameterized queries (pg-promise) |
| **A04: Insecure Design** | Auth guards on routes, rate limiting |
| **A05: Security Misconfiguration** | Secure defaults (HTTP-only, SameSite cookies) |
| **A06: Vulnerable Components** | npm audit, Dependabot |
| **A07: Authentication Failures** | bcrypt, rate limiting, JWT expiry |
| **A08: Data Integrity Failures** | JWT signature verification |
| **A09: Logging Failures** | Activity logs table |
| **A10: Server-Side Request Forgery** | Input validation, allowlists |

---

## Accessibility Testing

### Standards

- **WCAG 2.1 AA** compliance target

### Manual Checks

- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Screen reader announces content correctly
- [ ] Color contrast meets 4.5:1 minimum
- [ ] Focus indicators visible
- [ ] Forms have labels
- [ ] Images have alt text

### Automated Tools

- **axe-core** — Accessibility linting (Playwright plugin)
- **Lighthouse** — Accessibility score

### Example: Playwright Accessibility Test

```ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('landing page has no accessibility violations', async ({ page }) => {
  await page.goto('/')

  const results = await new AxeBuilder({ page }).analyze()

  expect(results.violations).toEqual([])
})
```

---

## Cross-Browser Testing

### Browsers

- **Chromium** (Chrome, Edge)
- **Firefox**
- **WebKit** (Safari)
- **Mobile Chrome** (Android)
- **Mobile Safari** (iOS)

### Playwright Config

```js
// playwright.config.js
module.exports = {
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
    {
      name: 'Mobile Chrome',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 12'],
      },
    },
  ],
}
```

**Run cross-browser tests:**

```bash
npm run test:e2e -- --project=chromium --project=firefox --project=webkit
```

---

## Manual Testing Checklist

Before releasing a template update, manually verify:

### Registration Flow

- [ ] User can register with valid email/password
- [ ] Weak passwords rejected (< 8 chars, no uppercase/digit)
- [ ] Duplicate email rejected
- [ ] Verification email sent (check inbox)
- [ ] Verification link works
- [ ] User redirected to onboarding/dashboard after registration

### Login Flow

- [ ] User can login with correct credentials
- [ ] Wrong password rejected
- [ ] Rate limiting triggers after 5 failed attempts
- [ ] JWT cookie set correctly
- [ ] User data returned in response

### Protected Routes

- [ ] Unauthenticated user redirected to `/auth`
- [ ] Authenticated user can access `/app/*`
- [ ] Admin-only routes block non-admin users
- [ ] Logout clears session

### Password Reset

- [ ] User can request password reset
- [ ] Reset email sent (check inbox)
- [ ] Reset link works
- [ ] New password accepted
- [ ] User can login with new password

### Subscription Flow

- [ ] User can view pricing plans
- [ ] Stripe checkout opens
- [ ] Payment succeeds (use test card `4242 4242 4242 4242`)
- [ ] Webhook received and processed
- [ ] Subscription active in database
- [ ] User can access Pro features

### Admin Panel

- [ ] Admin can view user list
- [ ] Admin can change user roles
- [ ] Admin can view dashboard stats
- [ ] Non-admin cannot access admin routes

---

## CI/CD Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 20

      # Backend tests
      - name: Install server dependencies
        run: cd server && npm install

      - name: Run unit tests
        run: cd server && npm test -- --testPathPattern=test/unit

      - name: Run integration tests
        run: cd server && npm test -- --testPathPattern=test/api
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      # Frontend tests
      - name: Install client dependencies
        run: cd client && npm install

      - name: Run client tests
        run: cd client && npm run test:run

      # E2E tests
      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Start servers
        run: |
          cd server && npm run dev &
          cd client && npm run dev &
          sleep 10

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Bug Tracking

### Severity Classification

| Severity | Definition | Examples | SLA |
|----------|------------|----------|-----|
| **P0 (Critical)** | Broken critical path | Login broken, database down, data loss | Fix within 24h |
| **P1 (High)** | Major feature broken | Billing fails, email not sent | Fix within 1 week |
| **P2 (Medium)** | Minor feature broken | Broken link, styling issue | Fix within 1 month |
| **P3 (Low)** | Cosmetic issue | Typo, minor UI glitch | Backlog |

### Bug Report Template

```markdown
## Bug Report

**Severity:** P1

**Description:**
User cannot reset password — "Reset link expired" error even with fresh link.

**Steps to Reproduce:**
1. Go to `/forgot-password`
2. Enter email
3. Click reset link in email
4. See error

**Expected Behavior:**
Reset form should load.

**Actual Behavior:**
"Reset link expired" error shown.

**Environment:**
- Browser: Chrome 120
- OS: macOS 14
- Template version: v1.2.0

**Screenshots:**
[Attach screenshot]

**Logs:**
```
Server error: TokenExpiredError: jwt expired
```

**Proposed Fix:**
Increase reset token expiry from 15min to 1h.
```

---

## Quality Metrics

### Key Metrics

1. **Test coverage:** 80% backend, 70% frontend
2. **E2E pass rate:** 100% (critical paths)
3. **Build success rate:** > 95%
4. **Deployment success rate:** > 99%
5. **Mean time to recovery (MTTR):** < 2 hours

### Monitoring

- **CI/CD dashboard** — GitHub Actions pass/fail rates
- **Error tracking** — Sentry for production errors
- **Uptime** — UptimeRobot (99.9% target)

---

## Continuous Improvement

### Monthly QA Review

**Agenda:**

1. Review test coverage (identify gaps)
2. Analyze flaky tests (fix or delete)
3. Review production incidents (add regression tests)
4. Update test suite for new features
5. Security audit (npm audit, manual review)

### Automation Goals

- [ ] Visual regression testing (Playwright screenshots)
- [ ] Mutation testing (Stryker for coverage quality)
- [ ] Chaos engineering (random failures in staging)
- [ ] Load testing in CI (k6 against staging)

---

## Conclusion

The Product Template's quality assurance strategy balances:

- **Speed** — Fast unit tests, efficient CI
- **Confidence** — Critical paths covered by E2E tests
- **Security** — Automated scans, manual audits
- **Accessibility** — WCAG compliance baked in

**Goal:** Every product built from this template inherits **production-grade quality** from day one.

---

**Questions?** See [README.md](../README.md) or [ARCHITECTURE.md](./ARCHITECTURE.md).

**Report bugs:** GitHub Issues with severity label.
