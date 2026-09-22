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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
