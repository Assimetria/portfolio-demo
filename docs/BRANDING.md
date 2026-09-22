# Branding

> Purpose: the brand pipeline end to end: what Orkosi writes into `brand.json`, what `prebuild.js` generates from it, how the theme switch works at runtime, and how to change colours, fonts, logo or default theme.
> Last verified: 2026-09-20 (`brand.json`, `scripts/prebuild.js`, `scripts/apply-brand.js`, `client/webpack.config.mjs`, `client/tailwind.config.mjs`, `client/src/app/store/@custom/ThemeContext.jsx`). Where the code is still being brought in line with this contract, the "Current state" notes say so.

## 1. Pipeline

```
Orkosi brand wizard  (name, primary/accent colour, heading/body font, default theme)
        |
        v
brand.json  (repo root; canonical camelCase; committed)
        |
        v  node scripts/prebuild.js        runs before EVERY build:
        |                                    - root `npm run build` (npm prebuild hook)
        |                                    - Dockerfile stage 2 (`RUN node scripts/prebuild.js`)
        |                                    - CI (`npm run build` in ci.yml / buildspec-ci.yml)
        |    1. scripts/apply-brand.js       (required)
        |    2. scripts/@system/generate-barrels.js (if present)
        |    3. scripts/@custom/prebuild.js  (if present, product hook)
        v
scripts/apply-brand.js
        |-- derives light + dark palettes from primaryColor/accentColor
        |     surfaces (bg -> surface -> hover -> active), borders (subtle/default/strong),
        |     text (primary/secondary/muted/disabled), WCAG auto-contrast for text-on-primary/accent,
        |     shadows, shadcn HSL equivalents
        |-- writes client/src/app/styles/@custom/brand.css      (token blocks; hand-written CSS after the @apply-brand:end sentinel is preserved)
        |-- writes client/src/config/@custom/info.js            (generated identity config)
        |-- writes client/src/app/content/@generated/site.brand.js  (informational site content from brand.json `site`, scripts/lib/site-brand.cjs)
        v
client/webpack.config.mjs reads brand.json again plus the merged site content (scripts/lib/site-content.cjs) and injects
<html lang>, <title>/description/og:* (site.seo), the JSON-LD business + WebSite graph, the pre-hydration #root markup,
the analytics <script> (site.analytics) and a Google Fonts <link> for the chosen families into client/index.html
(scripts/lib/site-html.cjs). client/scripts/prerender.mjs then snapshots the rendered app over it (docs/INFORMATIONAL-SPEC.md §9).
        v
Runtime: <html data-theme="light|dark"> selects the token set; ThemeProvider persists the choice; brandPrePaint applies it before first paint.
```

Regeneration rule: `brand.css` token blocks (`:root`, `[data-theme="dark"]`, `[data-theme="light"]`), `client/src/config/@custom/info.js` and `client/src/app/content/@generated/site.brand.js` are **overwritten on every build**. Anything you want to keep goes in `brand.json` (colours, fonts, theme, `customCssVars`, `site`), in `client/src/app/styles/@custom/general.css` (CSS), in `client/src/app/content/@custom/site.js` (site copy), or after the `@apply-brand:end` sentinel in `brand.css` (preserved by the regenerator).

Run it by hand any time: `npm run apply-brand` (or `node scripts/prebuild.js`).

## 2. `brand.json` schema

Canonical keys (written by Orkosi provisioning). Legacy keys are accepted by `apply-brand.js` and listed in the last column.

| Key | Type | Used by | Legacy alias |
|---|---|---|---|
| `companyName` | string | `<title>`, og tags, `info.name`, JSON-LD, generated `info.js` | `name` |
| `slug` | string | Preview workflow service name, repo name (`customer-<slug>`) | |
| `tagline` | string | `<title>` suffix, `info.tagline`, landing hero fallback | |
| `description` | string | meta description, og/twitter description, `info.description` | |
| `primaryColor` | `#RRGGBB` | `--brand-primary`, shadcn `--primary`/`--ring`, theme-color meta, `info.brandColor` | `colors.primary` |
| `accentColor` | `#RRGGBB` | `--brand-accent`, `info.accentColor` | `colors.accent` |
| `brandFonts.heading` | Google Fonts family | `--font-heading` (h1-h6), Google Fonts link | `headingFont`, `typography.heading` |
| `brandFonts.body` | family | `--font-body` (body), Google Fonts link | `bodyFont`, `typography.body` |
| `brandFonts.mono` | family | `--font-mono` (code) | `monoFont`, `typography.mono` |
| `defaultTheme` | `'light'` or `'dark'` | `:root` token set, `info.defaultTheme`, initial `app-theme` | `theme` |
| `logoPath` | repo path | Primary logo (`assets/logos/logo.svg`) | |
| `svgLogoPath` | repo path | Square mark (`assets/logos/logo-mark.svg`), default `info.logo` | |
| `faviconPath` | repo path | `assets/favicons/favicon.svg` | |
| `thumbnailPath` | repo path | OG thumbnail (`assets/og/og-thumbnail.png`) | |
| `assets{...}` | map | File names of every logo/favicon/OG variant in `assets/` | |
| `securityHeaders.contentSecurityPolicy.scriptSrc` | string[] | helmet `script-src` (Express) | `security_headers.content_security_policy.script_src` |
| `securityHeaders.contentSecurityPolicy.connectSrc` | string[] | helmet `connect-src` | `...connect_src` |
| `customDomainConfigured` | boolean | `start.sh` clears `APP_URL` when `false` | `custom_domain_configured` |
| `customCssVars` | map | Extra `--my-var: value` lines appended to `:root` | |
| `backgroundColor`, `surfaceColor`, `textColor`, `textSecondaryColor`, `borderRadius` | optional overrides | Replace the derived defaults for the default theme | `colors.*` |
| `url`, `supportEmail` | strings | `info.url`, `info.supportEmail` when set | |
| `spacing` | `compact` / `comfortable` / `spacious` or number 0.75–1.5 | Multiplies the `--space-xs…3xl` scale; emitted as `--space-scale` | |
| `radius` | `none` / `sm` / `md` / `lg` / `xl` / `full` or CSS length | `--radius` (shadcn) and the derived `--radius-xs…lg` | `borderRadius` |
| `modes.light`, `modes.dark` | palette objects from the Orkosi brand engine (`primary`, `accent`, `bg`, `surface`, `surfaceRaised`, `text`, `textMuted`, `textFaint`, `border`, `primaryHover`, `onPrimary`, …) | Override the derived palette of that theme only; the other theme stays derived from `primaryColor`/`accentColor` | |

**Validation.** `brand.json` is checked on every build by `scripts/lib/brand-schema.cjs` (editor/JSON-Schema mirror: `brand.schema.json`): a wrong type on any key above fails the build with the offending path (`node scripts/apply-brand.js --check` runs the validation alone; CI runs it in the `contract` job). Unknown keys are allowed and preserved, so engine data such as `typography.scale`, `voice`, `positioning`, `logos[]` rides along.
| `templateType` | `'informational'` | marks the template family (informational front door at `/`) | |
| `site.locale` | BCP-47 tag | `<html lang>`, `og:locale`, JSON-LD `inLanguage` | |
| `site.nav[]`, `site.navCta` | `{label, href}` list / object | `site.nav.links`, `site.nav.ctaLabel/ctaHref` (navbar + fallback markup) | |
| `site.contact{email, phone, address, hours[], openingHours[]}` | strings / structured address | contact card, JSON-LD `telephone`/`email`/`PostalAddress`/`openingHours` | |
| `site.social{linkedin, twitter, github, youtube, instagram, facebook, email}` | URLs | footer social icons, JSON-LD `sameAs` | |
| `site.footer{tagline, copyright, columns[], legalLinks[]}` | strings / lists | footer | |
| `site.seo{titleTemplate, description, ogImage, businessType}` | strings | `<title>`, meta description, `og:image`, JSON-LD business `@type` | |
| `site.analytics{provider, id}` | `none \| plausible \| umami` | external analytics `<script>` in `index.html` (none by default) | |

`site.*` is the informational template's provisioning block; full schema, pruning rules and the three content layers it feeds: `docs/INFORMATIONAL-SPEC.md` §1.

Descriptive fields such as `toneOfVoice`, `targetAudience`, `differentiator`, `iconLibrary`, `uiLibrary` are informational for agents and are not read by the build.

## 3. What Orkosi provisioning writes

When a user picks the SaaS template in Orkosi, names the brand, chooses primary/accent colours and heading/body fonts:

1. Creates `Assimetria/customer-<slug>` from this template and sets the default branch to `dev`.
2. Writes `brand.json` (schema above), `client/src/config/@custom/info.js`, `client/src/config/@custom/text/index.js`, `client/src/app/content/@custom/landing.js`.
3. Generates an initials SVG logo into `assets/logos/logo.svg` and `client/public/logo.svg`.
4. Sets Actions secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ECR_REPO_NAME`, `APP_RUNNER_SERVICE_ARN`; creates the ECR repository and the App Runner service (port 3000).
5. The first push to `main` runs CI then Deploy (`docs/DEPLOYMENT.md`).

Everything Orkosi wrote is regular committed code; edit `brand.json` and the `@custom` files freely afterwards.

## 4. Generated outputs

### `client/src/app/styles/@custom/brand.css`

Three blocks, each with the shadcn HSL set and the `--brand-*` set:

- `:root` — the `defaultTheme` palette plus theme-independent tokens (typography, spacing, radius, z-index, semantic status colours, layout).
- `[data-theme="dark"]` — dark palette.
- `[data-theme="light"]` — light palette.

Token list and Tailwind mappings: `docs/DESIGN-SYSTEM.md`.

### `client/src/config/@custom/info.js`

```js
import { info as baseInfo } from "../@system/info";
export const info = { ...baseInfo, name, tagline, description, logo, logoUrl, logoDark, logoWhite, defaultTheme, brandColor, accentColor, auth: { ...baseInfo.auth, testimonial: null } };
```

The config resolver `client/src/config/index.js` spreads it over `@system/info.js`. Anything you need beyond what `brand.json` carries (social links, `plans` for route gating, `companyAddress`) belongs in `brand.json` when a key exists, otherwise expect to re-apply it after regeneration or extend `apply-brand.js` in the template.

### `client/src/app/content/@generated/site.brand.js`

```js
export default { locale, nav: { links, ctaLabel, ctaHref }, contact: { email, phone, address, hours, openingHours }, footer: { tagline, columns, social, legalLinks, copyright }, seo, analytics }
```

Layer 2 of the informational site content (`content/@system/site.js` ← this ← `content/@custom/site.js`, merged by `client/src/config/index.js` with `scripts/lib/site-brand.cjs`). Empty `brand.json` values are pruned so they fall through to the template defaults. `export default {}` when `brand.json` has no `site` key, so SaaS-shaped brand files still build.

### `client/index.html`

HtmlWebpackPlugin `templateParameters`: `HTML_LANG`, `SITE_TITLE`, `SITE_DESCRIPTION`, `OG_IMAGE`, `OG_LOCALE_TAG`, `JSON_LD`, `SITE_FALLBACK_HTML`, `ANALYTICS_TAG` (from `brand.json` `site` + merged content via `scripts/lib/site-html.cjs`), `BRAND_NAME`, `BRAND_TAGLINE`, `BRAND_DESCRIPTION`, `BRAND_COLOR`, `BRAND_LOGO_MARK`, `BRAND_FONT_*`, `GOOGLE_FONTS_LINK` (only the chosen families load) and `APP_URL` from `VITE_APP_URL`. Nothing product-specific is hard-coded in the template file; `client/scripts/verify-build.mjs` fails the build if SaaS placeholder copy or a `SoftwareApplication` node reappears.

## 5. Runtime theme

- Switch: `document.documentElement.dataset.theme = 'light' | 'dark'`. Tailwind `dark:` variants use `darkMode: ['selector', '[data-theme="dark"]']`. The `.dark` class is mirrored for components written against the old selector.
- `ThemeProvider` (`client/src/app/store/@custom/ThemeContext.jsx`, re-exported as `store/@system/theme.jsx`): `theme` is `'light' | 'dark' | 'system'`, persisted under localStorage `app-theme`; `resolvedTheme` follows `prefers-color-scheme` when `system`. Initial value: stored value, else `info.defaultTheme`, else `light`.
- `brandPrePaint.js` (`client/src/app/lib/@system/`): `applyDefaultTheme(info)` seeds `app-theme` when unset and applies the default before React mounts; `applyBrandColors(info)` writes `--primary`, `--ring`, `--brand-panel-bg`, `--brand-panel-accent` and syncs `<meta name="theme-color">`. It is exercised by `client/src/test/@system/brand-paint.test.jsx`.

## 6. How to change things

| Change | Do this | Then |
|---|---|---|
| Primary / accent colour | edit `primaryColor` / `accentColor` in `brand.json` | `npm run apply-brand`; commit `brand.json` and the regenerated files |
| Default theme | `defaultTheme: "dark"` or `"light"` in `brand.json` | `npm run apply-brand`; users who already chose a theme keep their localStorage value |
| Fonts | `brandFonts.heading/body/mono` (Google Fonts family names) | `npm run apply-brand`; rebuild to refresh the fonts link |
| Logo | replace `assets/logos/logo.svg` and `assets/logos/logo-mark.svg` (and `client/public/logo.svg`); update `assets.*` names if you rename | `npm run generate:brand-assets` (needs `sharp`) regenerates favicons/OG PNGs into `client/public/` and `assets/favicons/` |
| Favicon only | replace `assets/favicons/favicon.svg` | Webpack copies `assets/favicons/*` to the dist root |
| OG image | replace `assets/og/og-image.png` (1200x630) | referenced by `client/index.html` as `/assets/og/og-image.png` |
| Extra CSS variables | `customCssVars: { "--hero-gradient": "..." }` in `brand.json` | appended to `:root` on regeneration |
| Product CSS | `client/src/app/styles/@custom/general.css` | imported last, wins |
| Name / tagline / description | `brand.json` | regenerates `info.js`, `<title>`, meta |
| Site language, nav labels, contact details, social links, footer, SEO title/description/business type | `brand.json` `site.*` | `npm run apply-brand` regenerates `content/@generated/site.brand.js`; rebuild refreshes `<html lang>`, JSON-LD and the fallback markup |
| Analytics | `site.analytics: { provider: "plausible", id: "acme.pt" }` (or `umami`) | rebuild; add the provider's origins to `securityHeaders.contentSecurityPolicy.scriptSrc`/`connectSrc` if not already there |
| Hero / about / services / team / testimonials copy | `client/src/app/content/@custom/site.js` | rebuild (pure data only — evaluated at build time) |
| Third-party script or API origin (analytics, chat) | add to `securityHeaders.contentSecurityPolicy.scriptSrc` / `connectSrc` | restart server (CSP is read at boot) |

## 7. Rules for components

- Use Tailwind brand classes or shadcn semantic classes; never hex. Both map to the generated tokens, so a product's colours propagate to `@system` and `@custom` code alike.
- Do not read `brand.json` at runtime in the client; use `info` from `@/config` or the CSS variables.
- Do not edit the generated token blocks or `config/@custom/info.js` by hand.
- Test both themes: toggle with `localStorage.setItem('app-theme','dark'); location.reload()`.

## 8. Current state vs this contract (2026-09-20)

Items the client agent is landing; verify before relying on them:

- `apply-brand.js` reads `headingFont`/`bodyFont`/`monoFont` and `typography.*`; `brandFonts{}` is not read yet.
- `apply-brand.js` falls back to `'dark'` when `defaultTheme`/`theme` is absent; this contract says `light`.
- `ThemeContext.jsx` and `brandPrePaint.js` toggle the `.dark` class only; `brand.css` and Tailwind key on `[data-theme]`, so runtime switching needs the `data-theme` attribute to be set.
- `client/index.html` hardcodes Inter + JetBrains Mono; the generated fonts link is not implemented yet.
- `security.js` reads snake_case `security_headers.content_security_policy.script_src`; `brand.json` is camelCase, so the CSP arrays from `brand.json` are currently ignored and helmet defaults apply.
- `brand.css` currently emits `--brand-accent-5/10/20: undefined` (palette has no `accent5/10/20`).
- Tailwind exposes `text-brand-text`, `-secondary`, `-muted` but not `text-brand-text-on-primary`; use `text-[var(--brand-text-on-primary)]` until the config is extended.
