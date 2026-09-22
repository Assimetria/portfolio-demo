/**
 * custom-routes.cjs — static list of the paths a product registers in
 * client/src/app/routes/@custom/index.jsx (`export const customRoutes = [...]`).
 *
 * The routes module imports React and lazy page components, so it cannot be
 * evaluated outside the bundle. Instead the file is PARSED with @babel/parser and
 * the `path` string literals of the exported array are read off the AST — no
 * regexes over JSX, no evaluation. Used by client/scripts/prerender.mjs to know
 * which routes to snapshot besides `/`, and by the route-contract tests.
 *
 * Dynamic (`/:slug`) and wildcard (`*`) paths are reported separately and never
 * prerendered.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

function loadParser(clientDir) {
  const req = createRequire(path.join(clientDir, 'package.json'))
  return req('@babel/parser')
}

function literalOf(node) {
  if (!node) return null
  if (node.type === 'StringLiteral') return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis.map((q) => q.value.cooked).join('')
  return null
}

/**
 * Parse the routes module source and return { paths, dynamic }.
 *  paths   — static, prerenderable route paths in declaration order (deduped)
 *  dynamic — paths containing `:` or `*` (kept for the caller to report)
 */
function parseCustomRoutePaths(source, { parser, filename = 'index.jsx' } = {}) {
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'], sourceFilename: filename })
  let arrayNode = null
  for (const stmt of ast.program.body) {
    const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt
    if (!decl || decl.type !== 'VariableDeclaration') continue
    for (const d of decl.declarations) {
      if (d.id && d.id.type === 'Identifier' && d.id.name === 'customRoutes' && d.init && d.init.type === 'ArrayExpression') {
        arrayNode = d.init
      }
    }
  }
  const paths = []
  const dynamic = []
  if (!arrayNode) return { paths, dynamic, found: false }
  for (const el of arrayNode.elements) {
    if (!el || el.type !== 'ObjectExpression') continue
    const prop = el.properties.find((p) => p.type === 'ObjectProperty' && ((p.key.type === 'Identifier' && p.key.name === 'path') || literalOf(p.key) === 'path'))
    const value = prop ? literalOf(prop.value) : null
    if (typeof value !== 'string' || !value.startsWith('/')) continue
    const normalised = value.length > 1 ? value.replace(/\/+$/, '') : value
    if (/[:*]/.test(normalised)) {
      if (!dynamic.includes(normalised)) dynamic.push(normalised)
    } else if (!paths.includes(normalised)) {
      paths.push(normalised)
    }
  }
  return { paths, dynamic, found: true }
}

/** Read + parse client/src/app/routes/@custom/index.jsx under `root`. */
function readCustomRoutePaths({ root = path.resolve(__dirname, '../..') } = {}) {
  const clientDir = path.join(root, 'client')
  const file = path.join(clientDir, 'src/app/routes/@custom/index.jsx')
  if (!fs.existsSync(file)) return { paths: [], dynamic: [], found: false, file }
  const parser = loadParser(clientDir)
  return { ...parseCustomRoutePaths(fs.readFileSync(file, 'utf8'), { parser, filename: file }), file }
}

module.exports = { parseCustomRoutePaths, readCustomRoutePaths }
