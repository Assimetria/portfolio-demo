// @system — Cloudflare Turnstile widget (explicit render).
//
// Rendered by ContactForm only when GET /api/contact/config reports a site
// key, i.e. when the server will actually verify the token. The script is
// loaded lazily on first mount (one <script> per page, shared across
// instances) so pages without a form never pay for it.
//
// CSP: brand.json securityHeaders.contentSecurityPolicy needs
//   scriptSrc  += https://challenges.cloudflare.com
//   frameSrc   += https://challenges.cloudflare.com
//
// Docs: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
import { useEffect, useRef } from 'react'

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise = null

/** Load the Turnstile API once; resolves with window.turnstile. */
export function loadTurnstile(doc = document) {
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = doc.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`)
    const script = existing || doc.createElement('script')
    const done = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile failed to initialise')))
    script.addEventListener('load', done, { once: true })
    script.addEventListener('error', () => reject(new Error('Turnstile script failed to load')), { once: true })
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL
      script.async = true
      script.defer = true
      doc.head.appendChild(script)
    }
  }).catch((err) => {
    scriptPromise = null // allow a retry on the next mount
    throw err
  })
  return scriptPromise
}

/** Test hook: forget the cached script promise. */
export function __resetTurnstileLoader() {
  scriptPromise = null
}

/**
 * @param {object} props
 * @param {string}   props.siteKey
 * @param {(token: string) => void} props.onToken   called with a fresh token (or '' when it expires / errors)
 * @param {'light'|'dark'|'auto'} [props.theme]
 * @param {string}   [props.className]
 */
export function TurnstileWidget({ siteKey, onToken, theme = 'auto', className }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined
    let cancelled = false

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onTokenRef.current?.(token),
          'expired-callback': () => onTokenRef.current?.(''),
          'error-callback': () => onTokenRef.current?.(''),
        })
      })
      .catch(() => {
        // Script blocked (CSP / adblock) — leave the token empty; the server
        // will reject with a clear message rather than the form hanging.
        onTokenRef.current?.('')
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current != null && typeof window !== 'undefined' && window.turnstile?.remove) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* already gone */ }
      }
      widgetIdRef.current = null
    }
  }, [siteKey, theme])

  if (!siteKey) return null
  return <div ref={containerRef} data-testid="turnstile-widget" className={className} />
}

export default TurnstileWidget
