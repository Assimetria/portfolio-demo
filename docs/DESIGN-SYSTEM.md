# Design system

> Purpose: the tokens `apply-brand.js` generates into `brand.css`, how they map to Tailwind and shadcn classes, light/dark behaviour, and the responsive utilities. For the pipeline itself see `docs/BRANDING.md`.
> Last verified: 2026-09-20 (`client/src/app/styles/@custom/brand.css` as generated from the template `brand.json`, `client/tailwind.config.mjs`, `client/src/app/styles/mobile-responsive-utilities.css`).

## 1. Two token families, one source

`brand.json` -> `scripts/apply-brand.js` -> `client/src/app/styles/@custom/brand.css`. The file has three blocks: `:root` (the `defaultTheme` palette plus theme-independent tokens), `[data-theme="dark"]`, `[data-theme="light"]`. Both families below are regenerated on every build; do not edit them by hand.

### shadcn semantic tokens (HSL triplets, consumed as `hsl(var(--x))`)

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`, `--radius-xl`.

`--primary` and `--ring` are derived from `primaryColor`; `--primary-foreground` is the WCAG auto-contrast choice (white or black). The rest are neutral zinc-scale surfaces per theme.

### Brand tokens (hex / rgba)

| Group | Tokens |
|---|---|
| Primary | `--brand-primary`, `--brand-primary-hover`, `--brand-primary-active`, `--brand-primary-5`, `--brand-primary-10`, `--brand-primary-20` (alpha tints) |
| Accent | `--brand-accent`, `--brand-accent-hover`, `--brand-accent-active` (`--brand-accent-5/10/20` are emitted but currently `undefined`; see BRANDING.md section 8) |
| Surfaces (level 0 to 3) | `--brand-bg`, `--brand-surface`, `--brand-surface-hover`, `--brand-surface-active`, `--brand-panel-bg` (= surface) |
| Borders | `--brand-border-subtle`, `--brand-border`, `--brand-border-strong` |
| Text | `--brand-text`, `--brand-text-secondary`, `--brand-text-muted`, `--brand-text-disabled`, `--brand-text-on-primary`, `--brand-text-on-accent` |
| Typography | `--font-heading`, `--font-body`, `--font-mono` (plus legacy aliases `--font-primary`, `--font-secondary`); sizes `--text-2xs` .. `--text-3xl`, `--text-ui`; weights `--font-normal|medium|semibold|bold` |
| Status | `--color-success`, `--color-error`, `--color-warning`, `--color-info`, `--color-lime`, `--color-yellow`, `--color-orange`, `--color-purple`, `--color-cyan` |
| Spacing | `--space-xs` 4px, `--space-sm` 8, `--space-md` 16, `--space-lg` 24, `--space-xl` 32, `--space-2xl` 48, `--space-3xl` 64 |
| Radius | `--radius-xs` 3px, `--radius-sm` 6, `--radius-md` 8, `--radius-lg` 12, `--radius-full` |
| Shadows | `--shadow-sm|md|lg|xl`, `--shadow-glow-primary`, `--shadow-card`, `--shadow-button`, `--shadow-overlay`, `--ring-primary`, `--ring-accent` (brand-tinted in dark) |
| Motion | `--transition-fast` 120ms, `--transition-normal` 200, `--transition-base` 300, `--transition-slow` 400, `--transition-slower` 600 |
| Z-index | `--z-base` 0, `--z-raised` 10, `--z-dropdown` 200, `--z-modal` 50, `--z-toast` 9999, `--z-tooltip` 50 |
| Layout | `--max-width` 1200px, `--header-height` 64px, `--sidebar-width` 240px, `--sidebar-width-collapsed` 68px |
| Product extras | whatever `brand.json` `customCssVars` declares |

Per-theme overrides (`[data-theme="dark"]`, `[data-theme="light"]`) redefine the shadcn set, the surface/border/text brand tokens and the shadows. Primary/accent, typography, spacing, radius, z-index and layout are theme-independent.

## 2. Tailwind mapping (`client/tailwind.config.mjs`)

| Class family | Backed by |
|---|---|
| `bg-background text-foreground bg-card text-card-foreground bg-popover bg-primary text-primary-foreground bg-secondary bg-muted text-muted-foreground bg-accent text-accent-foreground bg-destructive text-destructive border-border border-input ring-ring` | shadcn HSL tokens |
| `bg-brand-primary hover:bg-brand-primary-hover bg-brand-accent bg-brand-bg bg-brand-surface hover:bg-brand-surface-hover border-brand-border text-brand-text text-brand-text-secondary text-brand-text-muted` (also as `text-`, `border-`, `ring-` variants) | brand tokens |
| `text-success text-error text-warning text-info` (and `bg-`) | status tokens |
| `rounded-lg rounded-md rounded-sm` | `--radius` (shadcn preset) |
| `font-sans`, `font-mono` | Inter / JetBrains Mono stacks in `theme.fontFamily`; heading/body/mono brand fonts apply through `--font-heading` (`h1`-`h6`), `--font-body` (`body`), `--font-mono` (`code`) |
| `dark:` | `darkMode: ['selector', '[data-theme="dark"]']` |

Tokens without a shorthand: use arbitrary values, `bg-[var(--brand-primary-10)]`, `text-[var(--brand-text-on-primary)]`, `border-[var(--brand-border-subtle)]`, `shadow-[var(--shadow-card)]`, `z-[var(--z-dropdown)]`.

Opacity: Tailwind's `/50` modifier cannot apply to CSS-variable colours. Use precomputed tints (`--brand-primary-5|10|20`) or `bg-[color-mix(in_srgb,var(--brand-primary)_20%,transparent)]`.

## 3. Rules

1. No hex, no Tailwind palette colours (`bg-gray-800`, `text-blue-600`) in `@system` or `@custom` components; use the classes above.
2. shadcn semantic classes and brand classes are both correct; pick shadcn classes inside `components/@system/ui` primitives and either elsewhere. They resolve to the same generated palette, so products recolour everything through `brand.json`.
3. Accepted exceptions: `text-white`/`text-black` on intentionally coloured banners, `bg-black/50` overlays, paired status badges such as `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400` where a semantic token does not exist yet.
4. Both themes must work. Test by toggling `data-theme` on `<html>` or `localStorage.setItem('app-theme','dark')`.
5. Focus rings: `*:focus-visible` uses `hsl(var(--ring))` (`client/src/index.css`); do not remove outlines without a replacement.
6. Icons: `lucide-react`, sized with Tailwind (`h-4 w-4`), coloured with `text-*` classes.

## 4. shadcn/ui primitives

Location: `client/src/app/components/@system/ui/*` (accordion, alert-dialog, avatar, badge, button, calendar, card, checkbox, collapsible, dialog, dropdown-menu, input, label, popover, scroll-area, select, separator, sheet, skeleton, switch, tabs, textarea, toast, tooltip). Import per component: `import { Button } from '@/app/components/@system/ui/button'`. They use `class-variance-authority`, `clsx` and `tailwind-merge` via `cn()` from `@/app/lib/@system/utils`. Higher-level `@system` components (Dashboard, UserSettings, Teams, Onboarding, Header, Footer, Sidebar, PageLayout) compose them; prop reference in `docs/SYSTEM_COMPONENTS_API.md`.

Do not edit primitives in a product repo; wrap or compose in `components/@custom/`.

## 5. Responsive utilities

Tailwind config adds: breakpoint `xs` 480px (defaults `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536), `landscape` and `retina` raw variants; spacing `safe-top|bottom|left|right` (env safe-area insets); `min-h-touch` 44px, `min-h-touch-sm` 36px, `min-h-touch-lg` 48px (and `min-w-*`); fluid font sizes `text-xs-fluid` .. `text-4xl-fluid`; `max-w-mobile`, `max-w-mobile-safe`; container padding per breakpoint.

`client/src/app/styles/mobile-responsive-utilities.css` (imported by `index.css`) provides class helpers: `.mobile-container`, `.mobile-stack`, `.mobile-full-width`, `.mobile-only`, `.mobile-hidden`, `.mobile-card`, `.mobile-form-group`, `.mobile-form-input`, `.mobile-button-group`, `.mobile-menu`, `.mobile-menu-overlay`, `.responsive-grid`, `.responsive-grid-4`, `.responsive-heading-xl|lg|md`, `.responsive-body`, `.responsive-image(-cover|-contain)`, `.safe-area-inset-*`, `.section-spacing(-xl)`, `.touch-target(-comfortable|-extended)`, `.sr-only`. Patterns and examples: `docs/MOBILE_PATTERNS.md`.

## 6. Files

| File | Role |
|---|---|
| `brand.json` | Source of truth (colours, fonts, theme, radius overrides, `customCssVars`) |
| `scripts/apply-brand.js` | Generator |
| `client/src/app/styles/@custom/brand.css` | Generated tokens (+ preserved hand-written CSS after the light block) |
| `client/src/app/styles/@system/general.css` | Template base styles |
| `client/src/app/styles/@custom/general.css` | Product CSS, imported last |
| `client/src/index.css` | Tailwind layers + imports + legacy `:root` fallbacks (overridden by brand.css) |
| `client/tailwind.config.mjs` | Token to class mapping (`client/tailwind.config.js` is a CJS mirror) |
| `client/src/config/brand.js`, `client/src/config/design.js` | Generated JS mirrors of the palette for the rare case a value is needed in JS |

## 7. Runtime providers

### BrandProvider (`client/src/app/store/@system/brand.jsx`)

For dynamic brand switching at runtime (e.g., admin brand settings, preview mode),
the `BrandProvider` re-derives all CSS custom properties from the brand config:

```jsx
// App.jsx wraps the entire app:
<BrandProvider>
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
</BrandProvider>

// Override brand colors at runtime:
<BrandProvider brandColor="#8B5CF6" accentColor="#A78BFA">
  {children}
</BrandProvider>
```

**How it works:**
1. Reads `primaryColor` and `accentColor` from `info` (brand.json via @custom/info.js)
2. Derives hover states, HSL conversions, and RGB values
3. Injects a `<style id="brand-runtime-tokens">` element into `<head>`
4. Re-derives on prop change — tokens update instantly

**Hook:**
```jsx
import { useBrand } from '@/app/store/@system/brand'

function MyComponent() {
  const { primaryColor, accentColor, tokens } = useBrand()
  // tokens = { --brand-primary: #8B5CF6, --primary: 258.3 89.3% 63.7%, ... }
}
```

### ThemeProvider (`client/src/app/store/@custom/ThemeContext.jsx`)

Writes the resolved theme to `<html data-theme="light|dark">` (the switch Tailwind's `darkMode` selector and the generated `brand.css` key off) and mirrors it to the legacy `.dark` class, via `client/src/app/lib/@system/themeDom.js`, which `brandPrePaint.js` also uses before first paint so the two can never drift.

```jsx
import { useTheme } from '@/app/store/@system/theme'

const { theme, resolvedTheme, setTheme } = useTheme()
// theme: light | dark | system
// resolvedTheme: light | dark (actual applied theme)
```