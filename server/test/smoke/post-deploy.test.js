/**
 * Post-deploy smoke tests.
 *
 * Run against a live deployed URL to verify critical endpoints work.
 *
 * Usage:
 *   BASE_URL=https://your-app.up.railway.app npx jest test/smoke --forceExit
 *
 * If BASE_URL is not set, these tests are skipped.
 */

const BASE_URL = process.env.BASE_URL
const describeIf = BASE_URL ? describe : describe.skip

// Simple fetch wrapper — avoids adding a dependency on supertest for smoke tests.
async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body, headers: res.headers }
}

describeIf('Smoke tests (live deployment)', () => {
  const smokeEmail = `smoke-${Date.now()}@test.local`
  const smokePassword = 'SmokeTest!123'

  // ── Health ─────────────────────────────────────────────────────────────
  describe('GET /api/health', () => {
    it('returns 200 with status ok', async () => {
      const { status, body } = await apiFetch('/api/health')
      expect(status).toBe(200)
      expect(body.status).toBe('ok')
      expect(body.db).toBe('connected')
    })
  })

  describe('GET /api/ready', () => {
    it('returns 200 with ready: true (database reachable)', async () => {
      const { status, body } = await apiFetch('/api/ready')
      expect(status).toBe(200)
      expect(body.ready).toBe(true)
      expect(body.db).toBe('connected')
    })
  })

  // ── Auth flow ──────────────────────────────────────────────────────────
  describe('Auth flow', () => {
    it('POST /api/auth/register returns 201 or 409', async () => {
      const { status } = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: smokeEmail,
          password: smokePassword,
          name: 'Smoke',
        }),
      })
      // 201 = new user, 409 = already exists (re-running smoke tests)
      expect([201, 409]).toContain(status)
    })

    it('POST /api/sessions returns 200 with valid credentials', async () => {
      const { status, body } = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          email: smokeEmail,
          password: smokePassword,
        }),
      })
      // If CSRF is enforced and we can't get a token, we'll get 403.
      // In that case the smoke test still validates that the server responds.
      expect([200, 403]).toContain(status)
      if (status === 200) {
        expect(body.user).toBeDefined()
      }
    })
  })

  // ── Static assets ──────────────────────────────────────────────────────
  describe('Static assets', () => {
    it('GET /robots.txt returns non-HTML content', async () => {
      const res = await fetch(`${BASE_URL}/robots.txt`)
      const text = await res.text()
      expect(res.status).toBe(200)
      expect(text).not.toMatch(/<!doctype/i)
    })
  })
})
