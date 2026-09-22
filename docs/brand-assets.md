# Brand assets

> Purpose: which logo, favicon and social-image files exist, where they are served from, and how to regenerate the derived ones. Colours, fonts and theme are covered in `BRANDING.md`.
> Last verified: 2026-09-20 (`assets/`, `client/public/`, `client/webpack.config.mjs` CopyPlugin, `Dockerfile`, `scripts/generate-brand-assets.js`, `brand.json` `assets`).

## 1. Source files (commit these)

| File | Role |
|---|---|
| `assets/logos/logo.svg` | Primary logo (horizontal). Orkosi provisioning writes an initials SVG here and to `client/public/logo.svg` |
| `assets/logos/logo-mark.svg` | Square mark; default `info.logo` (`/assets/logos/logo-mark.svg`); source for favicons |
| `assets/logos/logo-white.svg`, `logo-dark.svg`, `logo-on-dark.svg`, `logo-on-light.svg`, `logo-wordmark*.svg` | Variants used by header/footer/auth panels on dark or light surfaces |
| `assets/favicons/favicon.svg` | Vector favicon (hand-optimised versions are preserved by the generator) |
| `assets/og/og-image.png` (1200x630), `assets/og/og-thumbnail.png` | Social share images referenced by `client/index.html` (`/assets/og/og-image.png`) |
| `assets/brand-guidelines.md` | Human guidelines for the brand |

`brand.json` `assets{}` maps logical names (`logo`, `logoMark`, `favicon`, `ogImage`, ...) to these file names; `logoPath`, `svgLogoPath`, `faviconPath`, `thumbnailPath` point at the canonical four.

## 2. Derived files (regenerate, do not hand-edit)

`npm run generate:brand-assets` (`scripts/generate-brand-assets.js`, requires `sharp`, installed by root `npm i`) reads `assets/logos/logo-mark.svg` (fallback `logo.svg`, then `logo.png`) and writes:

- `client/public/`: `logo.png` (512), `logo.svg`, `logo-white.png`, `logo-dark.png`, `favicon.ico` (16/32/48), `favicon.png`, `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-192.png`, `favicon-512.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `og-image.png`, and updates the `icons` array in `client/public/manifest.json`.
- `assets/favicons/`: the same favicon set.

The Dockerfile tries this step during the image build (`npm install sharp --no-save && node scripts/generate-brand-assets.js || true`); when `sharp` cannot build, the committed files are used, so commit the regenerated output after changing a logo. `scripts/generate-og-thumbnails.js` and `scripts/ensure-transparent-logo.js` are optional extras and are not part of `prebuild.js`.

## 3. How they are served

| Source | URL | Mechanism |
|---|---|---|
| `assets/logos/*` | `/assets/logos/*` | Webpack CopyPlugin -> `client/dist/assets/logos`; dev server static; Dockerfile also copies `logo.svg`, `logo.png`, `logo-mark.svg`, `logo-white.svg`, `logo-white-on-dark.png` to the dist root |
| `assets/favicons/*` | `/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png`, ... | CopyPlugin with `force: true` (wins over `client/public` copies); Dockerfile copies the same |
| `assets/og/*` | `/assets/og/*` | CopyPlugin; Dockerfile also copies `og-image.png` to `/og-image.png` |
| `client/public/*` | `/` | CopyPlugin (everything except `index.html`); `manifest.json`, `robots.txt`, `sitemap.xml` live here |
| `server/src/public/*` | `/` | `express.static` fallback for favicons and `cookie-consent.js` when the SPA dist is absent |

`client/index.html` links `/favicon.svg`, `/favicon.ico`, `/favicon.png`, `/apple-touch-icon.png`, `/manifest.json` and uses `/assets/logos/logo-mark.svg` in JSON-LD and the pre-hydration header.

## 4. Changing the logo

1. Replace `assets/logos/logo.svg` and `assets/logos/logo-mark.svg` (keep the mark square, transparent background). Update variants if you have them.
2. `npm run generate:brand-assets`.
3. If file names changed, update `brand.json` `assets{}` and `logoPath`/`svgLogoPath`/`faviconPath`.
4. `npm run build`, check `/`, `/auth`, the sidebar and a social preview (`https://<app-url>/assets/og/og-image.png`).
5. Commit `assets/`, `client/public/`, `brand.json`.

Social platforms cache OG images; use the Facebook Sharing Debugger or `https://cards-dev.twitter.com/validator` to refresh.
