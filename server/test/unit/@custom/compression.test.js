'use strict'

// Unit tests for the @custom content-type aware compression middleware (SV3-034).

const request = require('supertest')
const express = require('express')
const compressionMiddleware = require('../../../src/middleware/@custom/compression')

const { contentTypeFilter, COMPRESSIBLE_TYPES } = compressionMiddleware

function buildApp(contentType, body) {
  const app = express()
  app.use(compressionMiddleware)
  app.get('/test', (_req, res) => {
    res.set('Content-Type', contentType)
    const payload = typeof body === 'string' ? body : JSON.stringify(body)
    res.send(payload)
  })
  return app
}

function largePayload(size = 2048) {
  return 'x'.repeat(size)
}

// --- contentTypeFilter unit tests ---

describe('contentTypeFilter', () => {
  function fakeRes(type) {
    return { getHeader: () => type }
  }

  it('returns true for every type in COMPRESSIBLE_TYPES', () => {
    for (const ct of COMPRESSIBLE_TYPES) {
      expect(contentTypeFilter({}, fakeRes(ct))).toBe(true)
    }
  })

  it('returns true when Content-Type includes charset suffix', () => {
    expect(contentTypeFilter({}, fakeRes('application/json; charset=utf-8'))).toBe(true)
    expect(contentTypeFilter({}, fakeRes('text/html; charset=utf-8'))).toBe(true)
  })

  it('returns true for case-insensitive matches', () => {
    expect(contentTypeFilter({}, fakeRes('Application/JSON'))).toBe(true)
    expect(contentTypeFilter({}, fakeRes('TEXT/HTML'))).toBe(true)
    expect(contentTypeFilter({}, fakeRes('Image/SVG+XML'))).toBe(true)
  })

  it('returns false for binary image types', () => {
    expect(contentTypeFilter({}, fakeRes('image/png'))).toBe(false)
    expect(contentTypeFilter({}, fakeRes('image/jpeg'))).toBe(false)
    expect(contentTypeFilter({}, fakeRes('image/webp'))).toBe(false)
  })

  it('returns false for video and audio types', () => {
    expect(contentTypeFilter({}, fakeRes('video/mp4'))).toBe(false)
    expect(contentTypeFilter({}, fakeRes('audio/mpeg'))).toBe(false)
  })

  it('returns false for already-compressed archive types', () => {
    expect(contentTypeFilter({}, fakeRes('application/zip'))).toBe(false)
    expect(contentTypeFilter({}, fakeRes('application/gzip'))).toBe(false)
    expect(contentTypeFilter({}, fakeRes('application/octet-stream'))).toBe(false)
  })

  it('falls back when Content-Type header is absent', () => {
    const result = contentTypeFilter({}, fakeRes(undefined))
    expect(typeof result).toBe('boolean')
  })
})

// --- Integration tests with supertest ---

describe('compression middleware integration', () => {
  it('compresses application/json responses above threshold', async () => {
    const data = { items: Array.from({ length: 200 }, (_, i) => ({ id: i, name: `item-${i}` })) }
    const app = buildApp('application/json', data)
    const res = await request(app).get('/test').set('Accept-Encoding', 'gzip').expect(200)
    expect(res.headers['content-encoding']).toBe('gzip')
  })

  it('compresses text/html responses above threshold', async () => {
    const app = buildApp('text/html', `<html><body>${largePayload()}</body></html>`)
    const res = await request(app).get('/test').set('Accept-Encoding', 'gzip').expect(200)
    expect(res.headers['content-encoding']).toBe('gzip')
  })

  it('compresses text/css responses above threshold', async () => {
    const app = buildApp('text/css', `body{color:red}${largePayload()}`)
    const res = await request(app).get('/test').set('Accept-Encoding', 'gzip').expect(200)
    expect(res.headers['content-encoding']).toBe('gzip')
  })

  it('compresses image/svg+xml responses above threshold', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(300)}</svg>`
    const app = buildApp('image/svg+xml', svg)
    const res = await request(app).get('/test').set('Accept-Encoding', 'gzip').expect(200)
    expect(res.headers['content-encoding']).toBe('gzip')
  })

  it('does NOT compress image/png responses', async () => {
    const app = buildApp('image/png', largePayload())
    const res = await request(app).get('/test').set('Accept-Encoding', 'gzip').expect(200)
    expect(res.headers['content-encoding']).toBeUndefined()
  })

  it('does NOT compress application/octet-stream responses', async () => {
    const app = buildApp('application/octet-stream', largePayload())
    const res = await request(app).get('/test').set('Accept-Encoding', 'gzip').expect(200)
    expect(res.headers['content-encoding']).toBeUndefined()
  })

  it('does NOT compress responses below 1 KB threshold', async () => {
    const app = express()
    app.use(compressionMiddleware)
    app.get('/test', (_req, res) => {
      res.set('Content-Type', 'application/json')
      res.send(JSON.stringify({ ok: true }))
    })
    const res = await request(app).get('/test').set('Accept-Encoding', 'gzip').expect(200)
    expect(res.headers['content-encoding']).toBeUndefined()
  })

  it('does NOT compress when client does not accept gzip', async () => {
    const data = { items: Array.from({ length: 200 }, (_, i) => ({ id: i })) }
    const app = buildApp('application/json', data)
    const res = await request(app).get('/test').set('Accept-Encoding', 'identity').expect(200)
    expect(res.headers['content-encoding']).toBeUndefined()
  })
})

// --- Module export shape ---

describe('module exports', () => {
  it('exports a function (Express middleware)', () => {
    expect(typeof compressionMiddleware).toBe('function')
  })

  it('exposes COMPRESSIBLE_TYPES as a non-empty array', () => {
    expect(Array.isArray(COMPRESSIBLE_TYPES)).toBe(true)
    expect(COMPRESSIBLE_TYPES.length).toBeGreaterThan(0)
  })

  it('exposes contentTypeFilter as a function', () => {
    expect(typeof contentTypeFilter).toBe('function')
  })
})

