const express = require('express')
const router = express.Router()
const db = require('../../../lib/@system/PostgreSQL')
const { isEnabled: isModuleEnabled } = require('../../../lib/@system/Helpers/modules')

// Informational template: the public site is a single page with anchored
// sections (#about #services #team #testimonials #contact); only real routes
// are listed. `/contact` is the SaaS foundation's standalone page and is NOT
// advertised — the informational contact form lives at `/#contact`.
// Pricing/blog are opt-in features (site.features.showPricing / showBlog) so
// they are not advertised here — products that enable them add the paths back.
const STATIC_PAGES = [
  { path: '/',              changefreq: 'weekly',  priority: '1.0' },
  { path: '/privacy',       changefreq: 'yearly',  priority: '0.3' },
  { path: '/terms',         changefreq: 'yearly',  priority: '0.3' },
  { path: '/cookies',       changefreq: 'yearly',  priority: '0.2' },
]

function toDateStr(date) {
  if (!date) return null
  return new Date(date).toISOString().split('T')[0]
}

router.get('/sitemap.xml', async (req, res) => {
  // Prefer APP_URL so sitemap always references the canonical production domain,
  // not the Railway *.up.railway.app URL that leaks when crawlers hit the
  // platform-assigned hostname. Fall back to request host for local dev. (#56980)
  const envUrl = process.env.APP_URL
  const appUrl = (envUrl && !envUrl.includes('localhost'))
    ? envUrl.replace(/\/+$/, '')
    : `${req.protocol}://${req.get('host')}`
  const today = toDateStr(new Date())

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

  for (const page of STATIC_PAGES) {
    xml += '  <url>\n'
    xml += `    <loc>${appUrl}${page.path}</loc>\n`
    xml += `    <lastmod>${today}</lastmod>\n`
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`
    xml += `    <priority>${page.priority}</priority>\n`
    xml += '  </url>\n'
  }

  // Append published blog posts — only when the blog module is on (its
  // blog_posts migration is skipped otherwise, and /blog is not routed).
  if (isModuleEnabled('blog')) try {
    const posts = await db.any(
      `SELECT slug, published_at, updated_at FROM blog_posts
       WHERE status = 'published' AND published_at <= NOW()
       ORDER BY published_at DESC`
    )
    for (const post of posts) {
      const lastmod = toDateStr(post.updated_at || post.published_at)
      xml += '  <url>\n'
      xml += `    <loc>${appUrl}/blog/${post.slug}</loc>\n`
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`
      xml += '    <changefreq>monthly</changefreq>\n'
      xml += '    <priority>0.6</priority>\n'
      xml += '  </url>\n'
    }
  } catch (err) {
    // Table may not exist yet (42P01) — gracefully skip blog URLs
  }

  xml += '</urlset>\n'

  res.set('Content-Type', 'application/xml')
  // Public, cacheable for an hour at browsers and shared caches (CloudFront /
  // App Runner edge): the page list changes on deploy, blog posts at most hourly.
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
  res.send(xml)
})

module.exports = router
module.exports.STATIC_PAGES = STATIC_PAGES
