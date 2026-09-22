# Protocol #21 — Component Folder Pattern

> Purpose: the `ComponentName/index.jsx` folder convention used by `components/@system` and `components/@custom`. An optional `index.scss` sits beside the component when Tailwind classes are not enough (most components have none).
> Last verified: 2026-09-20 (`client/src/app/components/@system/*`, `client/webpack.config.mjs` aliases).

---

## Why this pattern

Each component lives in its own folder. The folder name is the component's public name. Entry points are always `index.jsx` and `index.scss`.

**Benefits:**
- Importing `@system/Sidebar` resolves to `@system/Sidebar/index.jsx` automatically — no explicit file extension needed.
- Co-located styles: `index.scss` lives next to `index.jsx`, not in a global styles folder.
- Easy to add sibling files (tests, sub-components, types) without restructuring.
- Consistent across `@system` and `@custom`.

---

## Anatomy of a component folder

```
components/
└── @custom/
    └── HeroSection/
        ├── index.jsx     ← component implementation + named export
        └── index.scss    ← component-scoped styles (optional but always present)
```

### `index.jsx`

- Contains the full component implementation.
- Uses **named exports** (not default exports).
- First line: `// @custom — <one-line description>` or `// @system — <one-line description>`.
- Imports its own styles with `import './index.scss'` when the scss file has non-trivial rules.

```jsx
// @custom — hero section for the landing page
import './index.scss'
import { cn } from '@/app/lib/@system/utils'

export function HeroSection({ headline, cta }) {
  return (
    <section className={cn('hero-section', 'container mx-auto px-4 py-20')}>
      <h1 className="text-4xl font-bold">{headline}</h1>
      <a href={cta.href} className="btn-primary mt-6 inline-block">{cta.label}</a>
    </section>
  )
}
```

### `index.scss`

- Scoped to this component only.
- Use Tailwind utilities in JSX first; add SCSS only for things Tailwind can't express (complex media queries, pseudo-selectors, animations).
- Always create the file even if it starts empty — it signals "styles intentionally absent."

```scss
// HeroSection styles
// Tailwind handles layout — custom rules for edge cases only.

@media (max-width: 479px) {
  .hero-section {
    padding-top: 3rem;
    padding-bottom: 3rem;
  }
}
```

---

## Creating a new component

1. Create the folder under the right namespace:
   - Product-specific → `components/@custom/MyComponent/`
   - Template (never modified in products) → `components/@system/MyComponent/`

2. Create `index.jsx` with a named export:
   ```jsx
   // @custom — <description>
   export function MyComponent({ prop }) {
     return <div>{prop}</div>
   }
   ```

3. Create `index.scss` (even if empty):
   ```scss
   // MyComponent styles
   ```

4. Register the export in the barrel file:
   - `@custom` → add to `components/@custom/index.jsx`
   - `@system` → add to `components/@system/index.js`

   ```js
   // components/@custom/index.jsx
   export { MyComponent } from './MyComponent'
   ```

5. Import from the barrel in consuming files:
   ```jsx
   import { MyComponent } from '@/app/components/@custom'
   // or for @system:
   import { Sidebar } from '@/app/components/@system'
   ```

---

## Refactoring an existing flat component

If you have a component file like `components/@custom/OldWidget.jsx`:

1. Create the folder: `components/@custom/OldWidget/`
2. Move `OldWidget.jsx` → `OldWidget/index.jsx`
3. Rename the import inside the file from `OldWidget.jsx` to nothing (folder resolution handles it).
4. Create `OldWidget/index.scss` (empty is fine).
5. Update the barrel: change `from './OldWidget.jsx'` → `from './OldWidget'` (or it already works via index resolution).
6. Find all consumers that imported `./OldWidget/OldWidget` or `./OldWidget.jsx` and normalize to `./OldWidget`.

---

## Import conventions

| Scenario | Import style |
|----------|-------------|
| Consuming a component inside an app page | `import { Foo } from '@/app/components/@custom'` |
| Consuming a @system component | `import { Sidebar } from '@/app/components/@system'` |
| One component importing a sibling within the same folder | `import { helper } from './utils'` (relative) |
| Never do | `import Foo from './Foo/Foo.jsx'` (redundant path + default export) |

Always use **named exports**. Default exports make barrel re-exports awkward and grep harder.

---

## `@system` vs `@custom`

| | `@system` | `@custom` |
|--|-----------|-----------|
| Source | Template repo | Per-product, never overwritten by template sync |
| Modify? | No — copy to `@custom` and adapt | Yes — this is your product code |
| Barrel | `@system/index.js` | `@custom/index.jsx` |
| First-line comment | `// @system — ...` | `// @custom — ...` |

If you need a variant of a `@system` component, create it in `@custom` — do not edit `@system` directly.

---

## Sub-components

For complex components with internal parts, keep them in the same `index.jsx` unless they are reusable outside this component:

```jsx
// @custom — pricing card with tier toggle
// AccordionItem is internal-only, not exported
function TierBadge({ tier }) { ... }         // internal helper
function PricingCard({ tier, price }) { ... } // internal helper

export function PricingSection({ tiers }) {
  return <div>{tiers.map(t => <PricingCard key={t.id} {...t} />)}</div>
}
```

If a sub-component becomes reusable, promote it to its own folder.

---

## Checklist when adding a component

- [ ] Folder name matches the export name exactly (case-sensitive)
- [ ] `index.jsx` uses a named export (not default)
- [ ] `index.scss` file exists
- [ ] First line comment: `// @custom —` or `// @system —`
- [ ] Barrel file updated (`@custom/index.jsx` or `@system/index.js`)
- [ ] No `ComponentName/ComponentName.jsx` double-nesting
- [ ] Consumers import from the barrel, not the file path directly
