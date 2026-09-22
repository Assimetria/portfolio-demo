const crypto = require('crypto')
const {
  generateInviteToken,
  hashToken,
} = require('../../../src/lib/@system/Helpers/tokens')

describe('token helpers', () => {
  describe('generateInviteToken', () => {
    it('returns a 64-character hex string', () => {
      const token = generateInviteToken()
      expect(token).toMatch(/^[0-9a-f]{64}$/)
    })

    it('produces unique tokens', () => {
      const tokens = new Set()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInviteToken())
      }
      expect(tokens.size).toBe(100)
    })
  })

  describe('hashToken', () => {
    it('produces a 64-character SHA-256 hex digest', () => {
      const hash = hashToken('some-token')
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('is deterministic for the same input', () => {
      expect(hashToken('abc')).toBe(hashToken('abc'))
    })

    it('produces different hashes for different inputs', () => {
      expect(hashToken('abc')).not.toBe(hashToken('abd'))
    })

    it('matches direct crypto SHA-256 computation', () => {
      const raw = 'raw-token-value'
      const expected = crypto.createHash('sha256').update(raw).digest('hex')
      expect(hashToken(raw)).toBe(expected)
    })
  })
})
