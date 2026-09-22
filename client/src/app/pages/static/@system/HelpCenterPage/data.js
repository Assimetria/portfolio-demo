// @system — Help Center data (categories + articles)
// @custom — update CATEGORIES and ARTICLES with your product's real content
import {
  Zap,
  Shield,
  CreditCard,
  Users,
  Settings,
  LifeBuoy } from 'lucide-react'
import { info } from '@/config'

// ── Data — replace with your own content or fetch from API ───────────────────

export const HELP_CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'New here? Start with the basics.',
    icon: Zap },
  {
    id: 'account',
    title: 'Account & Profile',
    description: 'Manage your account settings and profile.',
    icon: Users },
  {
    id: 'billing',
    title: 'Billing & Plans',
    description: 'Subscriptions, invoices, and plan changes.',
    icon: CreditCard },
  {
    id: 'security',
    title: 'Security & Privacy',
    description: 'Keep your account safe and your data private.',
    icon: Shield },
  {
    id: 'integrations',
    title: 'Integrations & API',
    description: 'Connect your tools and use our API.',
    icon: Settings },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Stuck? Find solutions to common issues.',
    icon: LifeBuoy },
]

export const HELP_ARTICLES = [
  // Getting Started
  {
    id: '1',
    slug: 'quick-start',
    title: 'Quick start guide',
    excerpt: 'Get up and running in under 5 minutes. Create your account, set up your workspace, and launch your first project.',
    categoryId: 'getting-started',
    readingTime: 3,
    tags: ['setup', 'onboarding'],
    content: `
## Quick Start Guide

Welcome to ${info.name}! This guide will walk you through creating your account and launching your first project.

### Step 1 — Create your account

Navigate to the [register page](/auth?tab=register) and fill in your details. You'll receive a verification email — click the link inside to activate your account.

### Step 2 — Set up your workspace

Once logged in, you'll land on your dashboard. Click **New Project** to create your first workspace. Give it a name and choose a plan that fits your needs.

### Step 3 — Invite your team

Go to **Settings → Team** to invite collaborators. Team members receive an email invitation and can join immediately.

### Step 4 — You're ready

That's it. Explore the dashboard, connect your integrations, and start building.
    `.trim() },
  {
    id: '2',
    slug: 'dashboard-overview',
    title: 'Dashboard overview',
    excerpt: 'Understand each section of your dashboard and how to navigate the interface efficiently.',
    categoryId: 'getting-started',
    readingTime: 4,
    tags: ['dashboard', 'navigation'],
    content: `
## Dashboard Overview

Your dashboard is the central hub for all your activity.

### Navigation sidebar

The left sidebar contains your main navigation:

- **Home** — your activity feed and quick stats
- **Projects** — all your active projects
- **API Keys** — manage your API credentials
- **Settings** — account and workspace settings

### Stats panel

The top panel shows key metrics at a glance: total projects, usage this month, and recent activity.

### Quick actions

Use the **+ New** button in the top-right to quickly create a new project, invite a team member, or generate an API key.
    `.trim() },
  // Account
  {
    id: '3',
    slug: 'update-profile',
    title: 'How to update your profile',
    excerpt: 'Change your name, email address, avatar, and notification preferences from your account settings.',
    categoryId: 'account',
    readingTime: 2,
    tags: ['profile', 'settings'],
    content: `
## Updating Your Profile

Go to **Settings → Profile** to update your personal information.

### Name and email

Click the **Edit** button next to your name or email. Changes to your email address require re-verification — you will receive a confirmation link at the new address.

### Avatar

Click on your avatar thumbnail and upload a new image (JPG, PNG, or GIF, max 2 MB).

### Notifications

Under **Settings → Notifications**, toggle email alerts for activity summaries, security events, and product updates.
    `.trim() },
  {
    id: '4',
    slug: 'delete-account',
    title: 'How to delete your account',
    excerpt: 'Permanently delete your account and all associated data. This action cannot be undone.',
    categoryId: 'account',
    readingTime: 2,
    tags: ['account', 'deletion'],
    content: `
## Deleting Your Account

Go to **Settings → Account → Danger Zone** and click **Delete Account**.

You will be asked to type your email address to confirm. Once confirmed, all your data — projects, API keys, billing records — will be permanently deleted within 30 days.

**Note:** If you have an active paid subscription, cancel it first to avoid further charges.
    `.trim() },
  // Billing
  {
    id: '5',
    slug: 'upgrade-plan',
    title: 'How to upgrade your plan',
    excerpt: 'Move from Starter to Pro or Enterprise in just a few clicks. Your new features activate immediately.',
    categoryId: 'billing',
    readingTime: 3,
    tags: ['billing', 'upgrade', 'plans'],
    content: `
## Upgrading Your Plan

Go to **Settings → Billing → Change Plan**.

### Choosing a plan

- **Starter (Free)** — up to 3 projects, community support
- **Pro ($29/mo)** — unlimited projects, priority support, custom domain
- **Enterprise** — custom pricing, SLA, dedicated support

### Payment

We accept all major credit cards. Payment is processed securely via Stripe. You will receive a receipt by email after each charge.

### Prorating

When you upgrade mid-cycle, we prorate the difference and apply it immediately. Your new limits activate right away.
    `.trim() },
  {
    id: '6',
    slug: 'cancel-subscription',
    title: 'How to cancel your subscription',
    excerpt: 'Cancel anytime from your billing settings. You keep access until the end of your billing period.',
    categoryId: 'billing',
    readingTime: 2,
    tags: ['billing', 'cancel'],
    content: `
## Cancelling Your Subscription

Go to **Settings → Billing → Cancel Plan**.

Your subscription will not renew at the next billing date, but you keep full access until the end of the current period.

### Refunds

We offer a 14-day money-back guarantee on all paid plans. Contact support within 14 days of your last payment to request a refund.
    `.trim() },
  // Security
  {
    id: '7',
    slug: 'enable-2fa',
    title: 'Enable two-factor authentication',
    excerpt: 'Add an extra layer of security to your account with an authenticator app or SMS.',
    categoryId: 'security',
    readingTime: 3,
    tags: ['2fa', 'security', 'authentication'],
    content: `
## Enabling Two-Factor Authentication

Go to **Settings → Security → Two-Factor Authentication** and click **Enable**.

### Authenticator app (recommended)

1. Download an authenticator app (Google Authenticator, Authy, 1Password).
2. Scan the QR code displayed on screen.
3. Enter the 6-digit code from the app to confirm setup.

### Backup codes

After enabling 2FA, download your backup codes and store them safely. Each code can be used once if you lose access to your authenticator app.

### Disabling 2FA

Go to **Settings → Security** and click **Disable 2FA**. You will be asked to enter a code from your authenticator app to confirm.
    `.trim() },
  // Integrations
  {
    id: '8',
    slug: 'api-keys',
    title: 'Generating and using API keys',
    excerpt: 'Create API keys to integrate with external tools and automate your workflows programmatically.',
    categoryId: 'integrations',
    readingTime: 4,
    tags: ['api', 'keys', 'integration'],
    content: `
## API Keys

Go to **API Keys** in your dashboard sidebar to manage your keys.

### Creating a key

Click **New Key**, give it a descriptive name (e.g. "Production server"), and copy the key immediately — it will not be shown again.

### Using the key

Include your API key in the \`Authorization\` header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

### Rotating keys

To rotate a key, create a new one, update your integrations, and then delete the old key.

### Rate limits

API keys are subject to rate limits based on your plan. Pro and Enterprise plans have higher limits. See our [API docs](/help) for details.
    `.trim() },
  // Troubleshooting
  {
    id: '9',
    slug: 'cant-login',
    title: "Can't log in to your account",
    excerpt: "Forgot your password or locked out? Here's how to regain access quickly.",
    categoryId: 'troubleshooting',
    readingTime: 3,
    tags: ['login', 'password', 'access'],
    content: `
## Can't Log In

### Forgot your password

Go to the [forgot password page](/forgot-password), enter your email, and check your inbox for a reset link. The link expires after 1 hour.

### Account locked

After multiple failed login attempts, your account may be temporarily locked. Wait 15 minutes and try again, or use the password reset flow.

### Email not verified

If you see "Email not verified", check your inbox for the original verification email and click the link. If it expired, log in and request a new one from the banner that appears.

### Still stuck?

Contact us at [${info.supportEmail}](mailto:${info.supportEmail}) and we'll help you recover access.
    `.trim() },
]

// ── Search logic ──────────────────────────────────────────────────────────────

export function searchArticles(articles, query){
  if (!query.trim()) return articles
  const q = query.toLowerCase()
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      (a.tags ?? []).some((t) => t.toLowerCase().includes(q)),
  )
}
