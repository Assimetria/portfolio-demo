/**
 * site-html.cjs — build-time HTML fragments for client/index.html, derived from
 * brand.json + the merged site content (scripts/lib/site-content.cjs).
 *
 * Pure functions (no fs) consumed by client/webpack.config.mjs as HtmlWebpackPlugin
 * templateParameters and unit-tested in client/src/test/@system/site-html.test.js:
 *
 *   htmlLang(site)              <html lang="…">
 *   ogLocale(site)              og:locale ("pt_PT") or '' for language-only tags
 *   siteTitle(site, brand)      seo.titleTemplate with {name}/{tagline} expanded
 *   siteDescription(site, brand)
 *   ogImageUrl(site, appUrl)
 *   siteJsonLd(...)             one @graph block: <businessType> + WebSite
 *   siteFallbackHtml(...)       semantic markup for #root before hydration / no-JS
 *   analyticsTag(site)          external analytics <script> (never inline — CSP)
 *
 * `__APP_URL__` is a runtime placeholder: start.sh substitutes it at container
 * start and server/src/lib/@system/spaFallback.js per request, so URLs here are
 * always emitted relative to that placeholder.
 */

'use strict'

const { DEFAULT_BUSINESS_TYPE } = require('./site-brand.cjs')

const APP_URL_PLACEHOLDER = '__APP_URL__'
const PLAUSIBLE_DOMAIN_PLACEHOLDER = '__PLAUSIBLE_DOMAIN__'
const DEFAULT_TITLE_TEMPLATE = '{name} - {tagline}'
const DEFAULT_OG_IMAGE = '/assets/og/og-image.png'
const DEFAULT_LOGO = '/assets/logos/logo-mark.svg'
const ANALYTICS_ID_RE = /^[A-Za-z0-9._:-]{1,120}$/

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const list = (v) => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined) : [])

function htmlLang(site) {
  const locale = str(site && site.locale) || 'en'
  return /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/.test(locale) ? locale.replace(/_/g, '-') : 'en'
}

function ogLocale(site) {
  const lang = htmlLang(site)
  const m = /^([a-z]{2,3})[-_]([A-Za-z]{2})$/i.exec(lang)
  return m ? `${m[1].toLowerCase()}_${m[2].toUpperCase()}` : ''
}

function siteTitle(site, brand) {
  const name = str(brand && brand.companyName) || 'Product'
  const tagline = str(brand && brand.tagline)
  const template = str(site && site.seo && site.seo.titleTemplate) || DEFAULT_TITLE_TEMPLATE
  let title = template.replace(/\{name\}/g, name).replace(/\{tagline\}/g, tagline)
  if (!tagline) title = title.replace(/\s*[-–—|·:]\s*$/, '').replace(/^\s*[-–—|·:]\s*/, '')
  return title.trim() || name
}

function siteDescription(site, brand) {
  return str(site && site.seo && site.seo.description) || str(brand && brand.description) || str(brand && brand.tagline)
}

function absolute(url, appUrl = APP_URL_PLACEHOLDER) {
  const u = str(url)
  if (!u) return ''
  if (/^(https?:)?\/\//.test(u) || u.startsWith('data:')) return u
  return `${appUrl}/${u.replace(/^\/+/, '')}`
}

function ogImageUrl(site, appUrl = APP_URL_PLACEHOLDER) {
  return absolute(str(site && site.seo && site.seo.ogImage) || DEFAULT_OG_IMAGE, appUrl)
}

function businessType(site) {
  const t = str(site && site.seo && site.seo.businessType)
  return /^[A-Z][A-Za-z0-9]{2,60}$/.test(t) ? t : DEFAULT_BUSINESS_TYPE
}

function postalAddress(address) {
  if (!address || typeof address !== 'object') return undefined
  const lines = list(address.lines).map(str).filter(Boolean)
  const out = { '@type': 'PostalAddress' }
  const street = str(address.street)
  if (street) out.streetAddress = street
  else if (lines.length) out.streetAddress = lines.join(', ')
  if (str(address.postalCode)) out.postalCode = str(address.postalCode)
  if (str(address.city)) out.addressLocality = str(address.city)
  if (str(address.region)) out.addressRegion = str(address.region)
  if (str(address.country)) out.addressCountry = str(address.country)
  return Object.keys(out).length > 1 ? out : undefined
}

function sameAs(site) {
  const social = (site && site.footer && site.footer.social) || {}
  return Object.values(social)
    .map(str)
    .filter((u) => /^https?:\/\//.test(u))
}

/**
 * JSON-LD graph: the business (type from brand.json site.seo.businessType) and
 * the WebSite node. Returned as an object; the caller serialises it.
 */
function siteJsonLd({ brand = {}, site = {}, appUrl = APP_URL_PLACEHOLDER, logo = DEFAULT_LOGO } = {}) {
  const name = str(brand.companyName) || 'Product'
  const contact = site.contact || {}
  const business = {
    '@type': businessType(site),
    '@id': `${appUrl}/#business`,
    name,
    url: `${appUrl}/`,
  }
  const description = siteDescription(site, brand)
  if (description) business.description = description
  business.image = absolute(logo, appUrl)
  business.logo = { '@type': 'ImageObject', url: absolute(logo, appUrl) }
  if (str(contact.phone)) business.telephone = str(contact.phone)
  if (str(contact.email)) business.email = str(contact.email)
  const address = postalAddress(contact.address)
  if (address) business.address = address
  const hours = list(contact.openingHours).map(str).filter(Boolean)
  if (hours.length) business.openingHours = hours
  const links = sameAs(site)
  if (links.length) business.sameAs = links

  const website = {
    '@type': 'WebSite',
    '@id': `${appUrl}/#website`,
    url: `${appUrl}/`,
    name,
    inLanguage: htmlLang(site),
    publisher: { '@id': business['@id'] },
  }
  return { '@context': 'https://schema.org', '@graph': [business, website] }
}

function analyticsTag(site) {
  const a = (site && site.analytics) || {}
  const provider = str(a.provider).toLowerCase()
  const id = str(a.id)
  if (id && !ANALYTICS_ID_RE.test(id)) return ''
  if (provider === 'plausible') {
    return `<script defer data-domain="${escapeHtml(id || PLAUSIBLE_DOMAIN_PLACEHOLDER)}" src="https://plausible.io/js/script.js"></script>`
  }
  if (provider === 'umami' && id) {
    return `<script defer src="https://cloud.umami.is/script.js" data-website-id="${escapeHtml(id)}"></script>`
  }
  return ''
}

// ─── Pre-hydration fallback markup ───────────────────────────────────────────

const INK = '#0f172a'
const MUTED = '#64748B'
const LINE = '#e2e8f0'

function anchorHref(href) {
  const h = str(href)
  if (!h) return '#'
  if (/^(javascript|data|vbscript):/i.test(h)) return '#'
  return h
}

function link(l, style) {
  return `<a href="${escapeHtml(anchorHref(l.href))}" style="${style}">${escapeHtml(l.label)}</a>`
}

/**
 * Semantic, dependency-free markup for `<div id="root">` so crawlers, readers and
 * no-JS visitors get the real site (hero, about, services, contact, footer) before
 * React mounts. Every value comes from the merged site content + brand.json.
 * When prerender.mjs runs, its snapshot replaces this; when it cannot (no
 * Chromium at build time), this is what ships.
 */
function siteFallbackHtml({ brand = {}, site = {}, color = MUTED, fontBody = 'system-ui, sans-serif', logo = DEFAULT_LOGO } = {}) {
  const name = str(brand.companyName) || 'Product'
  const nav = site.nav || {}
  const hero = site.hero || {}
  const about = site.about || {}
  const services = site.services || {}
  const contact = site.contact || {}
  const footer = site.footer || {}
  const features = site.features || {}
  const brandColor = /^#[0-9a-f]{3,8}$/i.test(str(color)) ? str(color) : MUTED
  const linkStyle = `font-size:0.875rem;color:${MUTED};text-decoration:none;font-weight:500;`
  const btnPrimary = `padding:0.75rem 1.5rem;background:${brandColor};color:#fff;border-radius:0.5rem;font-size:1rem;font-weight:600;text-decoration:none;`
  const btnSecondary = `padding:0.75rem 1.5rem;background:transparent;color:${INK};border:1px solid ${LINE};border-radius:0.5rem;font-size:1rem;font-weight:500;text-decoration:none;`

  const navLinks = list(nav.links).map((l) => link(l, linkStyle))
  if (str(nav.ctaLabel)) navLinks.push(link({ label: nav.ctaLabel, href: nav.ctaHref || '#contact' }, `padding:0.5rem 1rem;background:${brandColor};color:#fff;border-radius:0.5rem;font-size:0.875rem;font-weight:600;text-decoration:none;`))

  const parts = []
  parts.push(`<header style="padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;font-family:${escapeHtml(fontBody)};border-bottom:1px solid ${LINE};">`)
  parts.push(`<a href="/" style="display:flex;align-items:center;gap:0.625rem;text-decoration:none;"><img src="${escapeHtml(logo)}" alt="" width="32" height="32" /><span style="font-size:1.125rem;font-weight:700;color:${INK};">${escapeHtml(name)}</span></a>`)
  if (navLinks.length) parts.push(`<nav aria-label="Primary" style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">${navLinks.join('')}</nav>`)
  parts.push('</header>')

  parts.push(`<main id="main-content" style="font-family:${escapeHtml(fontBody)};">`)
  // Hero
  parts.push('<section id="hero" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:1.25rem;padding:3rem 2rem;text-align:center;">')
  if (str(hero.eyebrow)) parts.push(`<p style="font-size:0.75rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${brandColor};margin:0;">${escapeHtml(hero.eyebrow)}</p>`)
  parts.push(`<h1 style="font-size:3rem;font-weight:800;color:${INK};margin:0;max-width:720px;line-height:1.1;">${escapeHtml(str(hero.title) || name)}</h1>`)
  if (str(hero.subtitle)) parts.push(`<p style="font-size:1.25rem;color:${MUTED};margin:0;max-width:600px;line-height:1.6;">${escapeHtml(hero.subtitle)}</p>`)
  const ctas = []
  if (hero.primaryCta && str(hero.primaryCta.label)) ctas.push(link(hero.primaryCta, btnPrimary))
  if (hero.secondaryCta && str(hero.secondaryCta.label)) ctas.push(link(hero.secondaryCta, btnSecondary))
  if (ctas.length) parts.push(`<div style="display:flex;gap:0.75rem;flex-wrap:wrap;justify-content:center;margin-top:0.5rem;">${ctas.join('')}</div>`)
  parts.push('</section>')

  // About
  if (str(about.title)) {
    parts.push(`<section id="about" style="padding:3rem 2rem;max-width:960px;margin:0 auto;"><h2 style="font-size:2rem;font-weight:700;color:${INK};margin:0 0 1rem;">${escapeHtml(about.title)}</h2>`)
    for (const p of list(about.body)) parts.push(`<p style="font-size:1rem;color:${MUTED};line-height:1.7;margin:0 0 1rem;">${escapeHtml(p)}</p>`)
    const highlights = list(about.highlights).filter((h) => str(h.label) && str(h.value))
    if (highlights.length) {
      parts.push('<dl style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin:1.5rem 0 0;">')
      for (const h of highlights) parts.push(`<div><dt style="font-size:0.875rem;color:${MUTED};">${escapeHtml(h.label)}</dt><dd style="font-size:1.5rem;font-weight:700;color:${INK};margin:0;">${escapeHtml(h.value)}</dd></div>`)
      parts.push('</dl>')
    }
    parts.push('</section>')
  }

  // Services
  const items = list(services.items).filter((s) => str(s.title))
  if (items.length) {
    parts.push('<section id="services" style="padding:3rem 2rem;max-width:960px;margin:0 auto;">')
    parts.push(`<h2 style="font-size:2rem;font-weight:700;color:${INK};text-align:center;margin:0 0 0.5rem;">${escapeHtml(str(services.title) || 'Services')}</h2>`)
    if (str(services.subtitle)) parts.push(`<p style="text-align:center;color:${MUTED};margin:0 0 2rem;">${escapeHtml(services.subtitle)}</p>`)
    parts.push('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;">')
    for (const s of items) {
      parts.push(`<article style="padding:1.5rem;border:1px solid ${LINE};border-radius:0.75rem;"><h3 style="font-size:1.125rem;font-weight:600;color:${INK};margin:0 0 0.5rem;">${escapeHtml(s.title)}</h3>${str(s.description) ? `<p style="font-size:0.875rem;color:${MUTED};margin:0;line-height:1.6;">${escapeHtml(s.description)}</p>` : ''}</article>`)
    }
    parts.push('</div></section>')
  }

  // Contact
  const addressLines = list(contact.address && contact.address.lines).map(str).filter(Boolean)
  const hours = list(contact.hours).map(str).filter(Boolean)
  if (str(contact.title) || str(contact.email) || str(contact.phone) || addressLines.length) {
    parts.push('<section id="contact" style="padding:3rem 2rem;max-width:960px;margin:0 auto;">')
    parts.push(`<h2 style="font-size:2rem;font-weight:700;color:${INK};margin:0 0 0.5rem;">${escapeHtml(str(contact.title) || 'Contact')}</h2>`)
    if (str(contact.subtitle)) parts.push(`<p style="color:${MUTED};margin:0 0 1.5rem;">${escapeHtml(contact.subtitle)}</p>`)
    parts.push(`<address style="font-style:normal;line-height:1.8;color:${INK};">`)
    if (str(contact.email)) parts.push(`<div><a href="mailto:${escapeHtml(contact.email)}" style="color:${brandColor};">${escapeHtml(contact.email)}</a></div>`)
    if (str(contact.phone)) parts.push(`<div><a href="tel:${escapeHtml(str(contact.phone).replace(/[^\d+]/g, ''))}" style="color:${brandColor};">${escapeHtml(contact.phone)}</a></div>`)
    if (addressLines.length) parts.push(`<div>${addressLines.map(escapeHtml).join('<br />')}</div>`)
    if (hours.length) parts.push(`<div style="color:${MUTED};">${hours.map(escapeHtml).join('<br />')}</div>`)
    parts.push('</address>')
    if (features.showContactForm !== false) parts.push(`<p style="color:${MUTED};margin:1rem 0 0;">Enable JavaScript to use the contact form${str(contact.email) ? `, or email <a href="mailto:${escapeHtml(contact.email)}" style="color:${brandColor};">${escapeHtml(contact.email)}</a>` : ''}.</p>`)
    parts.push('</section>')
  }
  parts.push('</main>')

  // Footer
  const year = new Date().getUTCFullYear()
  const copyright = str(footer.copyright) || `© ${year} ${name}. All rights reserved.`
  const legal = list(footer.legalLinks).filter((l) => str(l.label) && str(l.href))
  parts.push(`<footer style="padding:2rem;text-align:center;font-family:${escapeHtml(fontBody)};border-top:1px solid ${LINE};">`)
  if (str(footer.tagline)) parts.push(`<p style="font-size:0.875rem;color:${MUTED};margin:0 0 0.75rem;">${escapeHtml(footer.tagline)}</p>`)
  parts.push(`<p style="font-size:0.875rem;color:#94a3b8;margin:0 0 0.75rem;">${escapeHtml(copyright)}</p>`)
  if (legal.length) parts.push(`<nav aria-label="Legal" style="display:flex;justify-content:center;gap:1.25rem;font-size:0.75rem;flex-wrap:wrap;">${legal.map((l) => link(l, 'color:#94a3b8;text-decoration:none;')).join('')}</nav>`)
  parts.push('</footer>')

  return parts.join('\n')
}

module.exports = {
  APP_URL_PLACEHOLDER,
  DEFAULT_TITLE_TEMPLATE,
  DEFAULT_OG_IMAGE,
  escapeHtml,
  htmlLang,
  ogLocale,
  siteTitle,
  siteDescription,
  ogImageUrl,
  businessType,
  siteJsonLd,
  analyticsTag,
  siteFallbackHtml,
}
