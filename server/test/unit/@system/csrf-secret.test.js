/**
 * Unit tests — Middleware/csrf.js must refuse to boot in production without CSRF_SECRET
 * (defence in depth behind the Env SCHEMA `requiredIn: ['production']` rule) and keep
 * auto-generating a per-process secret in test/development.
 */

const CSRF_MODULE = '../../../src/lib/@system/Middleware/csrf'

function loadCsrf(env) {
  const prevEnv = process.env
  process.env = { ...env }
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  let mod
  let thrown = null
  let generated
  try {
    jest.isolateModules(() => { mod = require(CSRF_MODULE) })
    generated = process.env.CSRF_SECRET
  } catch (e) {
    thrown = e
  } finally {
    process.env = prevEnv
    warn.mockRestore()
  }
  return { mod, thrown, generated }
}

describe('CSRF_SECRET at module load', () => {
  it('production without CSRF_SECRET throws instead of generating a per-process secret', () => {
    const r = loadCsrf({ NODE_ENV: 'production' })
    expect(r.mod).toBeUndefined()
    expect(r.thrown).toBeInstanceOf(Error)
    expect(r.thrown.message).toMatch(/CSRF_SECRET/)
    expect(r.thrown.message).toMatch(/production/)
  })

  it('production with CSRF_SECRET loads and keeps the configured value', () => {
    const r = loadCsrf({ NODE_ENV: 'production', CSRF_SECRET: 'p'.repeat(64) })
    expect(r.thrown).toBeNull()
    expect(typeof r.mod.csrfProtection).toBe('function')
    expect(r.generated).toBe('p'.repeat(64))
  })

  it.each(['test', 'development'])('%s without CSRF_SECRET auto-generates a 32-byte hex secret', (nodeEnv) => {
    const r = loadCsrf({ NODE_ENV: nodeEnv })
    expect(r.thrown).toBeNull()
    expect(r.generated).toMatch(/^[0-9a-f]{64}$/)
  })
})
