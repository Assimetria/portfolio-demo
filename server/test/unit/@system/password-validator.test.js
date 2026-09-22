const { validatePassword } = require('../../../src/lib/@system/Helpers/password-validator')

describe('validatePassword', () => {
  it('rejects empty string', () => {
    const result = validatePassword('')
    expect(result.valid).toBe(false)
  })

  it('rejects non-string input', () => {
    const result = validatePassword(null)
    expect(result.valid).toBe(false)
  })

  it('rejects password shorter than 12 characters', () => {
    const result = validatePassword('Ab1!')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/12 characters/i)
  })

  it('rejects password with no uppercase letter', () => {
    const result = validatePassword('alllower1!xxx')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/uppercase/i)
  })

  it('rejects password with no number', () => {
    const result = validatePassword('NoNumber!xxxx')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/number/i)
  })

  it('rejects password with no special character', () => {
    const result = validatePassword('StrongPass1234')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/special/i)
  })

  it('accepts a strong password meeting all requirements', () => {
    const result = validatePassword('StrongP@ss1234')
    expect(result.valid).toBe(true)
  })

  it('accepts password with special characters', () => {
    const result = validatePassword('P@ssw0rd!xxxxx')
    expect(result.valid).toBe(true)
  })

  it('rejects password of exactly 11 characters', () => {
    const result = validatePassword('StrongP@ss1')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/12 characters/i)
  })

  it('accepts minimum valid password (12 chars, upper, number, special)', () => {
    const result = validatePassword('Passw0rd!xxx')
    expect(result.valid).toBe(true)
  })

  it('rejects a very short all-uppercase string', () => {
    expect(validatePassword('A1').valid).toBe(false)
  })

  it('message is a string when invalid', () => {
    const result = validatePassword('weak')
    expect(typeof result.message).toBe('string')
    expect(result.message.length).toBeGreaterThan(0)
  })
})
