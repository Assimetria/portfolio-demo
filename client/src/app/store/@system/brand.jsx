// @system — BrandProvider: runtime brand token injection
// Reads brand config from info (brand.json → @custom/info.js) and derives
// all CSS custom properties dynamically. When the user's brand choice changes
// (e.g. via admin brand settings API), re-derives the full token set.
//
// Token derivation matches scripts/apply-brand.js so build-time and runtime
// produce identical results. The provider injects a <style> element into <head>.

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { info } from '@/config'
import { hexToHsl } from '@/app/lib/@system/utils'

const BrandContext = createContext(null)

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '')
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]
  const n = parseInt(hex, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: Math.round(h * 3600) / 10, s: Math.round(s * 1000) / 10, l: Math.round(l * 1000) / 10 }
}

function hslToRgb({ h, s, l }) {
  h /= 360; s /= 100; l /= 100
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v } }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  }
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')
}

function darken(hex, amount) {
  const hsl = rgbToHsl(hexToRgb(hex))
  hsl.l = Math.max(0, hsl.l - amount)
  return rgbToHex(hslToRgb(hsl))
}

function lighten(hex, amount) {
  const hsl = rgbToHsl(hexToRgb(hex))
  hsl.l = Math.min(100, hsl.l + amount)
  return rgbToHex(hslToRgb(hsl))
}

function deriveTokens(primary, accent) {
  const p = primary || '#64748B'
  const a = accent || '#94A3B8'
  const pHsl = hexToHsl(p)

  return {
    '--brand-primary': p,
    '--brand-primary-hover': darken(p, 10),
    '--brand-accent': a,
    '--brand-accent-hover': darken(a, 10),
    '--primary': pHsl,
    '--ring': pHsl,
    '--brand-primary-rgb': (() => { const rgb = hexToRgb(p); return `${rgb.r}, ${rgb.g}, ${rgb.b}` })(),
  }
}

function buildStyleContent(tokens) {
  const entries = Object.entries(tokens).map(([k, v]) => `${k}: ${v}`).join('; ')
  return `:root { ${entries} } [data-theme="dark"] { ${entries} }`
}

export function BrandProvider({ children, brandColor, accentColor }) {
  const primary = brandColor || info.brandColor || '#64748B'
  const accent = accentColor || info.accentColor || '#94A3B8'

  const tokens = useMemo(() => deriveTokens(primary, accent), [primary, accent])

  useEffect(() => {
    let style = document.getElementById('brand-runtime-tokens')
    if (!style) {
      style = document.createElement('style')
      style.id = 'brand-runtime-tokens'
      document.head.appendChild(style)
    }
    style.textContent = buildStyleContent(tokens)
    return () => { if (style.parentNode) style.parentNode.removeChild(style) }
  }, [tokens])

  const value = useMemo(() => ({
    primaryColor: primary,
    accentColor: accent,
    tokens,
  }), [primary, accent, tokens])

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export function useBrand() {
  const ctx = useContext(BrandContext)
  if (!ctx) throw new Error('useBrand must be used inside <BrandProvider>')
  return ctx
}

export default { BrandProvider, useBrand }
