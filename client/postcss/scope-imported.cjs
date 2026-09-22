/**
 * scope-imported.cjs — PostCSS plugin that confines the cloner's stylesheet to the
 * imported pages.
 *
 * Orkosi's website cloner drops an existing site's CSS into
 * client/src/app/styles/@custom/imported/site.css. That file was written for a
 * whole document (`body { … }`, `h1 { … }`, `.container { … }`) and, imported as a
 * plain global stylesheet, it restyled the template's own pages (auth, admin,
 * legal). This plugin rewrites every selector in files under
 * styles/@custom/imported/ so it only matches inside the `<div data-imported-root>`
 * wrapper (components/@system/site/ImportedRoot.jsx) that every imported page
 * renders:
 *
 *   h1 { }                  →  [data-imported-root] h1 { }
 *   body { }                →  [data-imported-root] { }
 *   html body.dark .x { }   →  [data-imported-root].dark .x { }
 *   :root { --c: red }      →  [data-imported-root] { --c: red }
 *   .hero, .cta { }         →  [data-imported-root] .hero, [data-imported-root] .cta { }
 *   @media … { .x { } }     →  @media … { [data-imported-root] .x { } }
 *   @keyframes / @font-face →  untouched (no element selectors)
 *
 * Cascade ordering (documented in docs/INFORMATIONAL-SPEC.md §6): the imported
 * stylesheet is deliberately NOT wrapped in a CSS `@layer`. Tailwind's preflight
 * and utilities are unlayered, and unlayered rules beat layered ones regardless of
 * specificity — a layered `[data-imported-root] h1` would lose to preflight's
 * `h1 { font-size: inherit }` and the imported site would look unstyled. The
 * attribute prefix instead raises every imported selector by one attribute of
 * specificity, so imported rules win over preflight and over utility classes on
 * the same element, while not matching anything outside the wrapper.
 *
 * Options: { prefix = '[data-imported-root]', test = /styles[\/]@custom[\/]imported[\/]/ }
 * Only files whose path matches `test` are rewritten; every other stylesheet is
 * passed through untouched, so the plugin is safe to register globally.
 */

'use strict'

const DEFAULT_PREFIX = '[data-imported-root]'
const DEFAULT_TEST = /[\\/]styles[\\/]@custom[\\/]imported[\\/]/

function isInsideKeyframes(rule) {
  let node = rule.parent
  while (node) {
    if (node.type === 'atrule' && /keyframes$/i.test(node.name)) return true
    node = node.parent
  }
  return false
}

/** Prefix one selector (no comma). Exported for unit tests. */
function scopeSelector(selector, prefix = DEFAULT_PREFIX) {
  let sel = selector.trim()
  if (!sel) return sel
  if (sel.startsWith(prefix)) return sel
  // `html body …` → treat as the wrapper itself
  sel = sel.replace(/^html(?:[^\s,>+~]*)\s+body(?=$|[\s.:#[>+~])/i, 'body')
  // Root-level element selectors that mean "the page" now mean "the wrapper".
  // Compound extras on them (body.dark, html[data-theme]) are kept on the wrapper.
  if (/^(?:html|body|:root)(?=$|[\s.:#[>+~])/i.test(sel)) {
    return sel.replace(/^(?:html|body|:root)/i, prefix)
  }
  return `${prefix} ${sel}`
}

function scopeImported(options = {}) {
  const prefix = options.prefix || DEFAULT_PREFIX
  const test = options.test || DEFAULT_TEST
  return {
    postcssPlugin: 'scope-imported-css',
    Once(root, { result }) {
      const file = (root.source && root.source.input && root.source.input.file) || (result.opts && result.opts.from) || ''
      if (!test.test(file)) return
      root.walkRules((rule) => {
        if (isInsideKeyframes(rule)) return
        rule.selectors = rule.selectors.map((s) => scopeSelector(s, prefix))
      })
    },
  }
}

scopeImported.postcss = true
scopeImported.scopeSelector = scopeSelector
scopeImported.DEFAULT_PREFIX = DEFAULT_PREFIX
scopeImported.DEFAULT_TEST = DEFAULT_TEST

module.exports = scopeImported
