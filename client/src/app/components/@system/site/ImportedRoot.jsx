// @system — Wrapper every imported (cloned) page renders around its markup.
//
// The cloner's stylesheet (styles/@custom/imported/site.css) is rewritten at
// build time by client/postcss/scope-imported.cjs so every selector only matches
// inside `[data-imported-root]`. Without this wrapper an imported page renders
// unstyled; with it the imported CSS cannot leak into the template's own pages
// (auth, admin, legal). Contract: docs/INFORMATIONAL-SPEC.md §6.
//
//   import { ImportedRoot } from '@/app/components/@system/site/ImportedRoot'
//   import '../../../../styles/@custom/imported/site.css'
//   export default function Home() {
//     return <ImportedRoot><main>…</main></ImportedRoot>
//   }
export function ImportedRoot({ as: Tag = 'div', children, ...rest }) {
  return (
    <Tag data-imported-root="" {...rest}>
      {children}
    </Tag>
  )
}

export default ImportedRoot
