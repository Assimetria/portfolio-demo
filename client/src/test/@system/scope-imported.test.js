// @system — client/postcss/scope-imported.cjs confines the cloner's stylesheet
// (styles/@custom/imported/*.css) to [data-imported-root]. Contract in
// docs/INFORMATIONAL-SPEC.md §6.
import fs from 'fs'
import path from 'path'
import postcss from 'postcss'
import scopeImported from '../../../postcss/scope-imported.cjs'

const { scopeSelector, DEFAULT_TEST } = scopeImported
const IMPORTED_FILE = '/repo/client/src/app/styles/@custom/imported/site.css'
const OTHER_FILE = '/repo/client/src/app/styles/@custom/general.css'
const FIXTURE_CSS = fs.readFileSync(path.resolve(__dirname, 'fixtures/imported/site.css'), 'utf8')

const run = (css, from) => postcss([scopeImported()]).process(css, { from }).then((r) => r.css)

describe('scopeSelector', () => {
  it.each([
    ['h1', '[data-imported-root] h1'],
    ['.hero .cta:hover', '[data-imported-root] .hero .cta:hover'],
    ['*', '[data-imported-root] *'],
    ['body', '[data-imported-root]'],
    ['html', '[data-imported-root]'],
    [':root', '[data-imported-root]'],
    ['body.dark .x', '[data-imported-root].dark .x'],
    ['html body .x', '[data-imported-root] .x'],
    ['html[data-theme="dark"] body .x', '[data-imported-root] .x'],
    ['body > header', '[data-imported-root] > header'],
    ['[data-imported-root] .already', '[data-imported-root] .already'],
  ])('%s → %s', (input, expected) => {
    expect(scopeSelector(input)).toBe(expected)
  })
})

describe('plugin — files under styles/@custom/imported/', () => {
  it('matches the cloner output path on both separators', () => {
    expect(DEFAULT_TEST.test(IMPORTED_FILE)).toBe(true)
    expect(DEFAULT_TEST.test('C:\\repo\\client\\src\\app\\styles\\@custom\\imported\\site.css')).toBe(true)
    expect(DEFAULT_TEST.test(OTHER_FILE)).toBe(false)
  })

  it('prefixes every selector, including inside @media, and leaves @keyframes/@font-face alone', async () => {
    const out = await run(FIXTURE_CSS, IMPORTED_FILE)
    expect(out).toContain('[data-imported-root] {') // body → wrapper
    expect(out).toContain('[data-imported-root] h1')
    expect(out).toContain('[data-imported-root] .hero,\n[data-imported-root] .menu')
    expect(out).toMatch(/@media \(min-width: 768px\) \{\s*\[data-imported-root\] \.hero/)
    expect(out).toMatch(/@keyframes fade \{\s*from \{/)
    expect(out).toContain("@font-face {\n  font-family: 'Casa'")
    expect(out).not.toMatch(/(^|\n)h1 \{/)
    expect(out).not.toMatch(/(^|\n)body \{/)
  })

  it('does not touch stylesheets outside the imported directory', async () => {
    const css = 'body { margin: 0 }\n.hero { color: red }'
    expect(await run(css, OTHER_FILE)).toBe(css)
  })

  it('honours a custom prefix', async () => {
    const out = await postcss([scopeImported({ prefix: '.legacy' })]).process('h1 { x: y }', { from: IMPORTED_FILE })
    expect(out.css).toBe('.legacy h1 { x: y }')
  })
})
