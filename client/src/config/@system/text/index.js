// @system — Default text/copy for all pages. Overwritten during template sync.
// Products override in @custom/text/index.js — deep-merged at build time.
export const text = {
  landing: {
    hero: {
      title: 'Build faster. Launch sooner.',
      subtitle: 'The production-ready SaaS starter that handles auth, billing, teams, and more — so you can focus on your product.',
      cta: 'Get Started Free',
      ctaSecondary: 'View Pricing',
      ctaSecondaryLink: '/#pricing',
    },
    stats: [
      { value: '1,200+', label: 'Active teams' },
      { value: '<30 min', label: 'To first deploy' },
      { value: '99.9%', label: 'Uptime SLA' },
      { value: '24/7', label: 'Support included' },
    ],
    logoCompanies: ['Acme SaaS', 'Launchpad', 'Northforge', 'Shipkit', 'Solaris', 'Keystone'],
    socialProof: {
      rating: '4.9/5',
      ratingLabel: 'Rated ',
      heading: 'Trusted by teams at',
    },
    testimonials: [],
    faq: [],
    plans: [],
    blogTitle: 'Latest from the blog',
    blogSubtitle:
      'Guides, engineering deep-dives, and product updates from the team.',
    blogCta: 'View all articles',
    blogCtaLink: '/blog',
  },
  pricing: {
    title: 'Simple, transparent pricing',
    subtitle: 'Start free. Upgrade when you need more.',
  },
  auth: {
    loginTitle: 'Welcome back',
    loginSubtitle: 'Sign in to your account',
    registerTitle: 'Create your account',
    registerSubtitle: 'Start your free trial today',
  },
  blog: {
    title: 'Blog',
    subtitle: 'Product updates, engineering deep-dives, design thinking, and more.',
    categories: ['All', 'Product', 'Engineering', 'Design', 'Company', 'Tutorials'],
  },
  footer: {
    tagline: null,
    copyright: null,
  },
  notFound: {
    title: 'Page not found',
    subtitle: 'The page you are looking for does not exist or has been moved.',
    cta: 'Go home',
  },
}
