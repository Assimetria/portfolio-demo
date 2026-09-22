const bcrypt = require('bcryptjs')

describe('bcrypt password hashing', () => {
  const SALT_ROUNDS = 12

  it('hashes a password and the hash differs from the plain text', async () => {
    const plain = 'secret123'
    const hash = await bcrypt.hash(plain, SALT_ROUNDS)
    expect(hash).not.toBe(plain)
    expect(hash.startsWith('$2')).toBe(true) // bcrypt hash prefix
  })

  it('compare returns true for correct password', async () => {
    const plain = 'correcthorsebatterystaple'
    const hash = await bcrypt.hash(plain, SALT_ROUNDS)
    const result = await bcrypt.compare(plain, hash)
    expect(result).toBe(true)
  })

  it('compare returns false for wrong password', async () => {
    const plain = 'correcthorsebatterystaple'
    const hash = await bcrypt.hash(plain, SALT_ROUNDS)
    const result = await bcrypt.compare('wrongpassword', hash)
    expect(result).toBe(false)
  })

  it('each hash is unique (different salts)', async () => {
    const plain = 'samepassword'
    const hash1 = await bcrypt.hash(plain, SALT_ROUNDS)
    const hash2 = await bcrypt.hash(plain, SALT_ROUNDS)
    expect(hash1).not.toBe(hash2)
    // but both verify correctly
    await expect(bcrypt.compare(plain, hash1)).resolves.toBe(true)
    await expect(bcrypt.compare(plain, hash2)).resolves.toBe(true)
  })
})
