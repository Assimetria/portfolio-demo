# Informational Website Template — Specification

Template repo: `Assimetria/product-template-informational` (fork of `Assimetria/product-template`, v2.0.0).
Target: simple informational websites — consultancies, VC and law firms, restaurants, trades, studios, portfolios.

The full SaaS foundation is retained (auth, admin, legal pages, theme, brand pipeline, CI, Docker). What changes is the **front door**: `/` renders `SitePage`, a single-page site composed from a content model, with a working contact form that lands in an admin inbox.

---

## 1. Content model

Three layers, **deep-merged** in `client/src/config/index.js` (objects merge key-by-key, arrays are replaced wholesale, unset keys fall through) and exported as `site`; `useSite()` returns the same object. Lowest to highest precedence:

| Layer | File | Written by |
|-------|------|-----------|
| 1 — template defaults | `client/src/app/content/@system/site.js` | template (overwritten on template sync) |
| 2 — provisioning | `client/src/app/content/@generated/site.brand.js` | **generated** by `scripts/apply-brand.js` from the repo-root `brand.json` `site` block on every prebuild; tracked in git like `config/@custom/info.js` so `npm test` works without a prebuild; never hand-edit |
| 3 — product overrides | `client/src/app/content/@custom/site.js` | hand-written (`export default { … }`), never overwritten |

The merge rule lives once in `scripts/lib/site-brand.cjs` (`deepMerge`, `mergeSiteLayers`) and is shared by the browser bundle, `apply-brand.js`, `client/webpack.config.mjs` and `client/scripts/prerender.mjs`, so build-time HTML (§9) and runtime React can never disagree about what the site says.

All three content modules must be **pure data** (no imports): they are also evaluated at build time by `scripts/lib/site-content.cjs` (Babel → CommonJS, `require` throws) to produce `index.html`. An import fails the build with a pointed message instead of silently shipping the Northwind defaults.

```js
import { site, useSite } from '@/config'
site.hero.title
site.features.showTeam
```

### `brand.json` `site` block (layer 2 input)

Orkosi provisioning writes only `brand.json`. The `site` key carries the fields a provisioning form can know; everything else (hero copy, services, team…) stays in the content files. Empty strings / arrays / objects are pruned by `brandSiteToContent`, so an unset field falls through to layer 1 instead of blanking it.

```jsonc
"site": {
  "locale": "en",                                   // BCP-47 → <html lang>, og:locale, JSON-LD inLanguage
  "nav": [{ "label": "About", "href": "#about" }],  // → nav.links (replaces the list)
  "navCta": { "label": "", "href": "" },            // optional → nav.ctaLabel / ctaHref
  "contact": {
    "email": "", "phone": "+351 210 000 000",
    "address": { "street": "…", "postalCode": "…", "city": "…", "region": "", "country": "…" },
                                                    // or a string, or ["line", "line"]; display `lines` are derived
    "hours": ["Monday – Friday, 09:00 – 18:00 WET"],// display copy
    "openingHours": ["Mo-Fr 09:00-18:00"]           // schema.org format → JSON-LD openingHours
  },
  "social": { "linkedin": "", "twitter": "", "github": "", "youtube": "", "instagram": "", "facebook": "", "email": "" },
                                                    // → footer.social (http(s) values also feed JSON-LD sameAs)
  "footer": { "tagline": "", "copyright": "", "columns": [], "legalLinks": [] },
  "seo": {
    "titleTemplate": "{name} - {tagline}",          // placeholders {name} {tagline}
    "description": "",                              // empty → brand.json description
    "ogImage": "/assets/og/og-image.png",
    "businessType": "ProfessionalService"           // schema.org type of the JSON-LD business node
  },
  "analytics": { "provider": "none", "id": "" }     // none | plausible (id = domain, empty → PLAUSIBLE_DOMAIN env) | umami (id required)
}
```

Regenerate after editing: `npm run apply-brand` (or any build). Tests: `client/src/test/@system/site-brand.test.js`, `apply-brand.test.js`, `config-resolver.test.js`.

### Shape

| Key | Fields |
|-----|--------|
| `locale` | BCP-47 language tag (`'en'`, `'pt-PT'`) — `<html lang>`, `og:locale`, JSON-LD `inLanguage` |
| `seo` | `titleTemplate`, `description`, `ogImage`, `businessType` — build-time `<head>` + JSON-LD (§9) |
| `analytics` | `provider` `'none' \| 'plausible' \| 'umami'`, `id` — external `<script>` in `index.html`, never inline (CSP) |
| `features` | `showAuth`, `showBlog`, `showPricing`, `showTeam`, `showTestimonials`, `showMap`, `showContactForm` (booleans) |
| `nav` | `links[] {label, href}`, `ctaLabel`, `ctaHref` |
| `hero` | `eyebrow`, `title`, `subtitle`, `primaryCta {label, href}`, `secondaryCta {label, href}`, `image {src, alt}` |
| `about` | `title`, `body[]` (paragraphs), `highlights[] {label, value}`, `image {src, alt}` |
| `services` | `title`, `subtitle`, `items[] {icon, title, description, href}` — `icon` is a lucide-react icon name string (`"Compass"`, `"Wrench"`), resolved by `components/@system/site/icons.jsx` with a safe fallback (`Sparkles`) |
| `team` | `title`, `subtitle`, `members[] {name, role, bio, photo, links {linkedin, twitter, email}}` — empty `photo` renders an initials avatar |
| `testimonials` | `title`, `items[] {quote, author, role, company, avatar, rating}` (`rating` 0–5) |
| `contact` | `title`, `subtitle`, `email`, `phone`, `address {lines[], street, postalCode, city, region, country}` (`lines` is displayed; the structured fields feed the JSON-LD `PostalAddress`), `hours[]` (display), `openingHours[]` (schema.org `Mo-Fr 09:00-18:00`), `formFields {name, email, phone, subject, message, submitLabel}` (each field: `label`, `placeholder`, `required`, `show`, `minLength`), `successMessage` |
| `map` | `provider` `'osm' \| 'google' \| 'none'`, `lat`, `lng`, `zoom`, `embedUrl` (Google only), `address` |
| `footer` | `tagline`, `columns[] {title, links[] {label, href}}`, `social {linkedin, twitter, github, youtube, instagram, facebook, email}`, `legalLinks[] {label, href}`, `copyright` (empty → `© {year} {info.name}. All rights reserved.`) |

`href` values may be `#anchor` (smooth-scroll on `/`, navigates to `/#anchor` from other routes), an internal route (`/privacy`), or external (`https://`, `mailto:`, `tel:`). `components/@system/site/SmartLink.jsx` handles all three.

Defaults describe a fictional consultancy, *Northwind Advisory*, so the template renders a complete site before customisation. Replace everything for a real product.

### Minimal override example (plumber)

```js
// client/src/app/content/@custom/site.js
export default {
  features: { showTeam: false, showTestimonials: true, showAuth: false },
  nav: { ctaLabel: 'Call now', ctaHref: 'tel:+351210000000' },
  hero: {
    eyebrow: 'Plumbing & heating · Lisbon',
    title: 'Fixed today, or the call-out is free.',
    primaryCta: { label: 'Call now', href: 'tel:+351210000000' },
    secondaryCta: { label: 'Request a quote', href: '#contact' },
  },
  services: { items: [ { icon: 'Wrench', title: 'Emergency repairs', description: '…', href: '#contact' } ] },
  contact: { email: 'jobs@acme-plumbing.pt', phone: '+351 210 000 000' },
  map: { lat: 38.72, lng: -9.14, zoom: 16 },
}
```

---

## 2. Sections and components

`client/src/app/components/@system/site/`:

| Component | Section id | Notes |
|-----------|-----------|-------|
| `SiteNavbar` | — | sticky, anchor links, CTA, theme toggle (`data-testid="theme-toggle"`), mobile drawer (`data-testid="mobile-menu-button"`); Log in / Dashboard only when `features.showAuth` |
| `Hero` | `#hero` | decorative brand panel when `hero.image.src` is empty |
| `About` | `#about` | highlight stats as `<dl>` |
| `Services` | `#services` | 1/2/3-column grid, whole card is the link when `href` set |
| `Team` | `#team` | initials avatar fallback |
| `Testimonials` | `#testimonials` | star rating with `aria-label` |
| `ContactSection` | `#contact` | contact cards + `ContactForm` + `MapEmbed`, gated by `showContactForm` / `showMap` |
| `ContactForm` | — | POST `/api/contact`, client validation mirrors server, honeypot `website` field, real success/error states (`data-testid="contact-form" / "contact-success" / "contact-error"`) |
| `MapEmbed` | — | OSM iframe from lat/lng/zoom (no key); Google iframe from `embedUrl`; address card when `provider === 'none'` (`data-testid="map-embed" / "map-fallback"`) |
| `SiteFooter` | — | columns, social, legal bar; `/pricing`, `/blog`, `/auth` links filtered by flags |

Page: `client/src/app/pages/static/@system/SitePage/index.jsx` composes Hero → About → Services → Team → Testimonials → Contact(+Map) → Footer, each gated by flags/content. `pages/static/@custom/SitePage` delegates to it — edit that file to change composition.

Routing (`routes/@system/AppRoutes.jsx` → `systemRoutes`): `/` → SitePage (via the @custom delegate); `/saas-landing` → the original SaaS LandingPage (reference only, `robots.txt` disallows it); `/app/contact` → `ContactSubmissionsPage` (admin).

### Styling

Tailwind + brand tokens from `client/src/app/styles/@custom/brand.css` (generated from `brand.json` by `scripts/apply-brand.js` during prebuild): `bg-brand-bg`, `bg-brand-surface`, `border-brand-border`, `text-brand-text`, `text-brand-text-secondary`, `text-brand-text-muted`, `bg-brand-primary`, `text-brand-primary`. Dark mode is driven by `<html data-theme="dark">` (Tailwind `darkMode: ['selector', '[data-theme="dark"]']`); `ThemeProvider` and the pre-paint bootstrap set the attribute.

All sections are `<section id="…" aria-labelledby="…-title">`, mobile-first, with visible focus rings.

---

## 3. Contact API

`server/src/api/@system/contact/index.js` (registered by the auto-generated barrel `server/src/routes/@system/index.js`).

SQL lives in `server/src/db/repos/@system/ContactRepo.js`; the router only handles HTTP. Envelope: `{ data }` single resource, `{ data, pagination }` lists, `{ message }` errors and message-only successes.

| Method | Path | Auth | Behaviour |
|--------|------|------|-----------|
| `GET` | `/api/contact/config` | public (cached 5 min) | `{ data: { retentionDays, turnstile: { siteKey } } }` — `siteKey` is non-empty only when Turnstile is enforced (brand `site.contact.turnstile.siteKey` **and** `TURNSTILE_SECRET_KEY` set) |
| `POST` | `/api/contact` | public, CSRF-protected (client uses `lib/@system/api`), rate limited (5 / 15 min / IP) | validates body (`ContactSubmissionBody`), rejects non-empty honeypot `website` with a generic 400, verifies `turnstileToken` when enforced (400 invalid, 503 fail-closed if siteverify is down), inserts via `ContactRepo.create` with `retention_expires_at = now() + retention`, sends notification email (fire-and-forget, logged on failure), returns `201 { data: { id, createdAt } }` |
| `GET` | `/api/contact?page&limit&unread=true\|false` | `authenticate` + `requireAdmin` | `{ data: [{ id, name, email, phone, subject, message, sourcePath, createdAt, readAt, retentionExpiresAt }], pagination: { total, page, pages, limit }, unreadCount }` — `ip`/`user_agent` stay in the DB for abuse review and are never returned; a missing table is `503`, not an empty list |
| `PATCH` | `/api/contact/:id/read` | admin | sets `read_at` (idempotent), `{ data: { id, readAt } }` |
| `PATCH` | `/api/contact/:id/unread` | admin | clears `read_at`, `{ data: { id, readAt: null } }` |
| `DELETE` | `/api/contact/:id` | admin | GDPR erasure (Art. 17), `{ message }`, 404 when absent |

Validation schemas: `server/src/lib/@system/Validation/schemas/@system/contact.js`.
Body: `name` (2–120), `email`, `phone?` (≤40), `subject?` (≤200), `message` (10–5000), `website?` (honeypot), `sourcePath?`, `turnstileToken?`.

Notification recipient: `CONTACT_NOTIFY_EMAIL`, falling back to `EMAIL_FROM`. If neither is set the submission is still stored and a warning is logged. Uses `server/src/lib/@system/Email` (SES / SMTP / Resend / console adapters).

Errors: `400` validation (`{message, errors[{field, message}]}`), `429` rate limit, `503` when the table is missing (migration not run) or Turnstile verification is unreachable.

### Retention

Migration `031_contact_submissions_retention.js` adds `retention_expires_at` (backfilled from `created_at`, indexed). `ContactRetentionPurgeTask` (`server/src/scheduler/tasks/@system/contact/`, registered by `scheduler/tasks/@system/init.js`) deletes expired rows daily at 03:30. Window resolution (`api/@system/contact/config.js`): `brand.json site.contact.retentionDays` → `CONTACT_RETENTION_DAYS` → 180.

### Spam

Honeypot (`website`) always on. Cloudflare Turnstile is optional: set `brand.json site.contact.turnstile.siteKey` and `TURNSTILE_SECRET_KEY`; the client renders the widget (lazy-loaded `https://challenges.cloudflare.com/turnstile/v0/api.js`) only when `GET /api/contact/config` returns a site key. CSP (`brand.json securityHeaders.contentSecurityPolicy`) needs `https://challenges.cloudflare.com` in `scriptSrc` and `frameSrc`.

### Database

`server/src/db/schemas/@system/contact_submissions.sql` and migration `server/src/db/migrations/@system/030_contact_submissions.js`:

```
contact_submissions(id serial pk, name text, email text, phone text, subject text,
                    message text, source_path text, ip text, user_agent text,
                    created_at timestamptz default now(), read_at timestamptz)
```

Tenant-less by design (one deployed product = one website).

### Admin inbox

`client/src/app/pages/app/@system/ContactSubmissionsPage` at `/app/contact` (`ProtectedRoute role="admin"`); sidebar entry "Contact inbox" (`navigation-defaults.js`, `requiredRole: 'admin'` — the Sidebar now enforces `requiredRole`). Opening a message marks it read.

---

## 4. Feature flags

| Flag | Default | Effect |
|------|---------|--------|
| `showAuth` | `true` | Log in / Dashboard links in navbar + footer. `/auth` and `/app/*` routes work regardless (admins need them for the inbox). |
| `showBlog` | `false` | `/blog` links in footer. |
| `showPricing` | `false` | `/pricing` links. Stripe stays optional; nothing on the site page requires Stripe env vars. |
| `showTeam` | `true` | Team section. |
| `showTestimonials` | `true` | Testimonials section. |
| `showMap` | `true` | Map inside the contact section. |
| `showContactForm` | `true` | Form inside the contact section. |

The flags above only control what the **site page** shows. Whether the underlying SaaS
feature exists at all (API, database tables, routes, sidebar) is decided by the
`modules` block — see 4.1.

### 4.1 Feature modules (`brand.json` → `modules`)

This template is a fork of the SaaS template and still contains its whole surface
(Stripe/Polar billing, subscriptions, teams, usage, API keys, web3, AI, onboarding,
public self-registration, blog, outgoing webhooks). Deleting that code would break
future `@system` merges from upstream, so it is **gated**, not removed. One block in
`brand.json` switches each module, and the same switch drives the server, the database,
the scheduler and the client:

```json
"modules": {
  "billing": false, "teams": false, "selfRegistration": false, "apiKeys": false,
  "web3": false, "ai": false, "usage": false, "onboarding": false,
  "blog": false, "webhooks": false
}
```

Rules:

- **Absent key = enabled.** A `brand.json` without `modules` (the SaaS template, older
  products) keeps the full surface, so this code can be upstreamed unchanged. This
  template ships every module `false`.
- **One resolver each side, same defaults.** Server:
  `server/src/lib/@system/Helpers/modules.js` (reads `brand.json` at boot; optional
  `MODULES_JSON='{"billing":true}'` env override for one-off environments). Client:
  `client/src/config/@system/modules.js`, fed at build time by the webpack
  `__MODULES__` DefinePlugin constant (`client/webpack.config.mjs` reads the same
  `brand.json`). Re-exported from `@/config` as `modules` / `isModuleEnabled` /
  `filterByModules`.
- **A module is either fully present or fully absent.** Turning one off:

| Seam | What happens | Where |
|---|---|---|
| API routers | Not mounted and not even `require()`d. `/api/stripe/*` etc. return 404. | `server/src/routes/@system/index.js` (generated by `scripts/@system/generate-barrels.js` with `mount(name, path)`), map in `ROUTER_MODULES` |
| Self-registration | `POST /api/auth/register`, `/api/sessions/register`, `/api/users` answer `403 { code: "MODULE_DISABLED" }`. Login, password reset and admin `POST /api/users/provision` keep working. | `api/@system/auth`, `sessions`, `user` via `requireModule()` |
| Migrations | Module-owned files are skipped and **not** recorded in `schema_migrations`; enabling the module later applies them on the next boot. | `server/src/db/migrations/@system/run.js`, map in `MIGRATION_MODULES` |
| Scheduled jobs | Tasks constructed with `{ module }` are refused by `Scheduler.registerTask()`. | `scheduler/tasks/@system/base/BaseTask.js`, `scheduler.js` |
| CSP | `buildCspDirectives()` adds the Stripe hosts to its defaults only when `billing` is on. This template's `brand.json` lists no Stripe host; `frameSrc` keeps the map hosts. | `server/src/lib/@system/Middleware/security.js` |
| Always-on code that touched module tables | GDPR export/erasure skips `team_members` / `api_keys` / `webhooks`; sitemap skips `blog_posts`; API-key auth answers 401. | `api/@system/gdpr`, `sitemap`, `Helpers/auth.js` |
| Client routes | Route entries carry `module: '<key>'` and are dropped by `filterRoutesByModules()` before `mergeRoutes()` (so `@custom` can still re-add a path). `/register` and `/signup` redirect to `/auth` instead of `/auth?tab=register`. | `client/src/app/routes/@system/AppRoutes.jsx`, `utils.js` |
| Sidebar / navbars | `PageEntry.module` filtered by `filterPagesByModules()`; Header/LandingNavbar hide the sign-up CTA and the Pricing link. | `config/@system/navigation-merge.js`, `Sidebar`, `Header`, `LandingNavbar` |
| Auth page | Login-only: no register form, no "Sign up" toggle, `?tab=register` ignored. | `pages/static/@system/AuthPage` |
| Dashboard | `HomePage` never calls `/api/usage/*` with `usage` off, hides billing links with `billing` off; `ProtectedRoute` only redirects to `/onboarding` when `onboarding` is on. | `pages/app/@system/HomePage`, `components/@system/ProtectedRoute` |

Router → module: `ai`, `threads` → `ai`; `api-keys` → `apiKeys`; `blog`, `ghost` → `blog`;
`onboarding` → `onboarding`; `payments`, `polar`, `stripe`, `subscriptions` → `billing`;
`teams` → `teams`; `usage` → `usage`; `web3` → `web3`; `webhooks` → `webhooks`. Everything
else (auth, sessions, users, contact, health, csrf, robots, sitemap, gdpr, email,
notifications, storage, admin, …) is always on.

Migration → module: `004_api_keys`, `024_api_key_enhancements` → `apiKeys`;
`009_polar_subscriptions`, `010_stripe_customer_id`, `012_stripe_subscriptions`,
`014_payment_provider` → `billing`; `022_teams` → `teams`; `023_blog_posts` → `blog`;
`025_webhooks` → `webhooks`; `026_metrics_threads_messages` → `ai`. Deliberately **not**
gated: `001_init` (users + subscriptions, FK'd by brands), `011_onboarding`
(`SessionRepo` selects `onboarding_completed` on every session auth) and
`020_billing_infrastructure` (creates `notifications`, `credits`, `transactions` used by
always-on APIs).

Adding a module: add the key to `MODULE_KEYS` in both resolvers, tag its router(s) in
`ROUTER_MODULES`, its migration(s) in `MIGRATION_MODULES`, its tasks with `{ module }`,
and its client routes/pages with `module: '<key>'`. Tests that exercise a module the
template switches off set `process.env.MODULES_JSON` for their own file (see
`server/test/api/@system/register.test.js`).

---

## 5. Brand and security headers

`brand.json` (camelCase, written by Orkosi provisioning) gained `templateType: "informational"` and
`securityHeaders.contentSecurityPolicy.frameSrc` / `imgSrc`. Both `server/src/lib/@system/Middleware/security.js` (helmet) and `server/scripts/inject-nginx-csp.js` read camelCase keys (snake_case still accepted) and emit `frame-src` / `img-src` from them, so map iframes work without touching server code. Default `frameSrc`: `'self' https://www.openstreetmap.org https://www.google.com`.

Stripe hosts (`js.stripe.com`, `api.stripe.com`) are part of the `billing` module: they are
absent from this template's `brand.json` and `buildCspDirectives()` only adds them to its
defaults when `modules.billing` is `true`. Empty directive arrays in `brand.json` mean
"not configured" and fall back to the defaults.

---

## 6. Imported sites

Orkosi's website cloner converts an existing site to React and drops it into this template. Contract:

| The cloner writes | Purpose |
|-------------------|---------|
| `client/src/app/pages/@custom/imported/<PascalName>/index.jsx` | default-exported React component per imported page, its markup wrapped in `<ImportedRoot>` (`components/@system/site/ImportedRoot.jsx`, renders `<div data-imported-root>`) |
| `client/src/app/styles/@custom/imported/site.css` | the imported site's stylesheet, written for a whole document; **scoped at build time** to `[data-imported-root]` (below) |
| `client/public/imported/assets/…` | images/fonts; copied to `dist/imported/assets/…` by CopyPlugin and served at `/imported/assets/…` |
| `client/src/app/routes/@custom/index.jsx` → `customRoutes` | route registration; a `path: '/'` entry **replaces** `SitePage` via `mergeRoutes`. Static paths are prerendered (§9) and count as known routes for the server's 200/404 decision; `/:param` and `*` paths are not |

```jsx
// client/src/app/routes/@custom/index.jsx
import { lazy } from 'react'
const Home = lazy(() => import('../../pages/@custom/imported/Home'))
const Menu = lazy(() => import('../../pages/@custom/imported/Menu'))
export const customRoutes = [
  { path: '/', element: <Home /> },
  { path: '/menu', element: <Menu /> },
]
```

```jsx
// client/src/app/pages/@custom/imported/Home/index.jsx
import { ImportedRoot } from '@/app/components/@system/site/ImportedRoot'
import '../../../../styles/@custom/imported/site.css'
export default function Home() {
  return (
    <ImportedRoot>
      <main>… <img src="/imported/assets/hero.jpg" alt="…" /> …</main>
    </ImportedRoot>
  )
}
```

The directories ship with `.gitkeep` files. `client/public/**` (including `imported/`) survives the build (`CopyPlugin` in `client/webpack.config.mjs`) and the Dockerfile copies `client/dist` wholesale. Imported pages may still import `SiteNavbar` / `SiteFooter` / `ContactForm` from `components/@system/site` to reuse the working contact pipeline.

### Imported CSS scoping

`client/postcss/scope-imported.cjs` (registered first in `client/postcss.config.mjs`) rewrites every selector of stylesheets under `styles/@custom/imported/` so they only match inside the wrapper; all other stylesheets pass through untouched.

| Cloner CSS | Emitted |
|------------|---------|
| `h1 { }` | `[data-imported-root] h1 { }` |
| `body { }`, `html { }`, `:root { }` | `[data-imported-root] { }` |
| `html body.dark .x { }` | `[data-imported-root].dark .x { }` |
| `.hero, .cta { }` | `[data-imported-root] .hero, [data-imported-root] .cta { }` |
| `@media … { .x { } }` | `@media … { [data-imported-root] .x { } }` |
| `@font-face`, `@keyframes` | untouched |

**Cascade ordering — why there is no `@layer imported`.** The imported stylesheet is deliberately kept *unlayered*. Tailwind's preflight and utilities are unlayered, and unlayered declarations beat layered ones regardless of specificity, so a layered `[data-imported-root] h1` would lose to preflight's `h1 { font-size: inherit }` and the imported site would render unstyled. The attribute prefix instead adds one attribute of specificity to every imported selector: imported rules win over preflight and over utility classes on the same element, and match nothing outside the wrapper. Load order is the remaining rule: `site.css` is imported by the page component, so it lands in the page's lazy CSS chunk after `main.css`, and later-wins on equal specificity. Products that need a real cascade layer can wrap `site.css` in `@layer imported { … }` themselves once the template's own CSS is layered — that is a template-wide change, not a per-product one.

Reference emit (page, stylesheet, routes) lives as fixtures in `client/src/test/@system/fixtures/imported/` and is exercised by `imported-page-contract.test.jsx` (routes merge + `ImportedRoot`), `scope-imported.test.js` (selector rewriting) and `custom-routes.test.js` (route discovery for the prerender).

---

## 7. Tests

- Server: `server/test/unit/@system/contact.validation.test.js` (schemas, honeypot, email body escaping), `csp-brand-config.test.js` (camelCase/snake_case CSP loading). Feature modules: `modules.test.js` (resolver, router/migration maps), `routes-modules.test.js` (barrel mounts/unmounts via supertest), `csp-modules.test.js`, `scheduler-modules.test.js`, `test/api/@system/register-disabled.test.js` (403 on the three register endpoints). Run `cd server && npm test -- test/unit`.
- Client: `src/test/@system/config-resolver.test.js` covers the `site` merge; brand assertions read `brand.json`. Feature modules: `src/test/@system/modules.test.js` (resolver + route/page filters) and `AppRoutes.modules.test.jsx` (route table with billing/teams/selfRegistration off).
- Server: `server/test/unit/@system/contact.validation.test.js` (schemas, honeypot, email body escaping), `csp-brand-config.test.js` (camelCase/snake_case CSP loading), `spa-fallback-prerender.test.js` (per-route snapshot lookup, path safety, known-route 200/404), `static-cache.test.js` (Cache-Control policy, no directory 301, sitemap cache header). Run `cd server && npm test -- test/unit`.
- Client: `src/test/@system/config-resolver.test.js` covers the three-layer `site` merge; `site-brand.test.js` the `brand.json` `site` mapping; `site-html.test.js` the generated `<head>`, JSON-LD and fallback markup; `apply-brand.test.js` the generated `site.brand.js`; `scope-imported.test.js`, `imported-page-contract.test.jsx`, `custom-routes.test.js` the cloner contract. Brand assertions read `brand.json`.
- Build: `client/scripts/verify-build.mjs` (postbuild) fails the build when `dist/index.html` lacks `<html lang>`, real `#root` content, or a single JSON-LD `@graph` with the `site.seo.businessType` node + `WebSite`, or still carries SaaS placeholder copy.
- E2E: `e2e/site.spec.js` — section ids, anchor scrolling, contact form validation + mocked submit, theme toggle, mobile menu. `npx playwright test e2e/site.spec.js` against a running server.

---

## 8. Environment

Build-time (prerender, §9): `PRERENDER=0` skip · `PRERENDER=require` fail instead of skip · `PRERENDER_ENGINE=playwright|dump-dom` · `PRERENDER_CHROMIUM=/path/to/chromium` · `PRERENDER_TIMEOUT_MS` (default 30000).

---

## 9. SEO, prerender and caching

### `index.html` is generated from `brand.json` + content

`client/webpack.config.mjs` loads the merged site content (`scripts/lib/site-content.cjs`) and `brand.json`, and hands `client/index.html` (an EJS template) these parameters via `scripts/lib/site-html.cjs`:

| Parameter | Source |
|-----------|--------|
| `HTML_LANG`, `OG_LOCALE_TAG` | `site.locale` |
| `SITE_TITLE`, `SITE_DESCRIPTION`, `OG_IMAGE` | `site.seo.*` with `brand.json` name/tagline/description fallbacks |
| `JSON_LD` | one `@graph`: the business node (`@type` = `site.seo.businessType`, `name`, `url`, `description`, `logo`, `telephone`, `email`, `address` → `PostalAddress`, `openingHours`, `sameAs` from `footer.social`) + `WebSite` (`inLanguage`, `publisher`) |
| `SITE_FALLBACK_HTML` | semantic markup for `#root` (header + nav, hero, about, services, contact card, footer) so no-JS visitors and crawlers see the real site even when the prerender cannot run; every value HTML-escaped |
| `ANALYTICS_TAG` | `site.analytics` → external Plausible/Umami `<script>` or nothing. Inline scripts are never emitted (CSP has no `unsafe-inline`; `server/test/unit/@system/csp-hash.test.js` asserts it) |
| `GOOGLE_FONTS_LINK`, `BRAND_*` | fonts + identity (see `docs/BRANDING.md`) |

URLs are emitted against the `__APP_URL__` placeholder; `start.sh` substitutes it at container start and `spaFallback` per request.

### Prerender

`client/scripts/prerender.mjs` runs in `postbuild` (before `verify-build.mjs`). It serves `client/dist` locally, loads `/` and every static path exported by `routes/@custom/index.jsx` (parsed with `@babel/parser` by `scripts/lib/custom-routes.cjs`, not evaluated) in headless Chromium, waits for network idle + rendered `#root`, and writes `dist/index.html` / `dist/<route>/index.html` (+ refreshed `.gz`/`.br`) plus `dist/prerender.json` (`{ engine, routes }`). The webpack script tags stay, so the bundle mounts and takes over (`main.jsx` uses `createRoot`, which replaces the snapshot). The local origin is turned back into `__APP_URL__`; runtime-derived `data-theme`/`class`/`style` on `<html>` are dropped so a returning dark-mode visitor is not flashed the light snapshot for longer than the pre-paint script needs; cookie consent is pre-accepted for the snapshot so no banner is captured (real visitors run the real `/cookie-consent.js`).

Engines, first available wins: Playwright's bundled Chromium (`playwright` / `playwright-core` / `@playwright/test` resolvable from `client/` or the repo root — the root devDependency covers local runs) or a bare Chromium/Chrome binary (`PRERENDER_CHROMIUM` or a well-known system path) driven with `--headless=new --dump-dom`. With neither the step **skips with a notice** and the build ships the `SITE_FALLBACK_HTML` markup — still real content, unstyled.

Where it runs today: locally (Playwright cache) and in any CI job that runs `npx playwright install --with-deps chromium` before `npm run build`. The Docker `builder` stage (`node:22-alpine`, client deps only) has no browser, so images built by the deploy pipeline currently ship the fallback markup; adding `apk add --no-cache chromium` to that stage and `ENV PRERENDER_CHROMIUM=/usr/bin/chromium-browser` enables the `--dump-dom` engine there without any npm dependency.

### Serving

- `server/src/lib/@system/spaFallback.js` serves `dist/<route>/index.html` when it exists (cached per path, path-traversal safe), otherwise `dist/index.html`, and injects per-route meta as before. A prerendered route is a known route (HTTP 200) even though `@custom` routes are absent from the `@system` manifest.
- `server/src/lib/@system/staticCache.js` (used by `express.static` in `server/src/app.js`): content-hashed `js/`, `css/` and `assets/[name].[hash][ext]` files → `public, max-age=31536000, immutable`; `*.html` → `no-cache, no-store, must-revalidate`; everything else (favicons, logos, `robots.txt`, `manifest.json`, `cookie-consent.js`, `imported/assets/…`) → `public, max-age=3600`. `redirect: false` so `dist/<route>/` directories never 301 to a trailing slash.
- `GET /sitemap.xml` (`server/src/api/@system/sitemap/index.js`) → `Cache-Control: public, max-age=3600, s-maxage=3600`.
- `client/public/sitemap.xml` no longer lists `/contact`: the SaaS `ContactPage` at that route fakes a successful submit. The server sitemap still lists it; `routes/@system/AppRoutes.jsx` should redirect `/contact` → `/#contact` and the server list drop it (both owned elsewhere).

### Performance budget

`client/webpack.config.mjs` `performance.hints: 'error'` — the production build fails when a `.js`/`.css` asset exceeds `maxAssetSize` (562,000 B) or the main entrypoint exceeds `maxEntrypointSize` (852,000 B). Measured 2026-09-20: largest asset 511,117 B (recharts chunk), entrypoint 774,300 B; limits are +10 %. Source maps and `.gz`/`.br` siblings are excluded. Raise the numbers in the same commit that adds weight, and say why.
No new required variables. Optional: `CONTACT_NOTIFY_EMAIL` (defaults to `EMAIL_FROM`), `CONTACT_RETENTION_DAYS` (default 180; `brand.json site.contact.retentionDays` wins), `TURNSTILE_SECRET_KEY` (enables Turnstile together with `brand.json site.contact.turnstile.siteKey`). Stripe/Polar variables remain optional; the site page never touches them.
