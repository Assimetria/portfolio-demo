// @system — Blog seed data (categories + fallback posts)
import { info } from '@/config'
import { text } from '@/config'

const bt = text.blog ?? {}

// ── Data — override categories via @custom/text blog.categories ───────────────

export const BLOG_CATEGORIES = bt.categories?.length
  ? bt.categories
  : ['All', 'Product', 'Engineering', 'Design', 'Company', 'Tutorials']

export const BLOG_POSTS = [
  {
    id: '1',
    slug: 'welcome-to-our-blog',
    title: 'Welcome to our blog',
    excerpt:
      'Introducing our blog where we share product updates, engineering deep-dives, design thinking, and company news.',
    category: 'Company',
    author: 'The Team',
    publishedAt: '2024-01-15',
    readingTime: 2,
    tags: ['announcement', 'company'],
    content: `
## Welcome to our blog

We're excited to launch our official blog — a place where we'll share what we're building, how we're building it, and why we make the decisions we do.

### What to expect

- **Product updates** — new features, improvements, and what's coming next
- **Engineering posts** — technical deep-dives on our architecture and the problems we solve
- **Design thinking** — how we approach UX, accessibility, and visual design
- **Company news** — team growth, milestones, and behind-the-scenes stories

### Stay in the loop

Subscribe to our newsletter or follow us on social media to be notified when we publish new posts. We aim to publish at least twice a month.

Thanks for being here.
    `.trim() },
  {
    id: '2',
    slug: 'how-we-built-our-auth-system',
    title: 'How we built our authentication system',
    excerpt:
      'A walkthrough of the trade-offs we considered when designing our auth flow — from password hashing to 2FA and session management.',
    category: 'Engineering',
    author: 'Engineering Team',
    publishedAt: '2024-02-03',
    readingTime: 7,
    tags: ['engineering', 'security', 'auth'],
    content: `
## How we built our authentication system

Authentication is one of those things that looks simple on the surface but hides a lot of complexity. Here's how we approached it.

### Password storage

We use **bcrypt** with a cost factor of 12 for all password hashes. We never store plaintext passwords or reversible hashes. On every login we re-verify against the stored hash.

### Session management

We use short-lived JWTs (15 minutes) paired with rotating refresh tokens stored in HttpOnly cookies. This gives us the statelessness of JWTs while limiting the blast radius of a stolen token.

### Two-factor authentication

We support TOTP-based 2FA via standard authenticator apps. Backup codes are generated at setup time and stored bcrypt hashes so they can only be used once.

### Rate limiting

Login endpoints are rate-limited per IP and per account to prevent brute-force attacks. After 5 failed attempts, a progressive back-off is applied.

### What's next

We're currently working on passkey (WebAuthn) support and will write a follow-up post once it's live.
    `.trim() },
  {
    id: '3',
    slug: 'design-system-v2',
    title: 'Introducing our design system v2',
    excerpt:
      `We rebuilt our component library from scratch. Here's what changed, why we did it, and how it makes building faster.`,
    category: 'Design',
    author: 'Design Team',
    publishedAt: '2024-03-12',
    readingTime: 5,
    tags: ['design', 'components', 'ui'],
    content: `
## Introducing our design system v2

After two years of incremental patches, we decided to rebuild our component library from scratch. Here's what we learned.

### Why we rebuilt

The original system grew organically. Over time it accumulated inconsistencies: 17 different shades of grey, three different button sizes that didn't align on a grid, and components that were hard to theme.

### What changed

- **Tokens over magic numbers** — all colours, spacing, and typography are now CSS custom properties sourced from a single token file
- **Accessible by default** — every interactive component ships with proper ARIA attributes and passes WCAG AA contrast requirements
- **Dark mode** — first-class support via the CSS \`prefers-color-scheme\` media query and a manual toggle

### The result

Component count dropped from 94 to 61. Build times are faster. And our designers and engineers now speak the same language.
    `.trim() },
  {
    id: '4',
    slug: 'shipping-faster-with-feature-flags',
    title: 'Shipping faster with feature flags',
    excerpt:
      `Feature flags let us decouple deployment from release. Here's how we use them to ship more confidently.`,
    category: 'Engineering',
    author: 'Engineering Team',
    publishedAt: '2024-04-20',
    readingTime: 6,
    tags: ['engineering', 'deployment', 'best-practices'],
    content: `
## Shipping faster with feature flags

Deploying to production is not the same to users. Feature flags are the bridge between the two.

### What are feature flags?

A feature flag is a conditional in your code that lets you turn a feature on or off without a deployment. Flags can target all users, a percentage, or a specific cohort.

### How we use them

- **Trunk-based development** — engineers merge to main daily. Unfinished work is behind a flag so it doesn't affect users.
- **Gradual rollouts** — new features start at 1% of users, then 10%, then 100%. We monitor error rates and latency at each stage.
- **Kill switches** — if a feature causes problems in production, we can turn it off in seconds without a rollback.

### The tooling

We evaluated several vendors and eventually built a lightweight in-house solution backed by our database. The overhead is a single DB read per request, cached in memory for 30 seconds.

### Lessons learned

Flags are powerful but they add cognitive overhead. We enforce a policy: every flag gets a ticket for removal within 90 days of full rollout.
    `.trim() },
  {
    id: '5',
    slug: 'product-update-q1-2024',
    title: 'Product update: Q1 2024',
    excerpt:
      `A roundup of everything we shipped in the first quarter — new integrations, performance improvements, and a sneak peek at what's coming in Q2.`,
    category: 'Product',
    author: 'Product Team',
    publishedAt: '2024-04-01',
    readingTime: 4,
    tags: ['product', 'updates'],
    content: `
## Product update: Q1 2024

Here's everything we shipped between January and March.

### New features

- **Two-factor authentication** — protect your account with TOTP-based 2FA
- **API key scoping** — create keys with read-only or write permissions
- **Dark mode** — system default or manual toggle via Settings
- **CSV export** — download your data from any list view

### Performance improvements

We reduced average page load time by 40% by moving to server-side rendering for static pages and implementing aggressive caching on our API.

### Integrations

We added native integrations with Slack (notifications), GitHub (activity feed), and Zapier (automate anything).

### Coming in Q2

- Team permissions and roles
- Audit log
- Custom webhooks
- Mobile app (beta)

As always, thank you for your feedback. Keep it coming.
    `.trim() },
  {
    id: '6',
    slug: 'getting-started-tutorial',
    title: 'Getting started: a step-by-step tutorial',
    excerpt:
      'New to the platform? This tutorial walks you through creating your first project and inviting your team in under 10 minutes.',
    category: 'Tutorials',
    author: 'The Team',
    publishedAt: '2024-05-08',
    readingTime: 8,
    tags: ['tutorial', 'onboarding', 'getting-started'],
    content: `
## Getting started: a step-by-step tutorial

This tutorial will take you from zero to a fully set-up workspace in under 10 minutes.

### Step 1 — Create your account

Go to [/auth?tab=register](/auth?tab=register) and fill in your name, email, and a strong password. You'll receive a verification email — click the link to activate your account.

### Step 2 — Create your first project

Once logged in, click the **+ New Project** button in the top-right corner. Give your project a name and an optional description, then click **Create**.

### Step 3 — Invite your team

Go to **Settings → Team** and enter the email addresses of your collaborators. Each person will receive an invitation email with a link to join.

### Step 4 — Generate an API key

Navigate to **API Keys** in the sidebar. Click **New Key**, name it something descriptive (e.g. "Staging server"), and copy the key. Store it securely — it won't be shown again.

### Step 5 — Explore integrations

Head to **Settings → Integrations** to connect Slack, GitHub, and other tools. Each integration has a step-by-step setup wizard.

### You're ready

That's all it takes. If you have questions, check out our [Help Center](/help) or reach out to [${info.supportEmail}](mailto:${info.supportEmail}).
    `.trim() },
]
