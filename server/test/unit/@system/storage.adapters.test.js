// Unit tests for StorageAdapter — S3StorageAdapter + LocalStorageAdapter

'use strict'

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../src/lib/@system/Logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

// Mock AWS SDK — we don't want real HTTP calls
jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn()
  const S3Client = jest.fn(() => ({ send: sendMock }))
  return {
    S3Client,
    PutObjectCommand: jest.fn((args) => ({ _type: 'PutObject', ...args })),
    GetObjectCommand: jest.fn((args) => ({ _type: 'GetObject', ...args })),
    DeleteObjectCommand: jest.fn((args) => ({ _type: 'DeleteObject', ...args })),
    HeadObjectCommand: jest.fn((args) => ({ _type: 'HeadObject', ...args })),
    _sendMock: sendMock,
  }
})

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}))

// ── Imports ───────────────────────────────────────────────────────────────────

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { _sendMock: s3Send } = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')
const os = require('os')

// ─────────────────────────────────────────────────────────────────────────────
// S3StorageAdapter
// ─────────────────────────────────────────────────────────────────────────────

describe('S3StorageAdapter', () => {
  let S3StorageAdapter

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset module so the lazy _client is re-created between tests
    jest.resetModules()
    jest.mock('../../../src/lib/@system/Logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }))
    jest.mock('@aws-sdk/client-s3', () => {
      const sendMock = jest.fn()
      const S3Client = jest.fn(() => ({ send: sendMock }))
      return {
        S3Client,
        PutObjectCommand: jest.fn((args) => ({ _type: 'PutObject', ...args })),
        GetObjectCommand: jest.fn((args) => ({ _type: 'GetObject', ...args })),
        DeleteObjectCommand: jest.fn((args) => ({ _type: 'DeleteObject', ...args })),
        HeadObjectCommand: jest.fn((args) => ({ _type: 'HeadObject', ...args })),
        _sendMock: sendMock,
      }
    })
    jest.mock('@aws-sdk/s3-request-presigner', () => ({
      getSignedUrl: jest.fn(),
    }))

    process.env.S3_BUCKET = 'test-bucket'
    process.env.AWS_REGION = 'eu-west-1'
    process.env.AWS_ACCESS_KEY_ID = 'AKIATEST'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret'

    S3StorageAdapter = require('../../../src/lib/@system/StorageAdapter/S3StorageAdapter')
  })

  afterEach(() => {
    delete process.env.S3_BUCKET
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.S3_ENDPOINT
    delete process.env.CDN_URL
  })

  // ── createUploadUrl ─────────────────────────────────────────────────────────

  describe('createUploadUrl()', () => {
    it('returns url, key, publicUrl and expiresAt', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
      getSignedUrl.mockResolvedValue('https://s3.example.com/presigned-put')

      const result = await S3StorageAdapter.createUploadUrl({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })

      expect(result.url).toBe('https://s3.example.com/presigned-put')
      expect(result.key).toMatch(/^uploads\/[0-9a-f-]+\.jpg$/)
      expect(result.publicUrl).toContain('test-bucket')
      expect(result.publicUrl).toContain(result.key)
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('uses custom folder when provided', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
      getSignedUrl.mockResolvedValue('https://presigned')

      const result = await S3StorageAdapter.createUploadUrl({
        filename: 'doc.pdf',
        contentType: 'application/pdf',
        folder: 'documents',
      })

      expect(result.key).toMatch(/^documents\//)
    })

    it('handles filenames without extension', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
      getSignedUrl.mockResolvedValue('https://presigned')

      const result = await S3StorageAdapter.createUploadUrl({
        filename: 'noextension',
        contentType: 'application/octet-stream',
      })

      // Should not end with a dot
      expect(result.key).not.toMatch(/\.$/)
    })

    it('throws when S3_BUCKET is missing', async () => {
      delete process.env.S3_BUCKET
      await expect(
        S3StorageAdapter.createUploadUrl({ filename: 'x.jpg', contentType: 'image/jpeg' })
      ).rejects.toThrow('S3_BUCKET is not configured')
    })
  })

  // ── createDownloadUrl ───────────────────────────────────────────────────────

  describe('createDownloadUrl()', () => {
    it('returns a signed download url and expiresAt', async () => {
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
      getSignedUrl.mockResolvedValue('https://s3.example.com/presigned-get')

      const result = await S3StorageAdapter.createDownloadUrl({ key: 'uploads/abc.jpg' })

      expect(result.url).toBe('https://s3.example.com/presigned-get')
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('throws when S3_BUCKET is missing', async () => {
      delete process.env.S3_BUCKET
      await expect(
        S3StorageAdapter.createDownloadUrl({ key: 'uploads/abc.jpg' })
      ).rejects.toThrow('S3_BUCKET is not configured')
    })
  })

  // ── getPublicUrl ────────────────────────────────────────────────────────────

  describe('getPublicUrl()', () => {
    it('returns default S3 URL', () => {
      const url = S3StorageAdapter.getPublicUrl('uploads/test.jpg')
      expect(url).toBe('https://test-bucket.s3.eu-west-1.amazonaws.com/uploads/test.jpg')
    })

    it('uses CDN_URL when set', () => {
      process.env.CDN_URL = 'https://cdn.example.com'
      const url = S3StorageAdapter.getPublicUrl('uploads/test.jpg')
      expect(url).toBe('https://cdn.example.com/uploads/test.jpg')
    })

    it('uses S3_ENDPOINT when set (path-style)', () => {
      process.env.S3_ENDPOINT = 'http://minio:9000'
      const url = S3StorageAdapter.getPublicUrl('uploads/test.jpg')
      expect(url).toBe('http://minio:9000/test-bucket/uploads/test.jpg')
    })
  })

  // ── delete ──────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('calls DeleteObjectCommand with correct bucket and key', async () => {
      const { _sendMock } = require('@aws-sdk/client-s3')
      _sendMock.mockResolvedValue({})

      await S3StorageAdapter.delete('uploads/file.jpg')

      expect(_sendMock).toHaveBeenCalledTimes(1)
    })

    it('throws when S3_BUCKET is missing', async () => {
      delete process.env.S3_BUCKET
      await expect(S3StorageAdapter.delete('uploads/file.jpg')).rejects.toThrow('S3_BUCKET is not configured')
    })
  })

  // ── exists ──────────────────────────────────────────────────────────────────

  describe('exists()', () => {
    it('returns { exists: true, size, contentType } when object is found', async () => {
      const { _sendMock } = require('@aws-sdk/client-s3')
      _sendMock.mockResolvedValue({ ContentLength: 1024, ContentType: 'image/jpeg' })

      const result = await S3StorageAdapter.exists('uploads/file.jpg')

      expect(result).toEqual({ exists: true, size: 1024, contentType: 'image/jpeg' })
    })

    it('returns { exists: false } on 404', async () => {
      const { _sendMock } = require('@aws-sdk/client-s3')
      const err = Object.assign(new Error('Not Found'), { name: 'NotFound' })
      _sendMock.mockRejectedValue(err)

      const result = await S3StorageAdapter.exists('uploads/missing.jpg')

      expect(result).toEqual({ exists: false })
    })

    it('returns { exists: false } when S3_BUCKET is missing', async () => {
      delete process.env.S3_BUCKET
      const result = await S3StorageAdapter.exists('uploads/file.jpg')
      expect(result).toEqual({ exists: false })
    })

    it('rethrows unexpected errors', async () => {
      const { _sendMock } = require('@aws-sdk/client-s3')
      _sendMock.mockRejectedValue(new Error('Network error'))

      await expect(S3StorageAdapter.exists('uploads/file.jpg')).rejects.toThrow('Network error')
    })
  })

  // ── health ──────────────────────────────────────────────────────────────────

  describe('health()', () => {
    it('reports configured:true when all env vars are set', () => {
      const h = S3StorageAdapter.health()
      expect(h.provider).toBe('s3')
      expect(h.configured).toBe(true)
      expect(h.bucket).toBe('test-bucket')
      expect(h.region).toBe('eu-west-1')
    })

    it('reports configured:false when credentials are missing', () => {
      delete process.env.AWS_ACCESS_KEY_ID
      delete process.env.AWS_SECRET_ACCESS_KEY
      const h = S3StorageAdapter.health()
      expect(h.configured).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorageAdapter
// ─────────────────────────────────────────────────────────────────────────────

describe('LocalStorageAdapter', () => {
  let LocalStorageAdapter
  let tmpDir

  beforeEach(() => {
    jest.resetModules()
    jest.mock('../../../src/lib/@system/Logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }))

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'))
    process.env.LOCAL_STORAGE_DIR = tmpDir
    process.env.APP_URL = 'http://localhost:3000'

    LocalStorageAdapter = require('../../../src/lib/@system/StorageAdapter/LocalStorageAdapter')
  })

  afterEach(() => {
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.LOCAL_STORAGE_DIR
    delete process.env.APP_URL
  })

  // ── createUploadUrl ─────────────────────────────────────────────────────────

  describe('createUploadUrl()', () => {
    it('returns a token-based upload URL', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'avatar.png',
        contentType: 'image/png',
      })

      expect(result.url).toMatch(/^http:\/\/localhost:3000\/api\/storage\/local-upload\?token=/)
      expect(result.key).toMatch(/^uploads\/[0-9a-f-]+\.png$/)
      expect(result.publicUrl).toMatch(/^http:\/\/localhost:3000\/uploads\//)
      expect(result.expiresAt).toBeInstanceOf(Date)
    })

    it('encodes key and expiry in the token', async () => {
      const result = await LocalStorageAdapter.createUploadUrl({
        filename: 'file.txt',
        contentType: 'text/plain',
        expiresIn: 600,
      })

      const tokenParam = new URL(result.url).searchParams.get('token')
      const decoded = JSON.parse(Buffer.from(tokenParam, 'base64url').toString('utf8'))

      expect(decoded.key).toBe(result.key)
      expect(decoded.contentType).toBe('text/plain')
      expect(decoded.exp).toBeGreaterThan(Date.now())
    })
  })

  // ── createDownloadUrl ───────────────────────────────────────────────────────

  describe('createDownloadUrl()', () => {
    it('returns a public URL as the download link', async () => {
      const result = await LocalStorageAdapter.createDownloadUrl({ key: 'uploads/test.jpg' })
      expect(result.url).toBe('http://localhost:3000/uploads/uploads/test.jpg')
      expect(result.expiresAt).toBeInstanceOf(Date)
    })
  })

  // ── getPublicUrl ────────────────────────────────────────────────────────────

  describe('getPublicUrl()', () => {
    it('returns APP_URL + /uploads/ + key', () => {
      const url = LocalStorageAdapter.getPublicUrl('uploads/photo.jpg')
      expect(url).toBe('http://localhost:3000/uploads/uploads/photo.jpg')
    })

    it('falls back to localhost:3000 when APP_URL is unset', () => {
      delete process.env.APP_URL
      const url = LocalStorageAdapter.getPublicUrl('uploads/photo.jpg')
      expect(url).toContain('localhost:3000')
    })
  })

  // ── write + exists + delete ─────────────────────────────────────────────────

  describe('write()', () => {
    it('writes a buffer to disk and creates subdirectories', async () => {
      const key = 'uploads/sub/file.bin'
      const buffer = Buffer.from('hello world')

      await LocalStorageAdapter.write(key, buffer)

      const written = fs.readFileSync(path.join(tmpDir, key))
      expect(written.toString()).toBe('hello world')
    })

    it('rejects path traversal attempts', async () => {
      await expect(
        LocalStorageAdapter.write('../outside.txt', Buffer.from('x'))
      ).rejects.toThrow('path traversal')
    })
  })

  describe('exists()', () => {
    it('returns { exists: true, size } for an existing file', async () => {
      const key = 'uploads/exists.txt'
      await LocalStorageAdapter.write(key, Buffer.from('data'))

      const result = await LocalStorageAdapter.exists(key)
      expect(result.exists).toBe(true)
      expect(result.size).toBe(4)
    })

    it('returns { exists: false } for a missing file', async () => {
      const result = await LocalStorageAdapter.exists('uploads/ghost.txt')
      expect(result.exists).toBe(false)
    })

    it('returns { exists: false } for path traversal key', async () => {
      const result = await LocalStorageAdapter.exists('../outside.txt')
      expect(result.exists).toBe(false)
    })
  })

  describe('delete()', () => {
    it('removes an existing file', async () => {
      const key = 'uploads/todelete.txt'
      await LocalStorageAdapter.write(key, Buffer.from('bye'))

      await LocalStorageAdapter.delete(key)

      const result = await LocalStorageAdapter.exists(key)
      expect(result.exists).toBe(false)
    })

    it('is a no-op for a missing file (does not throw)', async () => {
      await expect(LocalStorageAdapter.delete('uploads/ghost.txt')).resolves.toBeUndefined()
    })

    it('rejects path traversal attempts', async () => {
      await expect(LocalStorageAdapter.delete('../escape.txt')).rejects.toThrow('path traversal')
    })
  })

  // ── health ──────────────────────────────────────────────────────────────────

  describe('health()', () => {
    it('reports the storage directory and whether it exists', () => {
      const h = LocalStorageAdapter.health()
      expect(h.provider).toBe('local')
      expect(h.configured).toBe(true)
      expect(h.directory).toBe(tmpDir)
      expect(h.exists).toBe(true)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// StorageAdapter (unified facade)
// ─────────────────────────────────────────────────────────────────────────────

describe('StorageAdapter (facade)', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.mock('../../../src/lib/@system/Logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }))
    jest.mock('@aws-sdk/client-s3', () => {
      const sendMock = jest.fn()
      return {
        S3Client: jest.fn(() => ({ send: sendMock })),
        PutObjectCommand: jest.fn((a) => a),
        GetObjectCommand: jest.fn((a) => a),
        DeleteObjectCommand: jest.fn((a) => a),
        HeadObjectCommand: jest.fn((a) => a),
        _sendMock: sendMock,
      }
    })
    jest.mock('@aws-sdk/s3-request-presigner', () => ({
      getSignedUrl: jest.fn().mockResolvedValue('https://presigned'),
    }))
    process.env.S3_BUCKET = 'my-bucket'
    process.env.AWS_ACCESS_KEY_ID = 'AK'
    process.env.AWS_SECRET_ACCESS_KEY = 'SK'
  })

  const ORIGINAL_NODE_ENV = process.env.NODE_ENV

  afterEach(() => {
    delete process.env.STORAGE_PROVIDER
    delete process.env.S3_BUCKET
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.ALLOW_EPHEMERAL_STORAGE
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  })

  it('defaults to s3 provider', () => {
    const Storage = require('../../../src/lib/@system/StorageAdapter')
    expect(Storage.provider).toBe('s3')
  })

  it('respects STORAGE_PROVIDER=local outside production', () => {
    process.env.STORAGE_PROVIDER = 'local'
    const Storage = require('../../../src/lib/@system/StorageAdapter')
    expect(Storage.provider).toBe('local')
  })

  it('throws for unknown STORAGE_PROVIDER', () => {
    process.env.STORAGE_PROVIDER = 'gcs'
    const Storage = require('../../../src/lib/@system/StorageAdapter')
    expect(() => Storage.provider).toThrow('Unknown STORAGE_PROVIDER')
  })

  describe('production guard (ephemeral container disk)', () => {
    it('refuses STORAGE_PROVIDER=local when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      process.env.STORAGE_PROVIDER = 'local'
      const Storage = require('../../../src/lib/@system/StorageAdapter')
      expect(() => Storage.provider).toThrow('refused in production')
      expect(() => Storage.assertProductionSafe()).toThrow('ALLOW_EPHEMERAL_STORAGE=1')
      // every operation goes through the same resolver — nothing can write to disk
      expect(() => Storage.getPublicUrl('uploads/x.png')).toThrow('refused in production')
    })

    it('allows local in production only with ALLOW_EPHEMERAL_STORAGE=1 (or true)', () => {
      process.env.NODE_ENV = 'production'
      process.env.STORAGE_PROVIDER = 'local'
      process.env.ALLOW_EPHEMERAL_STORAGE = '1'
      const Storage = require('../../../src/lib/@system/StorageAdapter')
      expect(Storage.assertProductionSafe()).toBe('local')

      process.env.ALLOW_EPHEMERAL_STORAGE = 'true'
      expect(Storage.provider).toBe('local')

      process.env.ALLOW_EPHEMERAL_STORAGE = 'yes'
      expect(() => Storage.provider).toThrow('refused in production')
    })

    it('durable providers pass the boot guard in production', () => {
      process.env.NODE_ENV = 'production'
      const Storage = require('../../../src/lib/@system/StorageAdapter')
      expect(Storage.assertProductionSafe()).toBe('s3')
      process.env.STORAGE_PROVIDER = 'r2'
      expect(Storage.assertProductionSafe()).toBe('r2')
    })

    it('is case-insensitive about the provider name', () => {
      process.env.NODE_ENV = 'production'
      process.env.STORAGE_PROVIDER = 'LOCAL'
      const Storage = require('../../../src/lib/@system/StorageAdapter')
      expect(() => Storage.assertProductionSafe()).toThrow('refused in production')
    })
  })

  it('healthAll() returns keys for s3, r2, and local', () => {
    const Storage = require('../../../src/lib/@system/StorageAdapter')
    const all = Storage.healthAll()
    expect(Object.keys(all).sort()).toEqual(['local', 'r2', 's3'])
  })
})
