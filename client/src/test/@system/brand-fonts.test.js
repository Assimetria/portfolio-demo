// @system — Unit tests for scripts/lib/brand-fonts.cjs, the single font resolver
// shared by apply-brand.js (brand.css --font-*) and webpack.config.mjs
// (Google Fonts <link> + inline font stacks in index.html).
import {
  resolveBrandFonts,
  googleFontsHref,
  googleFontsLinkTags,
  googleFamilies,
  fontStack,
  isGoogleFamily,
  DEFAULT_FONTS,
} from '../../../../scripts/lib/brand-fonts.cjs'

describe('resolveBrandFonts — precedence', () => {
  it('prefers canonical brandFonts.{heading,body,mono}', () => {
    const fonts = resolveBrandFonts({
      brandFonts: { heading: 'Space Grotesk', body: 'Inter', mono: 'Fira Code' },
      typography: { heading: 'Poppins', body: 'Lato', mono: 'Roboto Mono' },
      headingFont: 'Montserrat',
      bodyFont: 'Open Sans',
      monoFont: 'Source Code Pro',
    })
    expect(fonts).toEqual({ heading: 'Space Grotesk', body: 'Inter', mono: 'Fira Code' })
  })

  it('falls back to legacy typography.* then flat *Font keys per slot', () => {
    expect(
      resolveBrandFonts({ typography: { heading: 'Poppins' }, bodyFont: 'Open Sans', monoFont: 'Fira Code' }),
    ).toEqual({ heading: 'Poppins', body: 'Open Sans', mono: 'Fira Code' })
    expect(resolveBrandFonts({ headingFont: 'Montserrat' })).toEqual({
      heading: 'Montserrat',
      body: DEFAULT_FONTS.body,
      mono: DEFAULT_FONTS.mono,
    })
  })

  it('defaults to Inter / Inter / JetBrains Mono and ignores blanks/non-strings', () => {
    expect(resolveBrandFonts({})).toEqual({ heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' })
    expect(resolveBrandFonts(undefined)).toEqual({ heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' })
    expect(resolveBrandFonts({ brandFonts: { heading: '   ', body: 42 } })).toEqual({
      heading: 'Inter',
      body: 'Inter',
      mono: 'JetBrains Mono',
    })
  })

  it('accepts a CSS stack and keeps only the first family', () => {
    expect(resolveBrandFonts({ headingFont: "'Space Grotesk', system-ui, sans-serif" }).heading).toBe('Space Grotesk')
  })
})

describe('googleFontsHref / link tags', () => {
  it('dedupes families, requests weights 400–700 and display=swap', () => {
    const href = googleFontsHref({ heading: 'Space Grotesk', body: 'Inter', mono: 'JetBrains Mono' })
    expect(href).toBe(
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
    )
    // heading === body → one entry
    expect(googleFontsHref({ heading: 'Inter', body: 'inter', mono: 'JetBrains Mono' })).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
    )
  })

  it('never requests system/generic families and returns empty when none are Google fonts', () => {
    expect(isGoogleFamily('system-ui')).toBe(false)
    expect(isGoogleFamily('Arial')).toBe(false)
    expect(isGoogleFamily('Poppins')).toBe(true)
    expect(googleFamilies({ heading: 'system-ui', body: 'Arial', mono: 'monospace' })).toEqual([])
    expect(googleFontsHref({ heading: 'system-ui', body: 'Arial', mono: 'monospace' })).toBe('')
    expect(googleFontsLinkTags({ heading: 'system-ui', body: 'Arial', mono: 'monospace' })).toBe('')
  })

  it('emits preconnect + stylesheet tags', () => {
    const tags = googleFontsLinkTags({ heading: 'Poppins', body: 'Poppins', mono: 'JetBrains Mono' })
    expect(tags).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />')
    expect(tags).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />')
    expect(tags).toContain('family=Poppins:wght@400;500;600;700&family=JetBrains+Mono')
    expect(tags).toContain('rel="stylesheet"')
  })
})

describe('fontStack', () => {
  it('quotes the family and appends platform fallbacks', () => {
    expect(fontStack('Space Grotesk', 'sans')).toMatch(/^'Space Grotesk', ui-sans-serif, system-ui/)
    expect(fontStack('JetBrains Mono', 'mono')).toMatch(/^'JetBrains Mono', ui-monospace, SFMono-Regular/)
    expect(fontStack('', 'sans')).toMatch(/^ui-sans-serif/)
  })
})
