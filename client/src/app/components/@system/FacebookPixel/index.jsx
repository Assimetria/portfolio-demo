// @system — Facebook Pixel client-side integration
// Mirrors Asymetric Ventures' react-facebook-pixel usage.
// Set VITE_FACEBOOK_PIXEL in client .env to enable.
// Renders nothing — just initializes pixel and tracks page views.
// trackEvent / trackCustomEvent live in lib/@system/facebookPixel.js.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PIXEL_ID = import.meta.env.VITE_FACEBOOK_PIXEL

function initPixel() {
  if (!PIXEL_ID || window.__fb_pixel_initialized) return
  window.__fb_pixel_initialized = true

  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', PIXEL_ID)
  window.fbq('track', 'PageView')

  // Capture fbclid for attribution
  const params = new URLSearchParams(window.location.search)
  const fbclid = params.get('fbclid')
  if (fbclid) {
    try { sessionStorage.setItem('_fbclid', fbclid) } catch {}
  }
}

export default function FacebookPixel() {
  const location = useLocation()

  useEffect(() => {
    initPixel()
  }, [])

  useEffect(() => {
    if (window.fbq) window.fbq('track', 'PageView')
  }, [location])

  return null
}
