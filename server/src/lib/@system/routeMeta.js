// @system — Per-route SEO metadata for SPA meta injection (#35132)
// Products override in @custom/routeMeta.js with product-specific copy.
// Template defaults use brand.json values (name, tagline) injected at build.

const path = require('path')

let brand = {}
try {
  brand = require(path.resolve(process.cwd(), 'brand.json'))
} catch (_) {
  try { brand = require('/app/brand.json') } catch (_) {}
}

const name = brand.name || brand.companyName || 'ProductTemplate'
const tagline = brand.tagline || 'Your product tagline here'

// Route metadata map — keys are route paths (exact and prefix matched).
// Products should create server/src/lib/@custom/routeMeta.js with the same
// export shape to add product-specific SEO copy.
const routes = {
  '/pricing': {
    title: `Pricing — ${name}`,
    description: `Simple, transparent pricing for ${name}. Start free, upgrade as you grow.`,
  },
  '/blog': {
    title: `Blog — ${name}`,
    description: `Latest updates, tutorials, and insights from the ${name} team.`,
  },
  '/about': {
    title: `About — ${name}`,
    description: `Learn about ${name} — ${tagline}.`,
  },
  '/help': {
    title: `Help Center — ${name}`,
    description: `Get help with ${name}. Browse articles, guides, and FAQs.`,
  },
  '/contact': {
    title: `Contact — ${name}`,
    description: `Get in touch with the ${name} team.`,
  },
  '/careers': {
    title: `Careers — ${name}`,
    description: `Join the ${name} team. See open positions and apply.`,
  },
  '/changelog': {
    title: `Changelog — ${name}`,
    description: `See what's new in ${name}. Latest updates and improvements.`,
  },
  '/docs': {
    title: `Documentation — ${name}`,
    description: `${name} documentation. Guides, API reference, and examples.`,
  },
  '/terms': {
    title: `Terms of Service — ${name}`,
    description: `Terms of service for ${name}.`,
  },
  '/privacy': {
    title: `Privacy Policy — ${name}`,
    description: `Privacy policy for ${name}.`,
  },
  '/cookies': {
    title: `Cookie Policy — ${name}`,
    description: `Cookie policy for ${name}.`,
  },
  '/dpa': {
    title: `Data Processing Agreement — ${name}`,
    description: `Data Processing Agreement (DPA) for ${name} — GDPR-compliant terms covering how personal data is processed, sub-processors, security measures, and data subject rights.`,
  },
  '/refund-policy': {
    title: `Refund Policy — ${name}`,
    description: `Refund policy for ${name}.`,
  },
  '/auth': {
    title: `Sign In — ${name}`,
    description: `Sign in to your ${name} account.`,
  },
}

const defaults = {
  title: `${name} — ${tagline}`,
  description: tagline,
}

/**
 * Look up SEO metadata for a given pathname.
 * Exact match first, then longest prefix match (e.g., /blog/my-post → /blog).
 */
function getRouteMeta(pathname) {
  if (routes[pathname]) return { ...defaults, ...routes[pathname] }

  // Prefix match for nested routes (e.g., /blog/my-post, /help/getting-started)
  const prefix = Object.keys(routes)
    .filter(k => pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0]

  if (prefix) return { ...defaults, ...routes[prefix] }
  return defaults
}

module.exports = { routes, defaults, getRouteMeta }
