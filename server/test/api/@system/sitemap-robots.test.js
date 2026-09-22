/**
 * API tests — dynamic /sitemap.xml and /robots.txt (informational template).
 *
 * The informational site is a single page with anchored sections; the SaaS
 * foundation's standalone `/contact` page must not be advertised (the
 * contact form lives at `/#contact`). Blog posts are appended when the table
 * exists and skipped (42P01) when it does not.
 */

const request = require('supertest')

// The blog module is disabled by default for the informational template
// (brand.json modules.blog); the sitemap only appends posts when it is on.
// Helpers/modules.js reads MODULES_JSON when the app loads.
process.env.MODULES_JSON = JSON.stringify({ blog: true })
afterAll(() => { delete process.env.MODULES_JSON })

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
  result: jest.fn(),
  tx: jest.fn(),
}))
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: { get: jest.fn(async () => null), set: jest.fn(), del: jest.fn(), exists: jest.fn(async () => 0), incr: jest.fn(async () => 1), expire: jest.fn(), ttl: jest.fn(async () => -1) },
  isReady: () => false,
}))
jest.mock('../../../src/lib/@system/Email', () => ({ send: jest.fn(), sendEmail: jest.fn() }))

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')
const { STATIC_PAGES } = require('../../../src/api/@system/sitemap')

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.APP_URL
})

describe('GET /sitemap.xml', () => {
  it('serves XML with the informational URLs and the request host', async () => {
    db.any.mockResolvedValueOnce([])
    const res = await request(app).get('/sitemap.xml').set('Host', 'example.test')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/xml/)
    expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    const urls = locs(res.text)
    expect(urls).toEqual(expect.arrayContaining(['http://example.test/', 'http://example.test/privacy', 'http://example.test/terms', 'http://example.test/cookies']))
  })

  it('does NOT advertise the SaaS /contact page (the form is at /#contact)', async () => {
    db.any.mockResolvedValueOnce([])
    const res = await request(app).get('/sitemap.xml').set('Host', 'example.test')
    expect(locs(res.text)).not.toContain('http://example.test/contact')
    expect(STATIC_PAGES.map((p) => p.path)).not.toContain('/contact')
  })

  it('does not advertise opt-in pricing/blog index pages by default', async () => {
    db.any.mockResolvedValueOnce([])
    const res = await request(app).get('/sitemap.xml').set('Host', 'example.test')
    const urls = locs(res.text)
    expect(urls).not.toContain('http://example.test/pricing')
    expect(urls).not.toContain('http://example.test/blog')
  })

  it('prefers APP_URL over the request host and appends published posts', async () => {
    process.env.APP_URL = 'https://www.example.com/'
    db.any.mockResolvedValueOnce([{ slug: 'hello', published_at: '2026-01-02T00:00:00Z', updated_at: null }])
    const res = await request(app).get('/sitemap.xml').set('Host', 'ignored.test')
    const urls = locs(res.text)
    expect(urls[0]).toBe('https://www.example.com/')
    expect(urls).toContain('https://www.example.com/blog/hello')
    expect(res.text).toContain('<lastmod>2026-01-02</lastmod>')
  })

  it('still renders when the blog table is missing (42P01)', async () => {
    db.any.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: '42P01' }))
    const res = await request(app).get('/sitemap.xml').set('Host', 'example.test')
    expect(res.status).toBe(200)
    expect(locs(res.text)).toContain('http://example.test/')
  })
})

describe('GET /robots.txt', () => {
  it('serves text/plain, disallows private areas and points to the sitemap on the request host', async () => {
    const res = await request(app).get('/robots.txt').set('Host', 'example.test')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.text).toContain('User-agent: *')
    expect(res.text).toContain('Allow: /')
    expect(res.text).toContain('Disallow: /api/')
    expect(res.text).toContain('Disallow: /app/')
    expect(res.text).toContain('Sitemap: http://example.test/sitemap.xml')
  })
})
