// @system — brand.json contract: validation (scripts/lib/brand-schema.cjs +
// brand.schema.json) and the tokens apply-brand derives from spacing, radius and
// the brand engine's modes.{light,dark}. Rui's rule: changing brand.json changes
// the whole product, so every consumed key is typed and a typo fails the build.
import fs from 'fs'
import os from 'os'
import path from 'path'
import { applyBrand, checkBrand, resolveBrand, deriveSpacingScale, deriveRadiusScale } from '../../../../scripts/apply-brand.js'
import { validateBrand, SPACING_PRESETS, RADIUS_PRESETS } from '../../../../scripts/lib/brand-schema.cjs'

const ROOT = path.resolve(__dirname, '../../../..')
const CSS_REL = 'client/src/app/styles/@custom/brand.css'
const silent = { log: () => {}, warn: () => {} }

const BASE = {
  companyName: 'Acme Rockets',
  slug: 'acme-rockets',
  primaryColor: '#7C3AED',
  accentColor: '#F59E0B',
  brandFonts: { heading: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono' },
  defaultTheme: 'light',
}

function makeRoot(brand) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-schema-'))
  fs.writeFileSync(path.join(root, 'brand.json'), JSON.stringify(brand, null, 2))
  return root
}
const css = (root) => fs.readFileSync(path.join(root, CSS_REL), 'utf8')

describe('brand.json validation', () => {
  it('accepts the canonical Orkosi shape, the legacy KickOff shape and brand-engine v2 keys', () => {
    expect(validateBrand(BASE).errors).toEqual([])
    expect(
      validateBrand({ name: 'Kick', colors: { primary: '#123456', accent: '#abcdef' }, theme: 'dark', typography: { heading: 'Inter' } }).errors,
    ).toEqual([])
    const v2 = {
      ...BASE,
      modes: {
        light: { primary: '#7C3AED', bg: '#FFFFFF', surface: '#F7F7FA', text: '#111111', textMuted: '#555555', hairline: 'rgba(0,0,0,0.08)', semantic: { success: { fill: '#0A0', on: '#FFF', text: '#050' } } },
        dark: { primary: '#A78BFA', bg: '#0B0B10', text: '#FAFAFA' },
      },
      typography: { scale: { display: [56, 40], body: [16, 14], displayLineHeight: 1.1 } },
      voice: { tone: 'confident' },
      positioning: 'x',
      logos: [{ id: 'mark' }],
      spacing: 'spacious',
      radius: 'lg',
    }
    expect(validateBrand(v2).errors).toEqual([])
  })

  it('rejects wrong types on every consumed key with a path', () => {
    const { errors } = validateBrand({
      companyName: 42,
      primaryColor: 'purple',
      accentColor: '#GGGGGG',
      brandFonts: 'Inter',
      defaultTheme: 'auto',
      spacing: 'huge',
      radius: '12',
      modes: { light: { bg: 'white' } },
      customCssVars: { 'no-dashes': 'x' },
      securityHeaders: { contentSecurityPolicy: { scriptSrc: 'self' } },
      assets: { logo: 1 },
      slug: 'Has Spaces',
    })
    const paths = errors.map((e) => e.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        'companyName',
        'primaryColor',
        'accentColor',
        'brandFonts',
        'defaultTheme',
        'spacing',
        'radius',
        'modes.light.bg',
        'customCssVars.no-dashes',
        'securityHeaders.contentSecurityPolicy.scriptSrc',
        'assets.logo',
        'slug',
      ]),
    )
    expect(errors.find((e) => e.path === 'primaryColor').message).toMatch(/hex colour/)
  })

  it('applyBrand refuses to build from an invalid brand.json', () => {
    const root = makeRoot({ ...BASE, primaryColor: 'not-a-colour' })
    expect(() => applyBrand({ root, ...silent })).toThrow(/brand\.json is invalid[\s\S]*primaryColor/)
    expect(checkBrand({ root }).errors).toHaveLength(1)
  })

  it('brand.schema.json mirrors the validator (same presets, hex pattern, theme enum)', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand.schema.json'), 'utf8'))
    expect(schema.additionalProperties).toBe(true)
    expect(schema.properties.spacing.oneOf[0].enum).toEqual(Object.keys(SPACING_PRESETS))
    expect(schema.properties.radius.oneOf[0].enum).toEqual(Object.keys(RADIUS_PRESETS))
    expect(schema.properties.defaultTheme.enum).toEqual(['light', 'dark'])
    expect(new RegExp(schema.definitions.hex.pattern).test('#7C3AED')).toBe(true)
    expect(new RegExp(schema.definitions.hex.pattern).test('purple')).toBe(false)
    expect(schema.properties.modes.properties.light.$ref).toBe('#/definitions/mode')
  })

  it('the template repo brand.json itself is valid', () => {
    expect(checkBrand({ root: ROOT }).errors).toEqual([])
  })
})

describe('spacing and radius tokens', () => {
  it('defaults reproduce the historical scale (byte-stable output for existing products)', () => {
    expect(deriveSpacingScale(1)).toEqual({ xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px' })
    expect(deriveRadiusScale('0.5rem')).toEqual({ xs: '3px', sm: '6px', md: '8px', lg: '12px' })
    const root = makeRoot(BASE)
    applyBrand({ root, ...silent })
    const out = css(root)
    expect(out).toContain('--radius: 0.5rem;')
    expect(out).toContain('--space-scale: 1;')
    expect(out).toContain('--space-md: 16px;')
    expect(out).toContain('--radius-lg: 12px;')
  })

  it('spacing presets and numbers scale every --space-* token', () => {
    expect(resolveBrand({ spacing: 'compact' }).spacingScale).toBe(0.875)
    expect(resolveBrand({ spacing: 1.25 }).spacingScale).toBe(1.25)
    const root = makeRoot({ ...BASE, spacing: 'spacious' })
    applyBrand({ root, ...silent })
    const out = css(root)
    expect(out).toContain('--space-scale: 1.125;')
    expect(out).toContain('--space-md: 18px;')
    expect(out).toContain('--space-3xl: 72px;')
  })

  it('radius presets, CSS lengths and the legacy borderRadius alias drive --radius and the scale', () => {
    expect(resolveBrand({ radius: 'lg' }).radius).toBe('0.75rem')
    expect(resolveBrand({ radius: '10px' }).radius).toBe('10px')
    expect(resolveBrand({ borderRadius: '1rem' }).radius).toBe('1rem')
    expect(resolveBrand({}).radius).toBe('0.5rem')
    const root = makeRoot({ ...BASE, radius: 'none' })
    applyBrand({ root, ...silent })
    const out = css(root)
    expect(out).toContain('--radius: 0px;')
    expect(out).toContain('--radius-lg: 0px;')
    const full = makeRoot({ ...BASE, radius: 'full' })
    applyBrand({ root: full, ...silent })
    expect(css(full)).toContain('--radius-sm: 9999px;')
  })
})

describe('modes.{light,dark} from the brand engine', () => {
  it('override the derived palette per theme and leave the other theme derived', () => {
    const root = makeRoot({
      ...BASE,
      defaultTheme: 'dark',
      modes: {
        dark: { primary: '#A78BFA', bg: '#0B0B10', surface: '#15151C', text: '#F5F5F7', textMuted: '#9A9AAF', border: '#26262F', onPrimary: '#111111', primaryHover: '#B9A3FF' },
        light: { bg: '#FFFDF8' },
      },
    })
    applyBrand({ root, ...silent })
    const out = css(root)
    // anchor on the rule blocks, not the header comment that mentions the selectors
    const dark = out.slice(out.indexOf('[data-theme="dark"] {'), out.indexOf('[data-theme="light"] {'))
    const light = out.slice(out.indexOf('[data-theme="light"] {'))
    expect(dark).toContain('--brand-primary: #A78BFA;')
    expect(dark).toContain('--brand-primary-hover: #B9A3FF;')
    expect(dark).toContain('--brand-bg: #0B0B10;')
    expect(dark).toContain('--brand-surface: #15151C;')
    expect(dark).toContain('--brand-text: #F5F5F7;')
    expect(dark).toContain('--brand-text-secondary: #9A9AAF;')
    expect(dark).toContain('--brand-border: #26262F;')
    expect(dark).toContain('--brand-text-on-primary: #111111;')
    expect(light).toContain('--brand-bg: #FFFDF8;')
    expect(light).toContain('--brand-primary: #7C3AED;') // light keeps the top-level primary
    // :root carries the default (dark) theme, so the page paints the engine palette first
    const rootBlock = out.slice(out.indexOf(':root {'), out.indexOf('[data-theme="dark"] {'))
    expect(rootBlock).toContain('--brand-bg: #0B0B10;')
  })

  it('ignores non-hex values inside modes instead of emitting them', () => {
    expect(resolveBrand({ modes: { dark: { bg: 'black', text: '#FFF' } } }).modes.dark).toEqual({ textColor: '#FFF' })
    expect(resolveBrand({}).modes).toEqual({ light: {}, dark: {} })
  })
})
