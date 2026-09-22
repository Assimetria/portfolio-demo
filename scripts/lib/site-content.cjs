/**
 * site-content.cjs — load the merged informational site content at BUILD time.
 *
 * Node-only (fs + Babel). Used by client/webpack.config.mjs (index.html fallback,
 * JSON-LD, <html lang>) and client/scripts/prerender.mjs. The browser bundle merges
 * the same three layers at runtime in client/src/config/index.js; both sides share
 * deepMerge from scripts/lib/site-brand.cjs so they can never disagree.
 *
 * The content modules are ES modules (`export default {…}`) inside a CommonJS
 * package, so Node cannot `require()` them and dynamic `import()` only works via
 * syntax detection (with a MODULE_TYPELESS_PACKAGE_JSON warning on every build).
 * They are therefore compiled to CommonJS with the client's own @babel/preset-env
 * and evaluated in isolation. Content modules MUST be pure data: any `import`
 * inside them fails loudly here (the browser bundle would still work, the build
 * artefacts would silently fall back to the layer below — so we refuse instead).
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')
const { mergeSiteLayers } = require('./site-brand.cjs')

const LAYERS = Object.freeze({
  system: 'client/src/app/content/@system/site.js',
  generated: 'client/src/app/content/@generated/site.brand.js',
  custom: 'client/src/app/content/@custom/site.js',
})

let babelCache = null

function loadBabel(clientDir) {
  if (babelCache) return babelCache
  const req = createRequire(path.join(clientDir, 'package.json'))
  const core = req('@babel/core')
  const presetEnv = req.resolve('@babel/preset-env')
  babelCache = { core, presetEnv }
  return babelCache
}

/**
 * Evaluate a pure-data ES module file and return its default export.
 * `require` inside the module throws — content files must not import anything.
 */
function loadEsmData(file, { clientDir }) {
  const { core, presetEnv } = loadBabel(clientDir)
  const source = fs.readFileSync(file, 'utf8')
  const { code } = core.transformSync(source, {
    filename: file,
    babelrc: false,
    configFile: false,
    sourceType: 'module',
    presets: [[presetEnv, { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const mod = { exports: {} }
  const rel = path.relative(process.cwd(), file)
  const forbiddenRequire = (id) => {
    throw new Error(
      `${rel} imports "${id}" — site content modules must be pure data (they are evaluated at build time by scripts/lib/site-content.cjs)`,
    )
  }
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, forbiddenRequire)
  const data = mod.exports && mod.exports.__esModule ? mod.exports.default : mod.exports
  if (data === null || typeof data !== 'object') {
    throw new Error(`${rel} must \`export default\` an object`)
  }
  return data
}

/**
 * Load the three layers under `root` and merge them.
 * Missing generated/custom layers are treated as {} (system is required).
 */
function loadSiteLayers({ root = path.resolve(__dirname, '../..') } = {}) {
  const clientDir = path.join(root, 'client')
  const read = (rel, required) => {
    const file = path.join(root, rel)
    if (!fs.existsSync(file)) {
      if (required) throw new Error(`site content layer missing: ${rel}`)
      return {}
    }
    return loadEsmData(file, { clientDir })
  }
  const system = read(LAYERS.system, true)
  const generated = read(LAYERS.generated, false)
  const custom = read(LAYERS.custom, false)
  return { system, generated, custom, merged: mergeSiteLayers(system, generated, custom) }
}

/** Convenience: just the merged content. */
function loadSiteContent(opts) {
  return loadSiteLayers(opts).merged
}

module.exports = { LAYERS, loadEsmData, loadSiteLayers, loadSiteContent }
