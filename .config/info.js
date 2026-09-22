// Central product config — shared source of truth for both client and server
// @system — do not modify this file directly; override values in config/@custom/

let GENERAL_INFO = {
  name: 'ProductTemplate',
  description: 'Production-ready SaaS starter kit with authentication, Stripe billing, team management, transactional email, and a responsive dashboard. Clone, configure, and deploy in minutes.',
  cta: {
    title: 'Start Today',
    description: 'Join thousands of users transforming their workflow.',
    buttonText: 'Get Started for Free',
  },
  url: 'https://producttemplate.com',
  email: 'hello@producttemplate.com',
  supportEmail: 'hello@producttemplate.com',
  socials: [],
  theme_color: '#6940f8',
  background_color: '#f7f6fe',
  links: {
    faq: 'https://support.producttemplate.com',
    refer_and_earn: 'https://producttemplate.com/refer-and-earn',
  },
  products: {
    monthly: {
      price: 49,
      description: 'Monthly Subscription',
    },
    yearly: {
      price: 397,
      description: 'Yearly Subscription',
    },
  },
  plans: [
    {
      priceId: 'price_REPLACE_ME',
      price: 49,
      yearlyPrice: 397,
      name: 'Pro',
      description: 'Pro Plan',
      paymentLink: '',
      noAllowedRoutes: [],
    },
  ],
  authMode: 'web2', // Options: 'web2' (email/password) or 'web3' (wallet)
  cdn: {
    url: '', // CDN base URL for serving static assets (e.g. https://cdn.example.com)
    authAssetsUrl: '', // CDN URL specifically for auth page assets (overrides cdn.url when set)
  },
}

module.exports = GENERAL_INFO
