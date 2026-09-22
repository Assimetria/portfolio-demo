// @system — Per-page copy/content resolver (@custom → @system fallback).
//
// Products override page copy by editing content/@custom/<page>.js (never the
// @system defaults, which are overwritten during template sync). The resolver is
// SYNCHRONOUS: both module sets are statically imported below, so a page's very
// first paint already shows the merged copy — no async flash, no empty object.
//
//   import { useContent } from '@/app/hooks/@system/useContent'
//   import { copyText } from '@/app/lib/@system/content'
//   const content = useContent('landing')
//   const title = copyText(content, 'heroTitle', info.tagline)
//
// Precedence used by LandingPage / AuthPage / PricingPage per field:
//   config text (@/config text.<page>.*)  →  content/@custom  →  content/@system  →  literal
//
// Registering a new page: add content/@system/<page>.js (non-empty strings),
// content/@custom/<page>.js (export default {}) and an entry in REGISTRY.
import landingSystem from '@/app/content/@system/landing'
import authSystem from '@/app/content/@system/auth'
import pricingSystem from '@/app/content/@system/pricing'

import landingCustom from '@/app/content/@custom/landing'
import authCustom from '@/app/content/@custom/auth'
import pricingCustom from '@/app/content/@custom/pricing'

const REGISTRY = {
  auth: { system: authSystem, custom: authCustom },
  landing: { system: landingSystem, custom: landingCustom },
  pricing: { system: pricingSystem, custom: pricingCustom },
}

/** Page keys that take part in the @custom → @system chain. */
export const CONTENT_PAGE_KEYS = Object.freeze(Object.keys(REGISTRY))

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** True when `key` is a registered content page. */
export function isContentPage(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(REGISTRY, key)
}

/**
 * Merge @custom over @system. @custom wins on any shared key; @system keys the
 * product did not touch and @custom-only keys are both preserved. `undefined`
 * values in @custom are ignored (they cannot blank a default). Blank strings
 * are kept here and rejected by copyText(), which is the last seam before render.
 */
export function mergeContent(system, custom) {
  const merged = isPlainObject(system) ? { ...system } : {}
  if (isPlainObject(custom)) {
    for (const [key, value] of Object.entries(custom)) {
      if (value !== undefined) merged[key] = value
    }
  }
  return merged
}

/** Fresh copy of the @system default module for `key` ({} for unknown keys). */
export function systemDefaultFor(key) {
  return isContentPage(key) ? { ...REGISTRY[key].system } : {}
}

/** Merged @custom-over-@system copy for `key` ({} for unknown keys). */
export function resolveContent(key) {
  if (!isContentPage(key)) return {}
  const { system, custom } = REGISTRY[key]
  return mergeContent(system, custom)
}

/**
 * Read one string from resolved content with a literal fallback. Only a
 * non-blank string counts; whitespace-only, missing, null or non-string values
 * fall back so a hand-edited override can never blank a heading. Leading
 * whitespace is dropped, the rest of the value is returned untouched.
 */
export function copyText(content, key, fallback) {
  const value = content?.[key]
  if (typeof value === 'string' && value.trim().length > 0) return value.trimStart()
  return fallback
}

// ─── Backwards-compatible API ────────────────────────────────────────────────
// Older pages used an async loader + cache. Resolution is now synchronous, so
// these are thin wrappers kept so existing @custom code keeps compiling.

/** @deprecated use resolveContent(key) — kept for @custom callers. */
export async function loadContent(key) {
  return resolveContent(key)
}

/** @deprecated use resolveContent(key) — kept for @custom callers. */
export function getContent(key) {
  return resolveContent(key)
}

/** @deprecated no cache exists anymore — no-op kept for @custom callers. */
export function clearContentCache() {}
