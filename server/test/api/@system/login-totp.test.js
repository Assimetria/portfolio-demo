/**
 * API tests — the TOTP second factor must gate EVERY password login route.
 *
 * Upstream bug: POST /api/auth/login issued tokens without checking user.totp_enabled while
 * POST /api/sessions enforced it. Both routes now complete through Helpers/loginFlow.completeLogin,
 * so this suite runs the same scenarios against each of them.
 */

const request = require('supertest')
const OTPAuth = require('otpauth')

jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = { one: jest.fn(), oneOrNone: jest.fn(), none: jest.fn(), any: jest.fn(), tx: jest.fn(async (fn) => fn(mockDb)) }
  return mockDb
})
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: { get: jest.fn(async () => null), set: jest.fn(), del: jest.fn(), exists: jest.fn(async () => 0), incr: jest.fn(async () => 1), expire: jest.fn(), ttl: jest.fn(async () => -1) },
  isReady: () => false,
}))
jest.mock('../../../src/lib/@system/Email', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }))
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('$2a$12$hashedpassword'), compare: jest.fn() }))

const crypto = require('crypto')
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

const app = require('../../../src/app')
const db = require('../../../src/lib/@system/PostgreSQL')
const bcrypt = require('bcryptjs')

const TOTP_SECRET = new OTPAuth.Secret({ size: 20 }).base32
const currentCode = () => new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(TOTP_SECRET) }).generate()

const BASE_USER = { id: 42, email: 'user@example.com', name: 'Alice', role: 'user', password_hash: '$2a$12$hashedpassword' }
const TOTP_USER = { ...BASE_USER, totp_enabled: true, totp_secret: TOTP_SECRET }
const REFRESH_RECORD = { id: 1, user_id: 42, token_hash: 'abc123', expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }
const CREDENTIALS = { email: 'user@example.com', password: 'SecurePass123' }

const cookieString = (res) => (res.headers['set-cookie'] || []).join('; ')

beforeEach(() => {
  jest.clearAllMocks()
  bcrypt.compare.mockResolvedValue(true)
  db.one.mockResolvedValue(REFRESH_RECORD)
  db.none.mockResolvedValue()
})

describe.each([
  ['POST /api/auth/login', '/api/auth/login'],
  ['POST /api/sessions', '/api/sessions'],
])('%s — TOTP second factor', (_label, path) => {
  it('valid password + 2FA enabled + no code → 200 { totp_required: true } and NO auth cookies', async () => {
    db.oneOrNone.mockResolvedValue(TOTP_USER)
    const res = await request(app).post(path).send(CREDENTIALS)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ totp_required: true })
    expect(cookieString(res)).not.toMatch(/access_token|refresh_token/)
    // No refresh token / session row is created before the second factor passes.
    expect(db.one).not.toHaveBeenCalled()
  })

  it('valid password + wrong code → 401, no cookies', async () => {
    db.oneOrNone.mockResolvedValue(TOTP_USER)
    const res = await request(app).post(path).send({ ...CREDENTIALS, totpCode: '000000' })
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/authenticator code/i)
    expect(cookieString(res)).not.toMatch(/access_token|refresh_token/)
  })

  it('valid password + current code → 200 { user } with access + refresh cookies', async () => {
    db.oneOrNone.mockResolvedValue(TOTP_USER)
    const res = await request(app).post(path).send({ ...CREDENTIALS, totpCode: currentCode() })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 42, email: 'user@example.com' })
    expect(res.body.user.totp_secret).toBeUndefined()
    expect(cookieString(res)).toMatch(/access_token=/)
    expect(cookieString(res)).toMatch(/refresh_token=/)
  })

  it('accepts the code with whitespace and as a number (authenticator apps display "123 456")', async () => {
    db.oneOrNone.mockResolvedValue(TOTP_USER)
    const code = currentCode()
    const spaced = await request(app).post(path).send({ ...CREDENTIALS, totpCode: `${code.slice(0, 3)} ${code.slice(3)}` })
    expect(spaced.status).toBe(200)
    if (!code.startsWith('0')) {
      const numeric = await request(app).post(path).send({ ...CREDENTIALS, totpCode: Number(code) })
      expect(numeric.status).toBe(200)
    }
  })

  it('user without 2FA → 200 with cookies (unchanged behaviour)', async () => {
    db.oneOrNone.mockResolvedValue(BASE_USER)
    const res = await request(app).post(path).send(CREDENTIALS)
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ id: 42 })
    expect(cookieString(res)).toMatch(/access_token=/)
  })

  it('wrong password is still rejected before the TOTP step (no totp_required leak)', async () => {
    db.oneOrNone.mockResolvedValue(TOTP_USER)
    bcrypt.compare.mockResolvedValue(false)
    const res = await request(app).post(path).send(CREDENTIALS)
    expect(res.status).toBe(401)
    expect(res.body.totp_required).toBeUndefined()
  })
})

describe('structural guard — no login route issues tokens outside completeLogin', () => {
  const fs = require('fs')
  const pathMod = require('path')
  it.each(['api/@system/auth/index.js', 'api/@system/sessions/index.js'])('%s login handler calls completeLogin', (file) => {
    const src = fs.readFileSync(pathMod.join(__dirname, '../../../src', file), 'utf8')
    expect(src).toMatch(/completeLogin\(req, res, user, \{ totpCode, rememberMe \}\)/)
  })
})
