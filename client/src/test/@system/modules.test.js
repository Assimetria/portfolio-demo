// @system — feature-module resolver (client) + the two filters built on it.
//
// brand.json `modules` reaches the browser as the webpack `__MODULES__`
// constant; Jest defines it as {} (jest.config.js globals) so the resolved map
// is the all-enabled default. resolveModules() is pure and is exercised with
// explicit inputs here.

import {
  MODULE_KEYS,
  MODULE_DEFAULTS,
  modules,
  resolveModules,
  isModuleEnabled,
  filterByModules,
} from '@/config/@system/modules'
import { filterRoutesByModules } from '@/app/routes/@system/utils'
import { filterPagesByModules, mergePages } from '@/app/config/@system/navigation-merge'
import { systemPages } from '@/app/config/@system/navigation-defaults'

describe('resolveModules', () => {
  it('defaults every module to true when the block is missing or malformed', () => {
    for (const raw of [undefined, null, {}, [], 'x', 42]) {
      expect(resolveModules(raw)).toEqual(MODULE_DEFAULTS)
    }
    for (const key of MODULE_KEYS) expect(MODULE_DEFAULTS[key]).toBe(true)
  })

  it('honours explicit false, coerces "true"/"false" strings, ignores garbage', () => {
    const map = resolveModules({ billing: false, teams: 'false', ai: 'true', usage: 'maybe', newsletter: false })
    expect(map.billing).toBe(false)
    expect(map.teams).toBe(false)
    expect(map.ai).toBe(true)
    expect(map.usage).toBe(true)
    expect(map.selfRegistration).toBe(true)
    expect(map.newsletter).toBe(false)
  })

  it('the Jest build (__MODULES__ = {}) resolves to the defaults', () => {
    expect(modules).toEqual(MODULE_DEFAULTS)
    expect(isModuleEnabled('billing')).toBe(true)
    expect(isModuleEnabled('unknown-module')).toBe(true)
  })
})

describe('isModuleEnabled / filterByModules with an explicit map', () => {
  const off = { ...MODULE_DEFAULTS, billing: false, teams: false }
  const isOn = (k) => isModuleEnabled(k, off)

  it('treats only explicit false as disabled', () => {
    expect(isOn('billing')).toBe(false)
    expect(isOn('teams')).toBe(false)
    expect(isOn('blog')).toBe(true)
    expect(isOn('not-a-module')).toBe(true)
  })

  it('filterByModules keeps untagged entries and drops disabled ones', () => {
    const entries = [
      { id: 'profile' },
      { id: 'billing', module: 'billing' },
      { id: 'invite', module: 'teams' },
      { id: 'keys', module: 'apiKeys' },
    ]
    expect(filterByModules(entries, isOn).map((e) => e.id)).toEqual(['profile', 'keys'])
  })
})

describe('filterRoutesByModules', () => {
  it('drops tagged routes when their module is off and keeps the rest in order', () => {
    const routes = [
      { path: '/' },
      { path: '/pricing', module: 'billing' },
      { path: '/app/teams', module: 'teams' },
      { path: '/app/settings' },
      { path: '*' },
    ]
    const off = (k) => !['billing', 'teams'].includes(k)
    expect(filterRoutesByModules(routes, off).map((r) => r.path)).toEqual(['/', '/app/settings', '*'])
    expect(filterRoutesByModules(routes, () => true)).toEqual(routes)
  })
})

describe('filterPagesByModules', () => {
  it('hides the Billing sidebar entry when billing is off and filters tagged children', () => {
    const pages = mergePages(systemPages, [
      { path: '/app/tools', label: 'Tools', icon: 'Wrench', sidebar: true, children: [
        { path: '/app/tools/keys', label: 'Keys', module: 'apiKeys' },
        { path: '/app/tools/other', label: 'Other' },
      ] },
    ])
    const off = (k) => !['billing', 'apiKeys'].includes(k)
    const visible = filterPagesByModules(pages, off)
    expect(visible.some((p) => p.path === '/app/billing')).toBe(false)
    expect(visible.some((p) => p.path === '/app/contact')).toBe(true)
    expect(visible.find((p) => p.path === '/app/tools').children.map((c) => c.path)).toEqual(['/app/tools/other'])
  })

  it('is a no-op when every module is on', () => {
    expect(filterPagesByModules(systemPages, () => true)).toEqual(systemPages)
    expect(systemPages.find((p) => p.path === '/app/billing').module).toBe('billing')
  })
})
