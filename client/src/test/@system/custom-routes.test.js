// @system — scripts/lib/custom-routes.cjs reads the static route paths out of
// routes/@custom/index.jsx by parsing (not evaluating) the module. Used by
// client/scripts/prerender.mjs to know which routes to snapshot besides `/`.
import fs from 'fs'
import path from 'path'
import * as parser from '@babel/parser'
import { parseCustomRoutePaths, readCustomRoutePaths } from '../../../../scripts/lib/custom-routes.cjs'

const FIXTURE = path.resolve(__dirname, 'fixtures/imported/routes.jsx')
const ROOT = path.resolve(__dirname, '../../../..')

describe('parseCustomRoutePaths', () => {
  it('lists static paths in order and separates dynamic ones', () => {
    const src = fs.readFileSync(FIXTURE, 'utf8')
    const { paths, dynamic, found } = parseCustomRoutePaths(src, { parser, filename: FIXTURE })
    expect(found).toBe(true)
    expect(paths).toEqual(['/', '/menu'])
    expect(dynamic).toEqual(['/blog/:slug'])
  })

  it('reports found:false when the module exports no customRoutes array', () => {
    const { paths, found } = parseCustomRoutePaths('export const other = []', { parser })
    expect(found).toBe(false)
    expect(paths).toEqual([])
  })

  it('ignores non-string and non-root paths, dedupes and trims trailing slashes', () => {
    const src = `const p = '/x'
      export const customRoutes = [{ path: p }, { path: 'relative' }, { path: '/menu/' }, { path: '/menu' }, { path: \`/about\` }]`
    expect(parseCustomRoutePaths(src, { parser }).paths).toEqual(['/menu', '/about'])
  })
})

describe('readCustomRoutePaths — the template routes module', () => {
  it('parses client/src/app/routes/@custom/index.jsx (empty by default)', () => {
    const result = readCustomRoutePaths({ root: ROOT })
    expect(result.found).toBe(true)
    expect(Array.isArray(result.paths)).toBe(true)
    expect(result.paths).not.toContain('/') // SitePage owns `/` until a product overrides it
  })
})
