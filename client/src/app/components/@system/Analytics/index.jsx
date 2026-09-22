// @system — Google Analytics & Google Tag Manager integration
// Mirrors Asymetric Ventures' GA4/GTM setup.
// Set VITE_GA_MEASUREMENT_ID and/or VITE_GTM_ID in client .env to enable.
// Renders nothing — just initializes tracking scripts.
// trackEvent / trackPageView live in lib/@system/analytics.js.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '@/app/lib/@system/analytics'

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const GTM_ID = import.meta.env.VITE_GTM_ID

function initGA() {
  if (!GA_MEASUREMENT_ID || window.__ga_initialized) return
  window.__ga_initialized = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })
}

function initGTM() {
  if (!GTM_ID || window.__gtm_initialized) return
  window.__gtm_initialized = true

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
  document.head.appendChild(script)
}

export default function Analytics() {
  const location = useLocation()

  useEffect(() => {
    initGA()
    initGTM()
  }, [])

  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location])

  return null
}
