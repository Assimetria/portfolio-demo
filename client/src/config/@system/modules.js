// @system — feature-module resolver (client side)
//
// Mirror of server/src/lib/@system/Helpers/modules.js. brand.json `modules`
// is the single switch for the optional product surface (billing, teams,
// self-registration, API keys, web3, AI, usage, onboarding, blog, webhooks).
//
// How the value reaches the browser: client/webpack.config.mjs reads
// brand.json at build time and defines the `__MODULES__` constant
// (DefinePlugin) with the raw `modules` block. Jest defines the same global
// as `{}` (jest.config.js → globals), so tests see the defaults.
//
// Every module DEFAULTS TO TRUE when its key is absent — a brand.json without
// a `modules` block (the SaaS template) keeps the full surface.
//
// Usage:
//   import { isModuleEnabled, modules } from '@/config/@system/modules'
//   if (isModuleEnabled('billing')) ...
// Route/nav entries carry a `module: 'billing'` field and are filtered with
// filterRoutesByModules() / filterPagesByModules().

export const MODULE_KEYS = Object.freeze([
  'billing',
  'teams',
  'selfRegistration',
  'apiKeys',
  'web3',
  'ai',
  'usage',
  'onboarding',
  'blog',
  'webhooks',
])

export const MODULE_DEFAULTS = Object.freeze(Object.fromEntries(MODULE_KEYS.map((k) => [k, true])))

/** Normalise a raw brand.json `modules` block onto the defaults. */
export function resolveModules(raw) {
  const out = { ...MODULE_DEFAULTS }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') out[key] = value
    else if (value === 'true' || value === 'false') out[key] = value === 'true'
    else if (!(key in out)) out[key] = true
  }
  return out
}

// `__MODULES__` is injected by webpack DefinePlugin (and by Jest globals;
// declared as a readonly global in eslint.config.mjs). The typeof guard keeps
// the module loadable in any other runtime.
const injected = typeof __MODULES__ !== 'undefined' ? __MODULES__ : {}

/** Resolved module map for this build. */
export const modules = Object.freeze(resolveModules(injected))

/** `true` unless the module is explicitly switched off. Unknown keys are enabled. */
export function isModuleEnabled(key, map = modules) {
  return map[key] !== false
}

/**
 * Keep only entries whose optional `module` field is enabled. Works for route
 * definitions, navigation PageEntry objects, link tables — anything with an
 * optional `module: '<key>'` field.
 */
export function filterByModules(entries, isEnabled = isModuleEnabled) {
  return entries.filter((e) => !e?.module || isEnabled(e.module))
}
