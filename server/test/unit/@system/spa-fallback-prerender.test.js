// @system — spaFallback serves the prerendered snapshot client/scripts/prerender.mjs
// writes to dist/<route>/index.html when one exists, falls back to the shell
// otherwise, and treats prerendered routes as known (200) even though @custom
// routes are absent from the @system manifest.

const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')

const spaFallback = require('../../../src/lib/@system/spaFallback')

const SHELL = `<!doctype html><html lang="en"><head><title>Shell</title>
<meta name="description" content="shell" />
<meta property="og:title" content="shell" /><meta property="og:description" content="shell" />
<meta property="og:url" content="__PAGE_URL__" /><meta name="twitter:title" content="shell" />
<meta name="twitter:description" content="shell" /><meta name="twitter:url" content="__PAGE_URL__" />
<link rel="canonical" href="__PAGE_URL__" /><script type="application/ld+json">{"url":"__APP_URL__/"}</script>
</head><body><div id="root"><main><h1>Shell</h1></main></div></body></html>`
const MENU = SHELL.replace('<h1>Shell</h1>', '<h1>Menu snapshot</h1>').replace('__PAGE_URL__', '__APP_URL__/menu')

let dir
let prevDir

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-prerender-'))
  fs.writeFileSync(path.join(dir, 'index.html'), SHELL)
  fs.mkdirSync(path.join(dir, 'menu'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'menu', 'index.html'), MENU)
  fs.mkdirSync(path.join(dir, 'about', 'team'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'about', 'team', 'index.html'), SHELL.replace('Shell</h1>', 'Team snapshot</h1>'))
  prevDir = process.env.SPA_HTML_DIR
  process.env.SPA_HTML_DIR = dir
  spaFallback.resetCaches()
})

afterAll(() => {
  if (prevDir === undefined) delete process.env.SPA_HTML_DIR
  else process.env.SPA_HTML_DIR = prevDir
  spaFallback.resetCaches()
})

describe('prerenderedRelPath — safe mapping route → dist/<route>/index.html', () => {
  it.each([
    ['/menu', path.join('menu', 'index.html')],
    ['/menu/', path.join('menu', 'index.html')],
    ['/about/team', path.join('about', 'team', 'index.html')],
  ])('%s → %s', (route, rel) => {
    expect(spaFallback.prerenderedRelPath(route)).toBe(rel)
  })

  it.each(['/', '/../etc/passwd', '/menu/../../x', '/.hidden', '/a%2Fb', '/menu.html', '/x y', '//menu', ''])(
    'rejects %s',
    (route) => {
      expect(spaFallback.prerenderedRelPath(route)).toBeNull()
    },
  )
})

describe('loadHtmlFor / isKnownRoute', () => {
  it('returns the route snapshot when present, the shell otherwise', () => {
    expect(spaFallback.loadHtmlFor('/menu')).toContain('Menu snapshot')
    expect(spaFallback.loadHtmlFor('/about/team')).toContain('Team snapshot')
    expect(spaFallback.loadHtmlFor('/nothing-here')).toContain('<h1>Shell</h1>')
    expect(spaFallback.loadHtmlFor('/')).toContain('<h1>Shell</h1>')
  })

  it('caches lookups (including misses) so the request path never re-reads the disk', () => {
    spaFallback.resetCaches()
    const spy = jest.spyOn(fs, 'readFileSync')
    const reads = (needle) => spy.mock.calls.filter(([p]) => String(p).includes(needle)).length
    spaFallback.loadHtmlFor('/menu')
    spaFallback.loadHtmlFor('/missing')
    const menuFirst = reads(path.join('menu', 'index.html'))
    const missingFirst = reads('missing') // one attempt per candidate dir (SPA_HTML_DIR, cwd/client/dist)
    spaFallback.loadHtmlFor('/menu')
    spaFallback.loadHtmlFor('/missing')
    spaFallback.loadHtmlFor('/missing')
    const menuAfter = reads(path.join('menu', 'index.html'))
    const missingAfter = reads('missing')
    spy.mockRestore()
    expect(menuFirst).toBe(1)
    expect(missingFirst).toBeGreaterThanOrEqual(1)
    expect(menuAfter).toBe(menuFirst)
    expect(missingAfter).toBe(missingFirst)
  })

  it('treats a prerendered @custom route as known even though the manifest does not list it', () => {
    expect(spaFallback.isKnownRoute('/menu')).toBe(true)
    expect(spaFallback.isKnownRoute('/about/team')).toBe(true)
  })
})

describe('middleware', () => {
  let app
  beforeAll(() => {
    app = express()
    app.use(spaFallback)
    app.use((_req, res) => res.status(404).json({ message: 'Not found' }))
  })

  it('GET /menu → 200 with the snapshot body, per-route URLs and no-cache', async () => {
    const res = await request(app).get('/menu').set('Host', 'acme.test')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate')
    expect(res.text).toContain('Menu snapshot')
    expect(res.text).toContain('<link rel="canonical" href="http://acme.test/menu" />')
    expect(res.text).toContain('{"url":"http://acme.test/"}')
    expect(res.text).not.toContain('__APP_URL__')
  })

  it('GET / → 200 with the shell (dist/index.html)', async () => {
    const res = await request(app).get('/').set('Host', 'acme.test')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<h1>Shell</h1>')
  })

  it('GET /definitely-not-a-route → 404 + noindex, still HTML', async () => {
    const res = await request(app).get('/definitely-not-a-route').set('Host', 'acme.test')
    expect(res.status).toBe(404)
    expect(res.text).toContain('noindex, nofollow')
    expect(res.text).toContain('<h1>Shell</h1>')
  })

  it('skips API, health and asset requests', async () => {
    expect((await request(app).get('/api/x')).status).toBe(404)
    expect((await request(app).get('/menu/index.html')).status).toBe(404) // static server territory
    expect((await request(app).get('/health')).status).toBe(404)
  })
})
