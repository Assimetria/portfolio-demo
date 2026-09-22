// @system — Contract tests for scripts/apply-brand.js (brand.json → brand.css +
// config/@custom/info.js). Runs the real generator against a temp repo root so
// the shape Orkosi provisioning writes and the legacy KickOff shape both produce
// the artifacts client/src/config/index.js and the theme layer depend on.
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  applyBrand,
  resolveBrand,
  CSS_END_SENTINEL,
  INFO_GENERATED_MARKER,
  SITE_GENERATED_MARKER,
  SITE_BRAND_REL,
} from '../../../../scripts/apply-brand.js'

const INFO_REL = 'client/src/config/@custom/info.js'
const CSS_REL = 'client/src/app/styles/@custom/brand.css'

const ACME = {
  companyName: 'Acme Rockets',
  slug: 'acme-rockets',
  tagline: 'Launch faster',
  description: 'Rocket telemetry for small teams.',
  primaryColor: '#7C3AED',
  accentColor: '#F59E0B',
  headingFont: 'Space Grotesk',
  monoFont: 'JetBrains Mono',
  brandFonts: { heading: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono' },
  defaultTheme: 'dark',
  logoPath: 'assets/logos/logo.svg',
  faviconPath: 'assets/favicons/favicon.svg',
  svgLogoPath: 'assets/logos/logo-mark.svg',
  supportEmail: 'hello@acme.test',
  assets: { logoOnDark: 'logo-on-dark.svg' },
  site: {
    locale: 'en-GB',
    nav: [{ label: 'Launches', href: '#launches' }],
    contact: { email: 'hello@acme.test', phone: '+44 20 7946 0000', address: ['1 Rocket Way', 'London'] },
    social: { github: 'https://github.com/acme' },
    seo: { businessType: 'LocalBusiness' },
    analytics: { provider: 'plausible', id: 'acme.test' },
  },
}

function makeRoot(brand) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-brand-'))
  fs.writeFileSync(path.join(root, 'brand.json'), JSON.stringify(brand, null, 2))
  return root
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const silent = { log: () => {}, warn: () => {} }

afterEach(() => {
  // temp dirs are small; leave cleanup to the OS if a test throws mid-way
})

describe('apply-brand — canonical (Orkosi) brand.json', () => {
  let root
  beforeAll(() => {
    root = makeRoot(ACME)
    applyBrand({ root, ...silent })
  })

  it('generates @custom/info.js exporting customInfo with the resolver contract keys', () => {
    const info = read(root, INFO_REL)
    expect(info).toContain(INFO_GENERATED_MARKER)
    expect(info).toMatch(/export const customInfo = \{/)
    expect(info).toContain('name: "Acme Rockets"')
    expect(info).toContain('tagline: "Launch faster"')
    expect(info).toContain('description: "Rocket telemetry for small teams."')
    expect(info).toContain('brandColor: "#7C3AED"')
    expect(info).toContain('accentColor: "#F59E0B"')
    expect(info).toContain('defaultTheme: "dark"')
    expect(info).toContain('heading: "Space Grotesk"')
    expect(info).toContain('body: "Inter"')
    expect(info).toContain('mono: "JetBrains Mono"')
    expect(info).toContain('logo: "/assets/logos/logo-mark.svg"')
    expect(info).toContain('logoUrl: "/assets/logos/logo.svg"')
    expect(info).toContain('logoDark: "/assets/logos/logo-on-dark.svg"')
    expect(info).toContain('favicon: "/assets/favicons/favicon.svg"')
    expect(info).toContain('supportEmail: "hello@acme.test"')
    // legacy export for older importers
    expect(info).toContain('export const info = { ...baseInfo, ...customInfo };')
    expect(info).not.toContain('customInfo: undefined')
  })

  it('generates brand.css with data-theme scopes, brand colours and font stacks', () => {
    const css = read(root, CSS_REL)
    expect(css).toContain('--brand-primary: #7C3AED')
    expect(css).toContain('--brand-accent: #F59E0B')
    expect(css).toMatch(/--font-heading: 'Space Grotesk', ui-sans-serif/)
    expect(css).toMatch(/--font-body: 'Inter', ui-sans-serif/)
    expect(css).toMatch(/--font-mono: 'JetBrains Mono', ui-monospace/)
    expect(css).toMatch(/\[data-theme="dark"\]\s*\{/)
    expect(css).toMatch(/\[data-theme="light"\]\s*\{/)
    // dark-first: :root background equals the dark palette's
    const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]
    const dark = css.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)[1]
    const light = css.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)[1]
    const pick = (block, name) => block.match(new RegExp(`${name}: ([^;]+);`))[1]
    expect(pick(rootBlock, '--brand-bg')).toBe(pick(dark, '--brand-bg'))
    expect(pick(dark, '--brand-bg')).not.toBe(pick(light, '--brand-bg'))
    // status tints + on-primary text exist in every scope
    for (const block of [rootBlock, dark, light]) {
      expect(block).toMatch(/--color-error-bg: rgba\(/)
      expect(block).toMatch(/--brand-text-on-primary: #/)
      expect(block).not.toContain('undefined')
    }
    expect(css.trim().endsWith(CSS_END_SENTINEL)).toBe(true)
  })

  it('is idempotent and preserves hand-written CSS after the sentinel', () => {
    const cssPath = path.join(root, CSS_REL)
    const first = read(root, CSS_REL)
    fs.writeFileSync(cssPath, first + '\n/* product tweak */\n.hero { color: red; }\n')

    const second = applyBrand({ root, ...silent })
    const css2 = read(root, CSS_REL)
    expect(css2).toContain('/* product tweak */\n.hero { color: red; }')
    expect(css2.indexOf(CSS_END_SENTINEL)).toBeLessThan(css2.indexOf('.hero'))
    expect(second.written).not.toContain(INFO_REL) // unchanged file not rewritten

    const third = applyBrand({ root, ...silent })
    expect(third.written).toEqual([])
    expect(read(root, CSS_REL)).toBe(css2)
  })

  it('generates content/@generated/site.brand.js from brand.json `site` (layer 2 of the site content)', () => {
    const src = read(root, SITE_BRAND_REL)
    expect(SITE_BRAND_REL).toBe('client/src/app/content/@generated/site.brand.js')
    expect(src).toContain(SITE_GENERATED_MARKER)
    expect(src).toMatch(/^\/\/ @generated/)
    expect(src).toContain('export default {')
    const data = new Function(src.replace(/^\/\/.*$/gm, '').replace('export default', 'return'))()
    expect(data.locale).toBe('en-GB')
    expect(data.nav.links).toEqual([{ label: 'Launches', href: '#launches' }])
    expect(data.contact).toEqual({ email: 'hello@acme.test', phone: '+44 20 7946 0000', address: { lines: ['1 Rocket Way', 'London'] } })
    expect(data.footer.social).toEqual({ github: 'https://github.com/acme' })
    expect(data.seo).toEqual({ businessType: 'LocalBusiness' })
    expect(data.analytics).toEqual({ provider: 'plausible', id: 'acme.test' })
    // regenerated deterministically: a second run writes nothing
    expect(applyBrand({ root, ...silent }).written).not.toContain(SITE_BRAND_REL)
  })

  it('respects the "apply-brand: keep" opt-out on @custom/info.js', () => {
    const infoPath = path.join(root, INFO_REL)
    fs.writeFileSync(infoPath, '// bespoke — apply-brand: keep\nexport const customInfo = { name: "Hand Written" }\n')
    applyBrand({ root, ...silent })
    expect(read(root, INFO_REL)).toContain('Hand Written')
  })
})

describe('apply-brand — legacy (KickOff) brand.json', () => {
  it('accepts name / colors.* / theme / typography.* and normalises them', () => {
    const root = makeRoot({
      name: 'KickOff',
      colors: { primary: '#16a34a', accent: '#eab308' },
      theme: 'dark',
      typography: { heading: 'Poppins', body: 'Lato' },
      logo: { url: '/logo.png', favicon: '/favicon.ico' },
    })
    const { brand, fonts } = applyBrand({ root, ...silent })
    expect(brand.companyName).toBe('KickOff')
    expect(brand.primaryColor).toBe('#16a34a')
    expect(brand.accentColor).toBe('#eab308')
    expect(brand.defaultTheme).toBe('dark')
    expect(fonts).toEqual({ heading: 'Poppins', body: 'Lato', mono: 'JetBrains Mono' })
    const info = read(root, INFO_REL)
    expect(info).toContain('name: "KickOff"')
    expect(info).toContain('logo: "/logo.png"')
    expect(info).toContain('favicon: "/favicon.ico"')
    expect(read(root, CSS_REL)).toMatch(/--font-heading: 'Poppins'/)
    // no `site` block (SaaS-shaped brand.json) → empty generated layer, still importable
    expect(read(root, SITE_BRAND_REL)).toContain('export default {}')
  })

  it('falls back to slate defaults + light theme for invalid or missing values', () => {
    const warnings = []
    const brand = resolveBrand({ primaryColor: 'purple', defaultTheme: 'sepia' }, { warn: (m) => warnings.push(m) })
    expect(brand.primaryColor).toBe('#64748B')
    expect(brand.accentColor).toBe('#94A3B8')
    expect(brand.defaultTheme).toBe('light')
    expect(brand.companyName).toBe('Product')
    expect(warnings.some((w) => w.includes('primaryColor'))).toBe(true)
    expect(warnings.some((w) => w.includes('defaultTheme'))).toBe(true)
  })
})
