const crypto = require('crypto')

// Generate a fresh RS256 key pair for each test run
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

// Store as escaped env vars (matching the parsePemKey format in jwt.js)
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n')
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n')

const { signToken, verifyToken, signTokenAsync, verifyTokenAsync } = require('../../../src/lib/@system/Helpers/jwt')

describe('JWT helpers (RS256)', () => {
  const payload = { userId: 42 }

  describe('signToken / verifyToken (sync)', () => {
    it('signs and verifies a token synchronously', () => {
      const token = signToken(payload)
      expect(typeof token).toBe('string')
      const decoded = verifyToken(token)
      expect(decoded.userId).toBe(42)
    })

    it('throws on an invalid token', () => {
      expect(() => verifyToken('not.a.token')).toThrow()
    })
  })

  describe('signTokenAsync / verifyTokenAsync (async)', () => {
    it('signs a token asynchronously', async () => {
      const token = await signTokenAsync(payload)
      expect(typeof token).toBe('string')
    })

    it('verifies a token asynchronously', async () => {
      const token = await signTokenAsync(payload)
      const decoded = await verifyTokenAsync(token)
      expect(decoded.userId).toBe(42)
    })

    it('async sign and sync verify produce compatible tokens', async () => {
      const token = await signTokenAsync(payload)
      const decoded = verifyToken(token)
      expect(decoded.userId).toBe(42)
    })

    it('sync sign and async verify produce compatible tokens', async () => {
      const token = signToken(payload)
      const decoded = await verifyTokenAsync(token)
      expect(decoded.userId).toBe(42)
    })

    it('rejects on an invalid token', async () => {
      await expect(verifyTokenAsync('not.a.token')).rejects.toThrow()
    })

    it('respects custom expiresIn option', async () => {
      const token = await signTokenAsync(payload, { expiresIn: '1s' })
      const decoded = await verifyTokenAsync(token)
      expect(decoded.exp - decoded.iat).toBe(1)
    })
  })
})
