// @system — GA4 / GTM event helpers (kept out of the <Analytics /> component
// module so React Fast Refresh can hot-swap the component).
// Set VITE_GA_MEASUREMENT_ID / VITE_GTM_ID in client .env to enable tracking.
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined') return
  if (window.gtag) window.gtag('event', eventName, params)
  if (window.dataLayer) window.dataLayer.push({ event: eventName, ...params })
}

export function trackPageView(path) {
  if (typeof window === 'undefined') return
  if (window.gtag && GA_MEASUREMENT_ID) {
    window.gtag('config', GA_MEASUREMENT_ID, { page_path: path })
  }
}
