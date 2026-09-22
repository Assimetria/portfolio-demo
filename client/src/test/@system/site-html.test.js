// @system — Contract tests for scripts/lib/site-html.cjs: the build-time <head>,
// JSON-LD and pre-hydration fallback generated into client/index.html by
// client/webpack.config.mjs from brand.json + the merged site content.
import {
  htmlLang,
  ogLocale,
  siteTitle,
  siteDescription,
  ogImageUrl,
  siteJsonLd,
  analyticsTag,
  siteFallbackHtml,
  escapeHtml,
  APP_URL_PLACEHOLDER,
} from '../../../../scripts/lib/site-html.cjs'
import { mergeSiteLayers, brandSiteToContent } from '../../../../scripts/lib/site-brand.cjs'
import systemSite from '@/app/content/@system/site'
import brand from '../../../../brand.json'

const site = mergeSiteLayers(systemSite, brandSiteToContent(brand.site), {})
const brandInfo = { companyName: brand.companyName, tagline: brand.tagline, description: brand.description }

describe('lang / locale', () => {
  it('reads <html lang> from site.locale with a safe default', () => {
    expect(htmlLang(site)).toBe('en')
    expect(htmlLang({ locale: 'pt_PT' })).toBe('pt-PT')
    expect(htmlLang({ locale: '<script>' })).toBe('en')
    expect(htmlLang({})).toBe('en')
  })

  it('emits og:locale only for region-qualified tags', () => {
    expect(ogLocale({ locale: 'pt-PT' })).toBe('pt_PT')
    expect(ogLocale({ locale: 'en' })).toBe('')
  })
})

describe('title / description / og:image', () => {
  it('expands seo.titleTemplate placeholders', () => {
    expect(siteTitle(site, brandInfo)).toBe(`${brand.companyName} - ${brand.tagline}`)
    expect(siteTitle({ seo: { titleTemplate: '{tagline} | {name}' } }, { companyName: 'Acme', tagline: 'Rockets' })).toBe('Rockets | Acme')
  })

  it('drops a dangling separator when the tagline is empty', () => {
    expect(siteTitle({}, { companyName: 'Acme', tagline: '' })).toBe('Acme')
  })

  it('prefers seo.description, then brand description, then tagline', () => {
    expect(siteDescription({ seo: { description: 'Custom' } }, brandInfo)).toBe('Custom')
    expect(siteDescription(site, brandInfo)).toBe(brand.description)
    expect(siteDescription({}, { tagline: 'Only tagline' })).toBe('Only tagline')
  })

  it('makes og:image absolute against the runtime placeholder', () => {
    expect(ogImageUrl(site)).toBe(`${APP_URL_PLACEHOLDER}/assets/og/og-image.png`)
    expect(ogImageUrl({ seo: { ogImage: 'https://cdn.x/og.png' } })).toBe('https://cdn.x/og.png')
  })
})

describe('siteJsonLd — one @graph: business node + WebSite', () => {
  const ld = siteJsonLd({ brand: brandInfo, site, logo: '/assets/logos/logo-mark.svg' })
  const [business, website] = ld['@graph']

  it('uses the business type from brand.json site.seo.businessType', () => {
    expect(ld['@context']).toBe('https://schema.org')
    expect(business['@type']).toBe(brand.site.seo.businessType)
    expect(website['@type']).toBe('WebSite')
    expect(website.publisher).toEqual({ '@id': business['@id'] })
    expect(website.inLanguage).toBe('en')
  })

  it('carries name, url, telephone, address, openingHours from brand.json + content', () => {
    expect(business.name).toBe(brand.companyName)
    expect(business.url).toBe(`${APP_URL_PLACEHOLDER}/`)
    expect(business.telephone).toBe(brand.site.contact.phone)
    expect(business.address).toMatchObject({
      '@type': 'PostalAddress',
      streetAddress: brand.site.contact.address.street,
      postalCode: brand.site.contact.address.postalCode,
      addressLocality: brand.site.contact.address.city,
      addressCountry: brand.site.contact.address.country,
    })
    expect(business.openingHours).toEqual(brand.site.contact.openingHours)
    expect(business.logo).toEqual({ '@type': 'ImageObject', url: `${APP_URL_PLACEHOLDER}/assets/logos/logo-mark.svg` })
  })

  it('never emits the SaaS SoftwareApplication/Offer nodes', () => {
    expect(JSON.stringify(ld)).not.toMatch(/SoftwareApplication|"Offer"|priceCurrency/)
  })

  it('sameAs lists only http(s) social profiles and falls back to ProfessionalService for bad types', () => {
    const custom = siteJsonLd({
      brand: brandInfo,
      site: { seo: { businessType: 'bad type' }, footer: { social: { linkedin: 'https://li.com/x', email: 'mailto:a@b', twitter: '' } } },
    })
    const node = custom['@graph'][0]
    expect(node['@type']).toBe('ProfessionalService')
    expect(node.sameAs).toEqual(['https://li.com/x'])
    expect(node.telephone).toBeUndefined()
    expect(node.address).toBeUndefined()
  })
})

describe('analyticsTag — external scripts only (CSP has no unsafe-inline)', () => {
  it('is empty for provider none / unknown / umami without id', () => {
    expect(analyticsTag(site)).toBe('')
    expect(analyticsTag({ analytics: { provider: 'gtag', id: 'G-1' } })).toBe('')
    expect(analyticsTag({ analytics: { provider: 'umami' } })).toBe('')
  })

  it('emits Plausible with the id or the start.sh placeholder, and Umami with its website id', () => {
    expect(analyticsTag({ analytics: { provider: 'plausible', id: 'acme.pt' } })).toBe('<script defer data-domain="acme.pt" src="https://plausible.io/js/script.js"></script>')
    expect(analyticsTag({ analytics: { provider: 'plausible' } })).toContain('data-domain="__PLAUSIBLE_DOMAIN__"')
    expect(analyticsTag({ analytics: { provider: 'umami', id: 'abc-123' } })).toBe('<script defer src="https://cloud.umami.is/script.js" data-website-id="abc-123"></script>')
  })

  it('refuses ids that could break out of the attribute', () => {
    expect(analyticsTag({ analytics: { provider: 'plausible', id: 'x" onload="alert(1)' } })).toBe('')
  })
})

describe('siteFallbackHtml — #root before hydration', () => {
  const html = siteFallbackHtml({ brand: brandInfo, site, color: brand.primaryColor, fontBody: "'Inter', sans-serif", logo: '/assets/logos/logo-mark.svg' })

  it('renders the real site: nav labels, hero, about, services, contact line, footer legal links', () => {
    for (const l of site.nav.links) expect(html).toContain(`>${escapeHtml(l.label)}</a>`)
    expect(html).toContain(`<h1`)
    expect(html).toContain(escapeHtml(site.hero.title))
    expect(html).toContain(escapeHtml(site.hero.subtitle))
    expect(html).toContain(escapeHtml(site.about.title))
    for (const s of site.services.items) expect(html).toContain(escapeHtml(s.title))
    expect(html).toContain(`tel:${site.contact.phone.replace(/[^\d+]/g, '')}`)
    for (const line of site.contact.address.lines) expect(html).toContain(escapeHtml(line))
    for (const l of site.footer.legalLinks) expect(html).toContain(`href="${l.href}"`)
    expect(html).toMatch(/<main id="main-content"/)
  })

  it('has none of the SaaS placeholder copy or dummy forms', () => {
    expect(html).not.toMatch(/Auth, billing, teams|Get Started Free|Sign In|type="password"|\/app\/settings/)
  })

  it('escapes every value from content (no raw HTML injection)', () => {
    const evil = siteFallbackHtml({
      brand: { companyName: '<b>Acme</b> & Co' },
      site: { hero: { title: '"quoted" <img src=x onerror=alert(1)>' }, nav: { links: [{ label: 'x', href: 'javascript:alert(1)' }] } },
    })
    expect(evil).toContain('&lt;b&gt;Acme&lt;/b&gt; &amp; Co')
    expect(evil).toContain('&quot;quoted&quot; &lt;img')
    expect(evil).not.toContain('<img src=x')
    expect(evil).not.toContain('javascript:')
  })
})
