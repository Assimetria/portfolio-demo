// @system — Facebook Pixel event helpers (kept out of the <FacebookPixel />
// component module so React Fast Refresh can hot-swap the component).
export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || !window.fbq) return
  let fbclid = null
  try { fbclid = sessionStorage.getItem('_fbclid') } catch { /* storage unavailable */ }
  if (fbclid) params.fbclid = fbclid
  window.fbq('track', eventName, params)
}

export function trackCustomEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || !window.fbq) return
  window.fbq('trackCustom', eventName, params)
}
