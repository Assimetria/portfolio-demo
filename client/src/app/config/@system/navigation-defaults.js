// @system — Default navigation pages
// Every product inherits these automatically.
// Products can override any entry by declaring the same `path` in @custom/navigation.js.
// System defaults cover: settings, profile, notifications, billing.
// These are the "boring but essential" pages every SaaS needs.

/**
 * Default section definitions.
 * Products can override by declaring sections with the same `key`.
 * @type {Array<{key: string, label: string|null, order: number}>}
 */
export const systemSections = [
  { key: 'main',    label: null,        order: 1 },
  { key: 'account', label: 'Account',   order: 90 },
]

/**
 * Default navigation pages.
 * Products get these for free. Override by path in @custom/navigation.js.
 * @type {import('./navigation-merge').PageEntry[]}
 */
export const systemPages = [
  // ── Main ──────────────────────────────────────────────
  {
    path: '/app',
    label: 'Home',
    icon: 'Home',
    sidebar: true,
    topbar: false,
    section: 'main',
    order: 1,
    requiresAuth: true,
  },

  // ── Main ──────────────────────────────────────────────
  {
    path: '/app/notifications',
    label: 'Notifications',
    icon: 'Bell',
    sidebar: true,
    topbar: false,
    section: 'main',
    order: 2,
    requiresAuth: true,
    // Badge dot shows the live unread count (fed by AppLayout via `badges.inbox`).
    badgeKey: 'inbox',
    badgeColor: 'default',
  },
  {
    // Informational template: admin inbox for website contact-form submissions.
    path: '/app/contact',
    label: 'Contact inbox',
    icon: 'Inbox',
    sidebar: true,
    topbar: false,
    section: 'main',
    order: 3,
    requiresAuth: true,
    requiredRole: 'admin',
  },

  // ── Account ───────────────────────────────────────────,
  {
    path: '/app/profile',
    label: 'Profile',
    icon: 'User',
    sidebar: true,
    topbar: true,
    section: 'account',
    order: 91,
    requiresAuth: true,
  },
  {
    path: '/app/billing',
    label: 'Billing',
    icon: 'CreditCard',
    sidebar: true,
    topbar: false,
    section: 'account',
    order: 92,
    requiresAuth: true,
    // Feature module (brand.json `modules.billing`): hidden by
    // filterPagesByModules() when billing is off.
    module: 'billing',
  },
]
