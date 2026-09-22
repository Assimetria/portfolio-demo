import { test, expect } from '@playwright/test'

/**
 * @system Retention endpoints
 *
 * Smoke-level E2E for the audit-log retention API added to close the retention
 * utility gap:
 *   GET  /api/retention          — read the active audit-log retention policy
 *   POST /api/retention/cleanup  — admin-triggered purge of expired rows
 *
 * These assertions intentionally exercise the *unauthenticated* paths only:
 * they run fully before any DB/Redis work happens, so the suite is cheap and
 * deterministic. The authenticated/authorised 200/403 behaviour is covered in
 * depth by the supertest suite at server/test/api/@system/retention.test.js.
 */

test.describe('retention policy endpoint (unauthenticated)', () => {
  test('GET /api/retention requires authentication (401)', async ({ request }) => {
    const res = await request.get('/api/retention')
    expect(res.status()).toBe(401)
  })

  test('GET /api/retention never leaks the policy without auth', async ({ request }) => {
    const res = await request.get('/api/retention')
    const body = await res.json().catch(() => ({}))
    expect(body.retention).toBeUndefined()
  })

  test('POST /api/retention/cleanup is rejected without a session (401/403)', async ({ request }) => {
    const res = await request.post('/api/retention/cleanup', {
      data: { days: 30 },
    })
    // 401 from auth, or 403 when CSRF protection rejects the cross-site POST
    // before auth runs — either way the purge never executes unauthenticated.
    expect([401, 403]).toContain(res.status())
    const body = await res.json().catch(() => ({}))
    expect(body.deleted).toBeUndefined()
  })
})
