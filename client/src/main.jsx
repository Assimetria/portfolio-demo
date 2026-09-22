import React from 'react'
import ReactDOM from 'react-dom/client'
import { validateEnv } from '@/app/lib/@system/env'
import { initSentry } from '@/app/lib/@system/sentry'
import { info } from '@/config'
import { applyBrandColors, applyDefaultTheme } from '@/app/lib/@system/brandPrePaint'
import App from './App'
import './index.css'

validateEnv()
initSentry()

// @system — Apply brand colors + default theme from config to CSS custom
// properties BEFORE first paint (no default flash). Logic lives in
// @system/brandPrePaint so it can be unit tested deterministically; products set
// brandColor / accentColor / defaultTheme in @custom/info.js.
applyBrandColors(info)
applyDefaultTheme(info)

// @system — Expose CDN URL for auth page static assets so the app can
// reference them without relying solely on the server origin. The value
// comes from the root .config/info.js (`cdn.url` / `cdn.authAssetsUrl`)
// and the server env vars (CDN_URL / AUTH_CDN_URL). When set, auth page
// JS/CSS/images may be served from the CDN domain for faster load times.
// This is also set on window.__AUTH_CDN_URL by the server spaFallback when
// AUTH_CDN_URL is configured; the client-side fallback reads from info.cdn.
window.__CDN_URL = info.cdn?.url || process.env.CDN_URL || ''
window.__AUTH_CDN_URL = info.cdn?.authAssetsUrl || process.env.AUTH_CDN_URL || window.__CDN_URL

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
