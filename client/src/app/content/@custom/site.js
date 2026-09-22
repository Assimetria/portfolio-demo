// @custom — Product-specific overrides for the informational site content.
// This file is NEVER overwritten during template sync.
//
// Highest of the three content layers (config/index.js): it wins over both
// content/@system/site.js and content/@generated/site.brand.js (the latter is
// produced from brand.json `site` — prefer editing brand.json for anything that
// block covers: locale, nav, contact, social, footer, seo, analytics).
// Override any key from content/@system/site.js here. Objects are deep-merged,
// arrays are replaced wholesale (declare the full list when you change one).
// PURE DATA ONLY — evaluated at build time too (scripts/lib/site-content.cjs).
//
// Example:
// export default {
//   features: { showTeam: false, showMap: false },
//   hero: {
//     eyebrow: 'Plumbing & heating, Lisbon',
//     title: 'Fixed today, or the call-out is free.',
//     primaryCta: { label: 'Call now', href: 'tel:+351210000000' },
//   },
//   contact: { email: 'jobs@acme-plumbing.pt', phone: '+351 210 000 000' },
//   map: { lat: 38.72, lng: -9.14, zoom: 16 },
// }

export default {}
