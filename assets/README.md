# Assets

> Purpose: what lives in `assets/` and how it reaches the built app. Full details in `docs/brand-assets.md`; colours and fonts in `docs/BRANDING.md`.
> Last verified: 2026-09-20.

```
assets/
├── logos/            logo.svg (primary), logo-mark.svg (square mark, favicon source), logo-white.svg, logo-dark.svg,
│                     logo-on-dark.svg, logo-on-light.svg, logo-wordmark*.svg, PNG exports
├── favicons/         favicon.svg (source) + generated favicon.ico/png, favicon-16/32/48/192/512.png, icon-192/512.png, apple-touch-icon.png
├── og/               og-image.png (1200x630), og-thumbnail.png, og-image.svg, og-dark.html, og-light.html
└── brand-guidelines.md
```

- `assets/logos/*` is served at `/assets/logos/*`, `assets/favicons/*` at the site root, `assets/og/*` at `/assets/og/*` (Webpack CopyPlugin in dev and build; the Dockerfile copies the same files).
- `brand.json` `assets{}` and `logoPath` / `svgLogoPath` / `faviconPath` / `thumbnailPath` name these files; keep them in sync when renaming.
- Regenerate derived favicons, PNG logos and the default OG image after changing a logo: `npm run generate:brand-assets` (uses `sharp`; commit the output in `assets/favicons/` and `client/public/`).
- Do not hand-edit generated favicon or icon PNGs.
