// @system — Cloudflare Turnstile server-side verification.
//
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// The client widget yields a one-time token; we POST it (plus the visitor IP)
// to siteverify and trust the `success` flag. Network/5xx failures are
// reported as `{ ok: false, reason: 'unavailable' }` so the router can decide
// how to degrade (we fail closed: a spam gate that silently opens under load
// is not a gate).

const logger = require('../../../lib/@system/Logger')

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

/**
 * @param {string} token   `cf-turnstile-response` value from the client
 * @param {object} opts
 * @param {string} opts.secretKey
 * @param {string} [opts.remoteIp]
 * @param {typeof fetch} [opts.fetchImpl] injected for tests
 * @returns {Promise<{ ok: boolean, reason?: string, errorCodes?: string[] }>}
 */
async function verifyTurnstile(token, { secretKey, remoteIp, fetchImpl = globalThis.fetch } = {}) {
  if (!secretKey) return { ok: false, reason: 'not_configured' }
  if (typeof token !== 'string' || !token.trim()) return { ok: false, reason: 'missing_token' }

  const body = new URLSearchParams({ secret: secretKey, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null

  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller ? controller.signal : undefined,
    })
    if (!res.ok) {
      logger.warn({ status: res.status }, '[contact] turnstile siteverify returned non-2xx')
      return { ok: false, reason: 'unavailable' }
    }
    const data = await res.json()
    if (data && data.success === true) return { ok: true }
    return { ok: false, reason: 'invalid', errorCodes: Array.isArray(data?.['error-codes']) ? data['error-codes'] : [] }
  } catch (err) {
    logger.warn({ err: err.message }, '[contact] turnstile siteverify request failed')
    return { ok: false, reason: 'unavailable' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

module.exports = { verifyTurnstile, SITEVERIFY_URL }
