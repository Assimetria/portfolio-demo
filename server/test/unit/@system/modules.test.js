/**
 * Unit tests — feature-module resolver (lib/@system/Helpers/modules.js).
 *
 * brand.json `modules` is the single switch for the SaaS surface on the
 * informational template. Contract pinned here:
 *   - every module defaults to true when absent (upstream SaaS behaviour)
 *   - brand.json false wins; MODULES_JSON env overrides brand.json
 *   - router / migration maps only name things that exist on disk
 *   - the repo brand.json ships every module off
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const modules = require('../../../src/lib/@system/Helpers/modules')

const ROOT = path.resolve(__dirname, '../../../..')

function writeTempBrand(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-modules-'))
  const file = path.join(dir, 'brand.json')
  fs.writeFileSync(file, JSON.stringify(obj))
  return file
}

describe('loadModules', () => {
  it('defaults every module to true when brand.json has no modules block', () => {
    const map = modules.loadModules(writeTempBrand({ companyName: 'X' }), {})
    for (const key of modules.MODULE_KEYS) expect(map[key]).toBe(true)
  })

  it('defaults to all-enabled when brand.json is missing or malformed', () => {
    expect(modules.loadModules('/nonexistent/brand.json', {})).toEqual(modules.MODULE_DEFAULTS)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-modules-'))
    const bad = path.join(dir, 'brand.json')
    fs.writeFileSync(bad, '{ not json')
    expect(modules.loadModules(bad, {})).toEqual(modules.MODULE_DEFAULTS)
  })

  it('honours explicit false values and keeps unspecified keys enabled', () => {
    const map = modules.loadModules(writeTempBrand({ modules: { billing: false, teams: false } }), {})
    expect(map.billing).toBe(false)
    expect(map.teams).toBe(false)
    expect(map.selfRegistration).toBe(true)
    expect(map.blog).toBe(true)
  })

  it('coerces "true"/"false" strings and ignores garbage values', () => {
    const map = modules.loadModules(
      writeTempBrand({ modules: { billing: 'false', teams: 'true', ai: 'maybe', usage: 0 } }),
      {},
    )
    expect(map.billing).toBe(false)
    expect(map.teams).toBe(true)
    expect(map.ai).toBe(true)
    expect(map.usage).toBe(true)
  })

  it('passes unknown module keys through so products can add their own', () => {
    const map = modules.loadModules(writeTempBrand({ modules: { newsletter: false } }), {})
    expect(map.newsletter).toBe(false)
    expect(modules.isEnabled('newsletter', map)).toBe(false)
    expect(modules.isEnabled('somethingElse', map)).toBe(true)
  })

  it('MODULES_JSON env overrides brand.json per key', () => {
    const file = writeTempBrand({ modules: { billing: false, teams: false } })
    const map = modules.loadModules(file, { MODULES_JSON: '{"billing":true}' })
    expect(map.billing).toBe(true)
    expect(map.teams).toBe(false)
  })

  it('ignores a malformed MODULES_JSON override', () => {
    const file = writeTempBrand({ modules: { billing: false } })
    expect(modules.loadModules(file, { MODULES_JSON: '{oops' }).billing).toBe(false)
    expect(modules.loadModules(file, { MODULES_JSON: '[1,2]' }).billing).toBe(false)
  })
})

describe('router map', () => {
  it('maps the SaaS routers to modules and leaves the always-on routers unmapped', () => {
    const off = { ...modules.MODULE_DEFAULTS, billing: false, teams: false, selfRegistration: false }
    for (const name of ['stripe', 'polar', 'payments', 'subscriptions']) {
      expect(modules.isRouterEnabled(name, off)).toBe(false)
    }
    expect(modules.isRouterEnabled('teams', off)).toBe(false)
    // selfRegistration is enforced inside the auth router, never by unmounting it
    for (const name of ['auth', 'sessions', 'user', 'contact', 'health', 'csrf', 'robots', 'sitemap', 'gdpr', 'email', 'notifications', 'storage']) {
      expect(modules.ROUTER_MODULES[name]).toBeUndefined()
      expect(modules.isRouterEnabled(name, off)).toBe(true)
    }
  })

  it('every mapped router exists under server/src/api/@system', () => {
    const apiDir = path.join(ROOT, 'server/src/api/@system')
    for (const name of Object.keys(modules.ROUTER_MODULES)) {
      const dir = path.join(apiDir, name)
      const exists = fs.existsSync(path.join(dir, 'index.js')) || fs.existsSync(path.join(dir, 'router.js')) || fs.existsSync(`${dir}.js`)
      expect({ name, exists }).toEqual({ name, exists: true })
    }
  })

  it('every mapped module key is a known module', () => {
    for (const key of Object.values(modules.ROUTER_MODULES)) expect(modules.MODULE_KEYS).toContain(key)
  })
})

describe('migration map', () => {
  it('skips mapped migrations when their module is off and always runs unknown files', () => {
    const off = { ...modules.MODULE_DEFAULTS, billing: false, teams: false }
    expect(modules.isMigrationEnabled('009_polar_subscriptions.js', off)).toBe(false)
    expect(modules.isMigrationEnabled('012_stripe_subscriptions', off)).toBe(false)
    expect(modules.isMigrationEnabled('022_teams.js', off)).toBe(false)
    expect(modules.isMigrationEnabled('001_init.js', off)).toBe(true)
    expect(modules.isMigrationEnabled('030_contact_submissions.js', off)).toBe(true)
    expect(modules.isMigrationEnabled('999_future_unknown.js', off)).toBe(true)
  })

  it('runs everything when no module is disabled', () => {
    for (const name of Object.keys(modules.MIGRATION_MODULES)) {
      expect(modules.isMigrationEnabled(name, modules.MODULE_DEFAULTS)).toBe(true)
    }
  })

  it('partitionMigrations keeps order and never returns a skipped file in run', () => {
    const list = ['001_init.js', '009_polar_subscriptions.js', '022_teams.js', '030_contact_submissions.js'].map((name) => ({ name, filePath: `/x/${name}` }))
    const { run, skipped } = modules.partitionMigrations(list, { ...modules.MODULE_DEFAULTS, billing: false })
    expect(run.map((m) => m.name)).toEqual(['001_init.js', '022_teams.js', '030_contact_submissions.js'])
    expect(skipped.map((m) => m.name)).toEqual(['009_polar_subscriptions.js'])
  })

  it('every mapped migration exists on disk and every key is a known module', () => {
    const dir = path.join(ROOT, 'server/src/db/migrations/@system')
    for (const [file, owner] of Object.entries(modules.MIGRATION_MODULES)) {
      expect(fs.existsSync(path.join(dir, `${file}.js`))).toBe(true)
      for (const key of [].concat(owner)) expect(modules.MODULE_KEYS).toContain(key)
    }
  })

  it('does not gate migrations that always-on code depends on', () => {
    // 011: SessionRepo selects u.onboarding_completed; 020: creates notifications/credits/transactions
    expect(modules.MIGRATION_MODULES['001_init']).toBeUndefined()
    expect(modules.MIGRATION_MODULES['011_onboarding']).toBeUndefined()
    expect(modules.MIGRATION_MODULES['020_billing_infrastructure']).toBeUndefined()
  })
})

describe('requireModule middleware', () => {
  function run(mw) {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    const next = jest.fn()
    mw({}, res, next)
    return { res, next }
  }

  it('calls next() for enabled modules and 403s for disabled ones', () => {
    const { next } = run(modules.requireModule('definitely-unknown-module'))
    expect(next).toHaveBeenCalled()

    // repo brand.json ships selfRegistration off
    const { res, next: n2 } = run(modules.requireModule('selfRegistration', 'nope'))
    expect(n2).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MODULE_DISABLED', module: 'selfRegistration', message: 'nope' }))
  })
})

describe('repo brand.json (informational template)', () => {
  it('declares every module and switches all of them off', () => {
    const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand.json'), 'utf8'))
    for (const key of modules.MODULE_KEYS) expect(brand.modules[key]).toBe(false)
    // Resolve explicitly without env so a MODULES_JSON left by another suite in
    // the same Jest worker cannot leak into this assertion.
    const resolved = modules.loadModules(modules.DEFAULT_BRAND_PATH, {})
    for (const key of modules.MODULE_KEYS) expect(resolved[key]).toBe(false)
  })

  it('no longer lists Stripe hosts in its CSP', () => {
    const brand = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand.json'), 'utf8'))
    const csp = brand.securityHeaders.contentSecurityPolicy
    const all = [...(csp.scriptSrc || []), ...(csp.connectSrc || []), ...(csp.frameSrc || [])]
    expect(all.some((h) => h.includes('stripe.com'))).toBe(false)
    expect(csp.frameSrc).toEqual(expect.arrayContaining(['https://www.openstreetmap.org', 'https://www.google.com']))
  })
})
