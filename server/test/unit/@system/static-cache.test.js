// @system — Cache-Control for the built client served by express.static
// (server/src/lib/@system/staticCache.js, wired in server/src/app.js): hashed
// bundles immutable for a year, HTML never cached, everything else one hour.
// Plus the sitemap route's public 1 h cache header.

const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')

const { cacheControlFor, staticOptions, IMMUTABLE, HTML, SHORT } = require('../../../src/lib/@system/staticCache')

describe('cacheControlFor', () => {
  it.each([
    ['js/main.93f1a327.js', IMMUTABLE],
    ['js/429.9192ecb8.chunk.js', IMMUTABLE],
    ['js/pages-app.69f7bf8e.chunk.js.gz', IMMUTABLE],
    ['js/vendors.ee5e3f34.js.br', IMMUTABLE],
    ['js/vendors.ee5e3f34.js.map', IMMUTABLE],
    ['css/main.69fe672a.css', IMMUTABLE],
    ['css/pages-static.874b3ab5.chunk.css', IMMUTABLE],
    ['assets/inter.1a2b3c4d.woff2', IMMUTABLE],
    ['/js/main.93f1a327.js', IMMUTABLE],
    ['js\\main.93f1a327.js', IMMUTABLE],
  ])('%s → immutable', (p, expected) => {
    expect(cacheControlFor(p)).toBe(expected)
  })

  it.each(['index.html', 'menu/index.html', 'about/team/index.html', 'og-dark.html'])('%s → no-cache', (p) => {
    expect(cacheControlFor(p)).toBe(HTML)
  })

  it.each([
    'favicon.svg',
    'robots.txt',
    'manifest.json',
    'cookie-consent.js',
    'sitemap.xml',
    'assets/logos/logo-mark.svg',
    'assets/og/og-image.png',
    'imported/assets/hero.jpg',
    'js/main.js', // dev-style unhashed name
    'prerender.json',
  ])('%s → short public cache', (p) => {
    expect(cacheControlFor(p)).toBe(SHORT)
  })
})

describe('express.static with staticOptions', () => {
  let dir
  let app
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-cache-'))
    fs.mkdirSync(path.join(dir, 'js'))
    fs.mkdirSync(path.join(dir, 'menu'))
    fs.writeFileSync(path.join(dir, 'js', 'main.93f1a327.js'), 'console.log(1)')
    fs.writeFileSync(path.join(dir, 'favicon.svg'), '<svg/>')
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>')
    fs.writeFileSync(path.join(dir, 'menu', 'index.html'), '<html>menu</html>')
    app = express()
    app.use(express.static(dir, staticOptions(dir)))
    app.use((_req, res) => res.status(404).json({ fellThrough: true }))
  })

  it('hashed bundle → 1y immutable', async () => {
    const res = await request(app).get('/js/main.93f1a327.js')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable')
  })

  it('unhashed static file → 1 h', async () => {
    const res = await request(app).get('/favicon.svg')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=3600')
  })

  it('HTML fetched directly → no-cache; directories fall through to spaFallback (index: false, no 301 to a trailing slash)', async () => {
    const direct = await request(app).get('/menu/index.html')
    expect(direct.status).toBe(200)
    expect(direct.headers['cache-control']).toBe('no-cache, no-store, must-revalidate')
    expect((await request(app).get('/')).body).toEqual({ fellThrough: true })
    // prerender.mjs creates dist/menu/ — serve-static's default `redirect: true`
    // would answer 301 → /menu/ here, which spaFallback must get to serve instead.
    const dirReq = await request(app).get('/menu')
    expect(dirReq.status).toBe(404)
    expect(dirReq.body).toEqual({ fellThrough: true })
  })
})

describe('GET /sitemap.xml', () => {
  it('is public and cacheable for an hour', async () => {
    jest.resetModules()
    jest.doMock('../../../src/lib/@system/PostgreSQL', () => ({ any: jest.fn().mockRejectedValue(new Error('no db in unit tests')) }))
    const sitemapRouter = require('../../../src/api/@system/sitemap')
    const app = express()
    app.use(sitemapRouter)
    const res = await request(app).get('/sitemap.xml').set('Host', 'acme.test')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/xml/)
    expect(res.headers['cache-control']).toBe('public, max-age=3600, s-maxage=3600')
    expect(res.text).toContain('<loc>http://acme.test/</loc>')
    jest.dontMock('../../../src/lib/@system/PostgreSQL')
  })
})
