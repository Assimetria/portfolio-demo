// @system — who owns which file on a template upgrade (scripts/@system/template-ownership.js).
// The Orkosi upgrade engine and the developer CLI both apply these rules, so
// they are pinned here.
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const own = require(path.join(ROOT, 'scripts/@system/template-ownership.js'))

describe('template-ownership — glob matching', () => {
  const m = (glob, p) => own.globToRegExp(glob).test(p)

  it('matches double-star globs at any depth including the root', () => {
    expect(m('**/@system/**', '@system/x.js')).toBe(true)
    expect(m('**/@system/**', 'server/src/api/@system/health/index.js')).toBe(true)
    expect(m('**/@system/**', 'server/src/api/@custom/x.js')).toBe(false)
    expect(m('assets/**', 'assets/logos/logo.svg')).toBe(true)
    expect(m('assets/**', 'client/assets/x')).toBe(false)
    expect(m('**', 'anything/at/all')).toBe(true)
  })

  it('handles single-star, ? and braces', () => {
    expect(m('scripts/generate-*.js', 'scripts/generate-favicons.js')).toBe(true)
    expect(m('scripts/generate-*.js', 'scripts/nested/generate-favicons.js')).toBe(false)
    expect(m('client/postcss.config.*', 'client/postcss.config.mjs')).toBe(true)
    expect(m('.env.*', '.env.production')).toBe(true)
    expect(m('.env.*', '.env')).toBe(false)
    expect(m('docker-compose.{yml,yaml}', 'docker-compose.yaml')).toBe(true)
    expect(m('file?.txt', 'file1.txt')).toBe(true)
    expect(m('file?.txt', 'file12.txt')).toBe(false)
  })
})

describe('template-ownership — default rules', () => {
  const c = (p) => own.classify(p, own.DEFAULT_OWNERSHIP)

  it('template-owned build and @system files are system', () => {
    for (const p of [
      'VERSION',
      'template-manifest.json',
      'brand.schema.json',
      'Dockerfile',
      'start.sh',
      '.github/workflows/ci.yml',
      'scripts/apply-brand.js',
      'scripts/lib/brand-schema.cjs',
      'scripts/@system/version.js',
      'client/webpack.config.mjs',
      'server/src/api/@system/health/index.js',
      'client/src/app/components/@system/ui/button.jsx',
      'e2e/@system/01-auth.spec.js',
    ]) expect([p, c(p)]).toEqual([p, 'system'])
  })

  it('product code under @custom is custom', () => {
    expect(c('client/src/config/@custom/info.js')).toBe('custom')
    expect(c('server/src/api/@custom/projects.js')).toBe('custom')
    expect(c('server/src/db/migrations/@custom/001_projects.js')).toBe('custom')
  })

  it('brand, assets, README and env files are customer-owned', () => {
    for (const p of ['brand.json', 'assets/logos/logo.svg', 'client/public/robots.txt', 'README.md', 'CLAUDE.md', '.env', 'server/.env.local']) {
      expect([p, c(p)]).toEqual([p, 'customer'])
    }
  })

  it('everything else is 3-way merged', () => {
    for (const p of ['server/src/app.js', 'client/package.json', 'package-lock.json', 'CHANGELOG.md', 'docs/API.md', 'client/index.html']) {
      expect([p, c(p)]).toEqual([p, 'merge'])
    }
  })

  it("custom beats system when both match (a @custom file inside a system dir stays the product's)", () => {
    expect(own.classify('scripts/@custom/prebuild.js', own.DEFAULT_OWNERSHIP)).toBe('custom')
    expect(own.classify('client/src/app/pages/@system/@custom/x.js', own.DEFAULT_OWNERSHIP)).toBe('custom')
  })
})

describe('template-ownership — manifest overrides', () => {
  it('a category in the manifest replaces the default list for that category only', () => {
    const rules = own.resolveOwnership({ customer: ['brand.json', 'content/**'] })
    expect(rules.customer).toEqual(['brand.json', 'content/**'])
    expect(rules.system).toEqual(own.DEFAULT_OWNERSHIP.system)
    const compiled = own.compileOwnership(rules)
    expect(own.classify('content/landing.md', compiled)).toBe('customer')
    expect(own.classify('README.md', compiled)).toBe('merge')
  })

  it('the repository manifest carries all four categories and classifies its own VERSION as system', () => {
    const ownership = own.loadManifestOwnership(ROOT)
    expect(Object.keys(ownership).sort()).toEqual(['custom', 'customer', 'merge', 'system'])
    expect(own.classify('VERSION', ownership)).toBe('system')
    expect(own.classify('brand.json', ownership)).toBe('customer')
  })
})
