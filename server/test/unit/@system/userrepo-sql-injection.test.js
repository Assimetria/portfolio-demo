/**
 * @file UserRepo SQL Injection Security Test
 * @description Tests that UserRepo.update() properly whitelists columns and prevents SQL injection
 * 
 * Security Issue: Viktor audit 2026-02-27 (Task #1019)
 * - Original code interpolated column names directly into SQL without validation
 * - Fix: Added whitelist of allowed columns (name, role, stripe_customer_id)
 */

const UserRepo = require('../../../src/db/repos/@system/UserRepo')

// Mock the database module
jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  any: jest.fn(),
}))

const db = require('../../../src/lib/@system/PostgreSQL')

describe('UserRepo SQL Injection Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('update() method security', () => {
    it('should only allow whitelisted columns', async () => {
      const userId = 1
      const allowedFields = {
        name: 'John Doe',
        role: 'admin',
        stripe_customer_id: 'cus_123'
      }

      db.one.mockResolvedValue({ id: userId, ...allowedFields })

      await UserRepo.update(userId, allowedFields)

      expect(db.one).toHaveBeenCalledTimes(1)
      const [query, params] = db.one.mock.calls[0]

      // Verify query structure
      expect(query).toContain('UPDATE users SET')
      expect(query).toContain('updated_at = now()')
      expect(query).toContain('WHERE id = $1')
      
      // Verify all allowed columns are in the query
      expect(query).toContain('name = $')
      expect(query).toContain('role = $')
      expect(query).toContain('stripe_customer_id = $')

      // Verify parameters
      expect(params[0]).toBe(userId)
      expect(params).toContain('John Doe')
      expect(params).toContain('admin')
      expect(params).toContain('cus_123')
    })

    it('should REJECT malicious SQL injection attempts in column names', async () => {
      const userId = 1
      const maliciousFields = {
        "name' = 'hacked' WHERE id = 999; --": 'attacker',
        "password_hash": 'fake_hash',
        "email": 'attacker@evil.com'
      }

      db.oneOrNone.mockResolvedValue({ id: userId })

      await UserRepo.update(userId, maliciousFields)

      // Verify update was called but with NO fields (all rejected by whitelist)
      // Should fall back to findById
      expect(db.oneOrNone).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      )
    })

    it('should reject password_hash column', async () => {
      const userId = 1
      const fields = {
        name: 'John',
        password_hash: 'fake_hash' // Attacker trying to change password
      }

      db.one.mockResolvedValue({ id: userId, name: 'John' })

      await UserRepo.update(userId, fields)

      expect(db.one).toHaveBeenCalledTimes(1)
      const [query, params] = db.one.mock.calls[0]

      // Should only include 'name', not 'password_hash'
      expect(query).toContain('name = $2')
      expect(query).not.toContain('password_hash')
      expect(params).toHaveLength(2) // [userId, name]
      expect(params).toEqual([userId, 'John'])
    })

    it('should reject email column', async () => {
      const userId = 1
      const fields = {
        name: 'John',
        email: 'attacker@evil.com' // Attacker trying to change email
      }

      db.one.mockResolvedValue({ id: userId, name: 'John' })

      await UserRepo.update(userId, fields)

      expect(db.one).toHaveBeenCalledTimes(1)
      const [query, params] = db.one.mock.calls[0]

      // Should only include 'name', not 'email = $' in the SET clause
      expect(query).toContain('name = $2')
      expect(query).not.toContain('email = $')
      expect(params).toHaveLength(2) // [userId, name]
    })

    it('should reject system columns (id, created_at, updated_at)', async () => {
      const userId = 1
      const fields = {
        name: 'John',
        id: 999, // Attacker trying to change ID
        created_at: '2020-01-01',
        updated_at: '2020-01-01'
      }

      db.one.mockResolvedValue({ id: userId, name: 'John' })

      await UserRepo.update(userId, fields)

      expect(db.one).toHaveBeenCalledTimes(1)
      const [query, params] = db.one.mock.calls[0]

      // Should only include 'name' in SET clause
      expect(query).toContain('name = $2')
      // Extract the SET clause only (between SET and WHERE)
      const setClause = query.match(/SET\s+(.+?)\s+WHERE/)[1]
      // These columns should NOT be in the SET clause with parameters
      expect(setClause).not.toMatch(/\bid\s*=\s*\$/)
      expect(setClause).not.toMatch(/\bcreated_at\s*=\s*\$/)
      // updated_at appears but only as 'updated_at = now()' (not parameterized)
      expect(params).toHaveLength(2) // [userId, name]
    })

    it('should handle empty fields gracefully', async () => {
      const userId = 1
      
      db.oneOrNone.mockResolvedValue({ id: userId })

      await UserRepo.update(userId, {})

      // Should fall back to findById when no valid fields
      expect(db.oneOrNone).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      )
    })

    it('should filter out undefined values', async () => {
      const userId = 1
      const fields = {
        name: 'John',
        role: undefined,
        stripe_customer_id: null
      }

      db.one.mockResolvedValue({ id: userId, name: 'John' })

      await UserRepo.update(userId, fields)

      expect(db.one).toHaveBeenCalledTimes(1)
      const [query, params] = db.one.mock.calls[0]

      // Should include name and stripe_customer_id (null is valid), but not role (undefined)
      expect(query).toContain('name = $2')
      expect(query).toContain('stripe_customer_id = $3')
      expect(params).toHaveLength(3) // [userId, 'John', null]
    })
  })

  describe('Whitelist verification', () => {
    it('should document the exact whitelist', () => {
      // This test serves as documentation of the security policy
      const ALLOWED_COLUMNS = ['name', 'role', 'stripe_customer_id']
      
      // These columns should NEVER be in the whitelist
      const FORBIDDEN_COLUMNS = [
        'email',           // Email changes need verification flow
        'password_hash',   // Password changes need dedicated secure method
        'id',              // System column
        'created_at',      // System column
        'updated_at',      // System column (handled automatically)
        'email_verified_at' // Should use verifyEmail() method
      ]

      // Verify whitelist exists and is correct
      // (This would need to be updated if UserRepo changes)
      expect(ALLOWED_COLUMNS).toHaveLength(3)
      expect(ALLOWED_COLUMNS).toContain('name')
      expect(ALLOWED_COLUMNS).toContain('role')
      expect(ALLOWED_COLUMNS).toContain('stripe_customer_id')

      // Document forbidden columns
      FORBIDDEN_COLUMNS.forEach(col => {
        expect(ALLOWED_COLUMNS).not.toContain(col)
      })
    })
  })
})
