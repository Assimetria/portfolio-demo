# Product Template Brand Guidelines

> Purpose: human-readable brand guidelines for the template's default identity. Products replace this file with their own; the machine-readable source for colours, fonts and theme is `brand.json` (see `docs/BRANDING.md`), and the generated tokens are in `client/src/app/styles/@custom/brand.css`.
> Last verified: 2026-09-20.

## Logo

### Mark
The Product Template logo is a **code bracket mark** — two angled bracket shapes flanking a diagonal slash, representing the universal `< />` shorthand for self-closing markup. It is the typographic symbol developers reach for when describing "code itself", making it a fitting identity for a product scaffolding tool.

- **Shape**: three strokes — left bracket (pointing right), right bracket (pointing left), diagonal slash between them
- **Color**: always `#3b82f6` (Brand Blue) on light or dark surfaces
- **Background chip**: square with radius 11px, filled `#1e293b` (Brand Slate) on dark contexts
- **File**: `assets/logos/logo-mark.svg` (44×44 viewBox)

### Logo Variants

| File | Usage |
|------|-------|
| `logo-mark.svg` | Square mark on white/light backgrounds |
| `logo-on-dark.svg` | Square mark on dark chip (`#1e293b` bg) |
| `logo.svg` | Horizontal wordmark — mark + "Product Template" dark text |
| `logo-dark.svg` | Horizontal wordmark on light backgrounds |
| `logo-white.svg` | Square mark, white fill (dark solid backgrounds) |
| `logo-on-light.svg` | Horizontal wordmark for light contexts |
| `logo-wordmark.svg` | Wordmark, standard orientation |
| `logo-wordmark-white.svg` | Horizontal wordmark, white text (dark backgrounds) |
| `favicons/favicon.svg` | 32×32 optimized favicon |

### Minimum Sizes

| Context | Minimum Size |
|---------|-------------|
| Mark only (digital) | 16px × 16px |
| Mark only (print) | 6mm × 6mm |
| Wordmark (digital) | 120px wide |
| Wordmark (print) | 35mm wide |

Below these sizes legibility degrades; use only the mark, not the wordmark.

### Clear Space

Maintain a minimum clear space equal to **1× the mark height** on all sides.

```
   [1× mark height]
          ↕
  ←→ [LOGO] ←→
          ↕
```

No other graphic elements, text, or imagery may enter this zone.

### Do
- Use the mark at any size — it remains readable at 16px
- Use Brand Blue (`#3b82f6`) on white or light-gray backgrounds
- Use the dark chip variant (`logo-on-dark.svg`) on surfaces darker than `#4a5568`
- Use white fill on solid dark/navy backgrounds
- Maintain minimum clear space of 1× mark height around the logo
- Use the wordmark for full branding contexts (marketing pages, email headers, documentation covers)
- Use the mark only for tight spaces (favicons, app icons, sidebar badges)

### Don't
- Never rotate the mark — brackets always face left/right, slash always diagonal
- Never use more than 1 color on the mark strokes
- Never add gradients, shadows, or outer glows to the mark
- Never redraw the mark freehand — always use the SVG source files
- Never stretch or distort the aspect ratio
- Never place on backgrounds that reduce contrast below 3:1 ratio
- Never use the wordmark at sizes where "Product Template" text becomes illegible
- Never apply brand colors to only part of the mark

---

## Colors

### Primary Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Brand Slate | `#1e293b` | 30, 41, 59 | Primary brand color — dark surfaces, nav, mark background chip |
| Brand Slate Dark | `#0f172a` | 15, 23, 42 | Deeper backgrounds, page canvas in dark theme |
| Brand Slate Mid | `#334155` | 51, 65, 85 | Elevated surfaces, hover states on dark |
| Brand Slate Light | `#e2e8f0` | 226, 232, 240 | Light borders, subtle dividers |

### Accent Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Accent Blue | `#3b82f6` | 59, 130, 246 | Primary accent — mark, CTA buttons, active links, focus rings |
| Accent Blue Dark | `#2563eb` | 37, 99, 235 | Hover/pressed state for Accent Blue elements |
| Accent Blue Light | `#dbeafe` | 219, 234, 254 | Tinted backgrounds, selected rows, subtle highlights (light theme) |

### Semantic / Status Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Success | `#059669` | 5, 150, 105 | Confirmations, passing checks, active status |
| Success Light | `#d1fae5` | 209, 250, 229 | Success background tints |
| Error | `#dc2626` | 220, 38, 38 | Validation errors, failure states, destructive actions |
| Error Light | `#fee2e2` | 254, 226, 226 | Error background tints |
| Warning | `#d97706` | 217, 119, 6 | Cautions, deprecation notices, degraded states |
| Warning Light | `#fef3c7` | 254, 243, 199 | Warning background tints |

### Neutral Palette (Light Theme)

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Text Primary | `#0f172a` | 15, 23, 42 | Headings, primary body text |
| Text Secondary | `#374151` | 55, 65, 81 | Sub-headings, label text |
| Text Muted | `#6b7280` | 107, 114, 128 | Helper text, metadata, timestamps |
| Border | `#e5e7eb` | 229, 231, 235 | Dividers, card borders, input borders |
| Background Alt | `#f8fafc` | 248, 250, 252 | Alternating rows, secondary panels |
| White | `#ffffff` | 255, 255, 255 | Page background, card surfaces |

### Dark Theme (Dashboard / App UI)

| Name | Hex | Usage |
|------|-----|-------|
| Surface 0 | `#0f172a` | Page background |
| Surface 1 | `#1e293b` | Card / panel background |
| Surface 2 | `#334155` | Hover / elevated surface |
| Border Dark | `#334155` | Dividers on dark surfaces |
| Text Dark Primary | `#f1f5f9` | Primary text |
| Text Dark Secondary | `#94a3b8` | Secondary / muted text |
| Text Dark Muted | `#64748b` | Timestamps, metadata |

### Accessibility

All foreground/background pairings must meet WCAG AA (4.5:1 for body text, 3:1 for large text and UI components). Critical pairings:

| Foreground | Background | Contrast | Pass |
|-----------|------------|----------|------|
| `#3b82f6` | `#ffffff` | 3.7:1 | AA (large/UI) |
| `#0f172a` | `#ffffff` | 19.4:1 | AAA |
| `#ffffff` | `#1e293b` | 12.6:1 | AAA |
| `#ffffff` | `#3b82f6` | 3.7:1 | AA (large/UI) |
| `#6b7280` | `#ffffff` | 4.6:1 | AA |
| `#f1f5f9` | `#1e293b` | 11.9:1 | AAA |
| `#94a3b8` | `#0f172a` | 6.1:1 | AA |

---

## Typography

### Typefaces

| Role | Family | Weights | Usage |
|------|--------|---------|-------|
| Primary | Inter | 400, 500, 600, 700 | All UI text, body copy, headings, labels |
| Monospace | JetBrains Mono | 400, 500 | Code samples, API keys, terminal output, config values |

Inter is available via Google Fonts (`https://fonts.google.com/specimen/Inter`).
JetBrains Mono is available via Google Fonts (`https://fonts.google.com/specimen/JetBrains+Mono`).

Both are loaded via the app's global stylesheet. Do not substitute with system fonts in shipped UI.

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `display-xl` | 48px / 3rem | 1.1 | 700 | Hero headlines on landing pages |
| `display-lg` | 36px / 2.25rem | 1.15 | 700 | Section headlines |
| `heading-xl` | 30px / 1.875rem | 1.2 | 600 | Page titles |
| `heading-lg` | 24px / 1.5rem | 1.25 | 600 | Card headings, modal titles |
| `heading-md` | 20px / 1.25rem | 1.3 | 600 | Sub-section headings |
| `heading-sm` | 16px / 1rem | 1.4 | 600 | Label headings, table headers |
| `body-lg` | 16px / 1rem | 1.6 | 400 | Long-form body text, feature descriptions |
| `body-md` | 14px / 0.875rem | 1.6 | 400 | Default UI text, form fields |
| `body-sm` | 12px / 0.75rem | 1.5 | 400 | Captions, helper text, timestamps |
| `code` | 13px / 0.8125rem | 1.6 | 400 | Inline code, code blocks |

### Usage Rules

- **Minimum body size**: 14px for all paragraph text; 12px only for secondary metadata
- **Line length**: 60–80 characters per line for sustained reading
- **Heading hierarchy**: Never skip levels (h1 → h3 without h2)
- **Code blocks**: Always JetBrains Mono; background `#f1f5f9` (light theme) or `#1e293b` (dark theme)
- **Numbers in data tables**: Use tabular figures (`font-variant-numeric: tabular-nums`)
- **Letter spacing**: `-0.3px` on wordmark text; `0` on all body and UI text; `0.05em` on uppercase labels

---

## Spacing & Grid

### Base Unit

The base spacing unit is **4px**. All spacing values are multiples of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight internal padding (icon gaps, badge padding) |
| `space-2` | 8px | Element internal padding (chips, small buttons) |
| `space-3` | 12px | Input padding, small gaps |
| `space-4` | 16px | Default component padding, grid column gaps |
| `space-5` | 20px | Medium gaps, button horizontal padding |
| `space-6` | 24px | Section padding, card padding |
| `space-8` | 32px | Large component separation |
| `space-10` | 40px | Section breaks |
| `space-12` | 48px | Major layout sections |
| `space-16` | 64px | Page-level separation |
| `space-24` | 96px | Hero / marketing spacing |

### Layout Grid

**Marketing / Landing pages**:
- Max content width: `1200px`
- Horizontal padding: `24px` (mobile) → `48px` (tablet) → `80px` (desktop)
- Grid columns: 4 (mobile) / 8 (tablet) / 12 (desktop)
- Column gutter: `24px`

**Dashboard / App**:
- Sidebar width: `240px` (expanded) / `64px` (collapsed)
- Top bar height: `56px`
- Content area: fluid, max `1280px`
- Card grid: 1 col (mobile) / 2 col (tablet) / 3–4 col (desktop)
- Default card padding: `24px`

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Badges, tags, code chips |
| `radius-md` | 8px | Buttons, inputs, dropdowns |
| `radius-lg` | 12px | Cards, panels, modals |
| `radius-xl` | 16px | Large feature cards |
| `radius-full` | 9999px | Pills, avatars, toggle tracks |

### Elevation / Shadow

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle card lift |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Hover cards, dropdowns |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, popovers |

---

## Components (shadcn/ui)

This product uses **shadcn/ui** as its base component library. Customization is applied via Tailwind CSS tokens that map to the brand palette above.

### Component Defaults

| Component | Key Customization |
|-----------|------------------|
| Button (primary) | `bg-blue-500` (`#3b82f6`), white text, `radius-md` |
| Button (secondary) | `bg-slate-800` (`#1e293b`), white text, `radius-md` |
| Button (outline) | border `#334155`, text `#1e293b`, transparent bg |
| Button (ghost) | transparent bg, text `#6b7280`, hover `bg-slate-100` |
| Input | border `#e5e7eb`, focus ring `#3b82f6`, `radius-md` |
| Card | bg `#ffffff` (light) / `#1e293b` (dark), border `#e5e7eb` / `#334155`, `radius-lg` |
| Badge | varies by status (see Status Badges below) |
| Dialog / Modal | bg `#ffffff` / `#1e293b`, `shadow-lg`, `radius-lg` |
| Select / Dropdown | border `#e5e7eb`, bg `#ffffff`, focus `#3b82f6` |
| Tabs | active: text `#3b82f6`, border-b `#3b82f6`; inactive: text `#6b7280` |
| Toggle | checked: `#3b82f6`; unchecked: `#e5e7eb` |

### Button Hierarchy

```
Primary CTA:    [  Get Started  ]   bg #3b82f6, text white, radius 8px, px 20px py 10px
Secondary:      [  Learn More   ]   bg #1e293b, text white, radius 8px
Outline:        [  View Docs    ]   bg white, border #334155, text #1e293b
Ghost:          [  Cancel       ]   bg transparent, text #6b7280
Destructive:    [  Delete       ]   bg white, border #dc2626, text #dc2626
```

### Status Badges

```
active      ●  bg #d1fae5  text #059669
inactive    ●  bg #e2e8f0  text #334155
error       ●  bg #fee2e2  text #dc2626
pending     ●  bg #dbeafe  text #3b82f6
warning     ●  bg #fef3c7  text #d97706
```

---

## Iconography

- **Library**: `lucide-react` (stroke-based, 24px default)
- **Stroke width**: 1.5px for UI icons; 2px for emphasis icons
- **Icon size**: 16px (inline text), 20px (button icons), 24px (standalone), 32px (feature icons)
- **Color**: Match text color of context; use `#3b82f6` for active/interactive states
- **Alignment**: Always vertically center-aligned with adjacent text
- **Never** mix filled icon variants with stroke variants in the same context

---

## Dark / Light Theme

The product ships with both light and dark themes. Theme is applied via a `data-theme` attribute on `<html>` and Tailwind's `dark:` variant.

### Light Theme Defaults
- Page background: `#ffffff`
- Card surface: `#f8fafc`
- Primary text: `#0f172a`
- Border: `#e5e7eb`
- Sidebar background: `#1e293b` (dark sidebar on light body is the standard pattern)

### Dark Theme Defaults
- Page background: `#0f172a`
- Card surface: `#1e293b`
- Primary text: `#f1f5f9`
- Border: `#334155`
- Sidebar background: `#1e293b`

### Switching Rules
- Use CSS custom properties (`--color-surface`, `--color-text`, etc.) for all dynamic values
- Never hardcode theme-specific colors outside of the Tailwind config
- Icons and illustrations must have sufficient contrast in both themes — test both before shipping

---

## Visual Examples

### Card (Dark Theme)

```
┌─────────────────────────────────────────┐
│  Feature Name                    [Edit] │  ← text #f1f5f9, button ghost
│─────────────────────────────────────────│  ← border #334155
│  Description text in body-md style.     │
│  Secondary detail  ·  2 min ago         │  ← text #94a3b8, body-sm
└─────────────────────────────────────────┘
   Surface 1 (#1e293b), radius 12px, padding 24px
```

### Data Table Row

```
┌────────────────┬──────────────┬────────────────┬───────────┐
│ Name           │ Status       │ Updated        │ Action    │
├────────────────┼──────────────┼────────────────┼───────────┤
│ Item label     │ ● active     │ 2 min ago      │ [View]    │
│ Another item   │ ● pending    │ 1 hr ago       │ [View]    │
└────────────────┴──────────────┴────────────────┴───────────┘
Header: bg #f8fafc, text #374151, font-weight 600, font-size 12px uppercase
Row: bg white, hover bg #f8fafc
```

### Code Block (Dark Surface)

```
┌─────────────────────────────────────────┐
│  GET /api/health                        │  ← text #94a3b8, body-sm
│─────────────────────────────────────────│  ← border #334155
│  {                                      │
│    "status": "ok",                      │  ← JetBrains Mono 13px
│    "db": "connected"                    │     text #f1f5f9
│  }                                      │
└─────────────────────────────────────────┘
   Surface 1 (#1e293b), radius 8px, padding 16px
```

### Sidebar Navigation (Dark)

```
┌─────────────────────┐
│  [◇] Product Name   │  ← logo mark 24px + wordmark, top padding 20px
│─────────────────────│
│  Dashboard          │  ← active: text #3b82f6, bg rgba(59,130,246,0.1)
│  Settings           │  ← default: text #94a3b8, hover text #f1f5f9
│  Users              │
└─────────────────────┘
   bg #1e293b, width 240px
```

---

## Responsive Breakpoints

| Name | Width | Notes |
|------|-------|-------|
| `sm` | 640px | Small tablets, large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Wide monitors |

These match Tailwind's default breakpoints. The app sidebar collapses to icon-only below `lg`.

---

## Logo Usage in Context

### App Header (Light Body + Dark Sidebar)

The standard dashboard layout uses a dark sidebar (`#1e293b`) alongside a light content area. In the sidebar, use `logo-on-dark.svg` (mark on dark chip, white wordmark text).

### Marketing / Landing Page

Use `logo-dark.svg` (mark + dark text wordmark) on white or light-gray backgrounds. Minimum clear space: 20px on all sides at standard desktop sizes.

### Favicon

Use `favicons/favicon.svg` — the mark stripped to minimum strokes at 32×32. At 16px, only the bracket forms are legible; the slash may simplify or be omitted in the `.ico` fallback.

### Email / Notifications

Use `logo-wordmark-white.svg` on a `#1e293b` email header bar. Minimum email header height: 48px.

---

## Forking This Template

When forking `product-template` for a new product:

1. Replace all logo files in `assets/logos/` with the product's own SVG marks
2. Update `assets/favicons/` with the product-specific favicon
3. Replace this file with the product's actual brand guidelines
4. Update `assets/og/` with generated OG images
5. Update color tokens throughout to match the product's brand palette
6. Do not retain "Product Template" naming, color values, or mark geometry in the fork

The template's slate/blue palette is a neutral foundation — each product ships its own distinct brand identity.
