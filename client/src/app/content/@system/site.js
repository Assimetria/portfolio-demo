// @system — Informational website content model (template defaults).
//
// This is the lowest of THREE content layers merged in client/src/config/index.js
// (objects merge per key, arrays are replaced wholesale, unset keys fall through):
//   1. this file                      — template defaults, overwritten on template sync
//   2. content/@generated/site.brand.js — emitted by scripts/apply-brand.js from the
//                                         repo-root brand.json `site` block (provisioning)
//   3. content/@custom/site.js          — hand-written product overrides, never overwritten
// A product only needs to declare what differs.
//
// Defaults describe a fictional consultancy, "Northwind Advisory", so the
// template renders a complete, believable site before any customisation.
// Nothing here is fabricated social proof for a real company — replace it.
//
// `services.items[].icon` is a lucide-react icon name (PascalCase string),
// resolved at runtime by components/@system/site/icons.js with a safe fallback.
//
// PURE DATA ONLY: this module is also evaluated at build time (scripts/lib/
// site-content.cjs) to produce the index.html fallback, JSON-LD and <html lang>,
// so it must not import anything.

export default {
  // ── Locale — <html lang>, og:locale, JSON-LD inLanguage (BCP-47) ─────────
  locale: 'en',

  // ── SEO — build-time <head> + JSON-LD (scripts/lib/site-html.cjs) ────────
  seo: {
    titleTemplate: '{name} - {tagline}', // placeholders: {name} {tagline}
    description: '', // empty → brand.json description
    ogImage: '/assets/og/og-image.png',
    businessType: 'ProfessionalService', // schema.org type of the JSON-LD business node
  },

  // ── Analytics — external script only (CSP forbids inline) ────────────────
  // provider: 'none' | 'plausible' (id = domain, empty → PLAUSIBLE_DOMAIN env at
  // container start) | 'umami' (id = website id; add the host to CSP scriptSrc).
  analytics: { provider: 'none', id: '' },

  // ── Feature flags — gate whole sections and cross-links ──────────────────
  features: {
    showAuth: true, // Login link in navbar; /auth still works regardless
    showBlog: false, // /blog links in nav/footer
    showPricing: false, // /pricing links in nav/footer (Stripe optional)
    showTeam: true,
    showTestimonials: true,
    showMap: true,
    showContactForm: true,
  },

  // ── Navigation ───────────────────────────────────────────────────────────
  nav: {
    links: [
      { label: 'About', href: '#about' },
      { label: 'Services', href: '#services' },
      { label: 'Team', href: '#team' },
      { label: 'Testimonials', href: '#testimonials' },
      { label: 'Contact', href: '#contact' },
    ],
    ctaLabel: 'Book a consultation',
    ctaHref: '#contact',
  },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    eyebrow: 'Independent strategy consultancy',
    title: 'Clear thinking for complicated decisions.',
    subtitle:
      'Northwind Advisory helps founders, boards and operating teams make better calls on strategy, pricing and growth — without the forty-slide deck.',
    primaryCta: { label: 'Book a consultation', href: '#contact' },
    secondaryCta: { label: 'See our services', href: '#services' },
    // Leave src empty to render the built-in decorative panel instead of a photo.
    image: {
      src: '',
      alt: 'Northwind Advisory team reviewing a strategy board',
    },
  },

  // ── About ────────────────────────────────────────────────────────────────
  about: {
    title: 'A small firm built for decisive work',
    body: [
      'We are a team of former operators and analysts who spent a decade running growth, pricing and finance functions before advising on them. That means we care about what happens after the recommendation.',
      'Engagements are short, senior-led and priced up front. You get the people you met in the first call, a written plan you can act on, and a follow-up review once it is live.',
    ],
    highlights: [
      { label: 'Years in practice', value: '12' },
      { label: 'Engagements completed', value: '140+' },
      { label: 'Repeat clients', value: '68%' },
      { label: 'Average engagement', value: '6 weeks' },
    ],
    image: {
      src: '',
      alt: 'The Northwind Advisory office',
    },
  },

  // ── Services ─────────────────────────────────────────────────────────────
  services: {
    title: 'What we do',
    subtitle: 'Focused engagements with a defined outcome, not open-ended retainers.',
    items: [
      {
        icon: 'Compass',
        title: 'Strategy reviews',
        description:
          'A six-week diagnostic of where the business is winning and losing, ending in three to five decisions the leadership team commits to.',
        href: '#contact',
      },
      {
        icon: 'Tags',
        title: 'Pricing and packaging',
        description:
          'Research-backed pricing changes, from tier structure to discount policy, with a rollout plan that protects existing customers.',
        href: '#contact',
      },
      {
        icon: 'TrendingUp',
        title: 'Growth operating model',
        description:
          'Design the metrics, cadences and ownership that let a growth team run without a founder in every meeting.',
        href: '#contact',
      },
      {
        icon: 'Landmark',
        title: 'Board and investor readiness',
        description:
          'Narrative, numbers and the awkward questions — prepared before the room asks them.',
        href: '#contact',
      },
      {
        icon: 'Handshake',
        title: 'Commercial due diligence',
        description:
          'Independent view of a target’s market, customers and pricing power for acquirers and investors.',
        href: '#contact',
      },
      {
        icon: 'GraduationCap',
        title: 'Leadership workshops',
        description:
          'Half-day and full-day sessions on decision-making, prioritisation and running an effective operating review.',
        href: '#contact',
      },
    ],
  },

  // ── Team ─────────────────────────────────────────────────────────────────
  team: {
    title: 'The people you will work with',
    subtitle: 'Senior partners lead every engagement from first call to final review.',
    members: [
      {
        name: 'Helena Marques',
        role: 'Managing Partner',
        bio: 'Former COO of a B2B software company; leads strategy and pricing engagements.',
        photo: '',
        links: { linkedin: 'https://www.linkedin.com/', email: 'helena@example.com' },
      },
      {
        name: 'Daniel Osei',
        role: 'Partner, Growth',
        bio: 'Built and ran growth teams at two marketplaces before joining Northwind.',
        photo: '',
        links: { linkedin: 'https://www.linkedin.com/', twitter: 'https://x.com/' },
      },
      {
        name: 'Priya Natarajan',
        role: 'Principal, Research',
        bio: 'Leads customer research and commercial diligence; ex-equity analyst.',
        photo: '',
        links: { linkedin: 'https://www.linkedin.com/' },
      },
      {
        name: 'Tomás Ferreira',
        role: 'Associate Partner',
        bio: 'Runs board and investor readiness work; former finance director.',
        photo: '',
        links: { email: 'tomas@example.com' },
      },
    ],
  },

  // ── Testimonials ─────────────────────────────────────────────────────────
  testimonials: {
    title: 'What clients say',
    items: [
      {
        quote:
          'We had debated pricing for two years. Northwind gave us a decision in six weeks and a rollout that did not lose a single enterprise account.',
        author: 'Sara Lindqvist',
        role: 'CEO',
        company: 'Fjord Analytics',
        avatar: '',
        rating: 5,
      },
      {
        quote:
          'The strategy review was the first time our board and management team agreed on the three things that mattered. Worth every hour.',
        author: 'Marcus Ahmed',
        role: 'Chair',
        company: 'Brightline Logistics',
        avatar: '',
        rating: 5,
      },
      {
        quote:
          'Direct, well-prepared, and honest about what they did not know. That is rarer than it should be in advisory work.',
        author: 'Inês Carvalho',
        role: 'Founder',
        company: 'Terra Foods',
        avatar: '',
        rating: 5,
      },
    ],
  },

  // ── Contact ──────────────────────────────────────────────────────────────
  contact: {
    title: 'Let’s talk',
    subtitle:
      'Tell us a little about the decision you are facing. We reply within one working day.',
    email: 'hello@example.com',
    phone: '+351 210 000 000',
    // `lines` is what the contact card shows; the structured fields feed the
    // JSON-LD PostalAddress. brand.json `site.contact.address` may give either.
    address: {
      lines: ['Rua do Norte 42, 3º', '1200-286 Lisboa', 'Portugal'],
      street: 'Rua do Norte 42, 3º',
      postalCode: '1200-286',
      city: 'Lisboa',
      region: '',
      country: 'Portugal',
    },
    hours: ['Monday – Friday, 09:00 – 18:00 WET', 'Closed on public holidays'], // display copy
    openingHours: ['Mo-Fr 09:00-18:00'], // schema.org openingHours format (JSON-LD)
    formFields: {
      name: { label: 'Name', placeholder: 'Your name', required: true },
      email: { label: 'Email', placeholder: 'you@company.com', required: true },
      phone: { label: 'Phone', placeholder: '+351 …', required: false, show: true },
      subject: { label: 'Subject', placeholder: 'What is this about?', required: false, show: true },
      message: { label: 'Message', placeholder: 'A few sentences is plenty.', required: true, minLength: 10 },
      submitLabel: 'Send message',
    },
    successMessage: 'Thank you — your message is on its way. We will be in touch within one working day.',
  },

  // ── Map ──────────────────────────────────────────────────────────────────
  // provider: 'osm' (OpenStreetMap iframe, no API key) | 'google' (needs embedUrl) | 'none'
  map: {
    provider: 'osm',
    lat: 38.7108,
    lng: -9.1431,
    zoom: 15,
    embedUrl: '',
    address: 'Rua do Norte 42, 1200-286 Lisboa, Portugal',
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    tagline: 'Clear thinking for complicated decisions.',
    columns: [
      {
        title: 'Company',
        links: [
          { label: 'About', href: '#about' },
          { label: 'Team', href: '#team' },
          { label: 'Contact', href: '#contact' },
        ],
      },
      {
        title: 'Services',
        links: [
          { label: 'Strategy reviews', href: '#services' },
          { label: 'Pricing and packaging', href: '#services' },
          { label: 'Due diligence', href: '#services' },
        ],
      },
    ],
    social: {
      linkedin: 'https://www.linkedin.com/',
      twitter: '',
      github: '',
      youtube: '',
      email: 'mailto:hello@example.com',
    },
    legalLinks: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
    copyright: '', // empty → "© {year} {info.name}. All rights reserved."
  },
}
