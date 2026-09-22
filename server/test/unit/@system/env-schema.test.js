/**
 * Unit tests for lib/@system/Env — the SCHEMA-driven boot validation, in particular `requiredIn`
 * (a variable dev/test may omit but production must provide) as used by CSRF_SECRET.
 *
 * The module validates on require() and calls process.exit(1) on errors, so each case loads it
 * fresh inside jest.isolateModules with a controlled process.env and a stubbed process.exit.
 */

const ENV_MODULE = '../../../src/lib/@system/Env'

function loadEnv(env) {
  const prevEnv = process.env
  process.env = { ...env }
  const exit = jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`process.exit(${code})`) })
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  let mod
  let thrown = null
  try {
    jest.isolateModules(() => { mod = require(ENV_MODULE) })
  } catch (e) {
    thrown = e
  } finally {
    process.env = prevEnv
  }
  const out = {
    mod,
    thrown,
    exited: exit.mock.calls.length > 0,
    errors: error.mock.calls.map((c) => c.join(' ')).join('\n'),
    warnings: warn.mock.calls.map((c) => c.join(' ')).join('\n'),
  }
  exit.mockRestore(); error.mockRestore(); warn.mockRestore()
  return out
}

const CSRF_SECRET = 'c'.repeat(64)

describe('Env SCHEMA — CSRF_SECRET is requiredIn production', () => {
  it('declares requiredIn: ["production"] (single source for the fail-fast rule)', () => {
    const { mod } = loadEnv({ NODE_ENV: 'test' })
    const spec = mod.SCHEMA.find((s) => s.key === 'CSRF_SECRET')
    expect(spec.requiredIn).toEqual(['production'])
    expect(spec.required).toBe(false)
  })

  it('production without CSRF_SECRET aborts startup with a clear error', () => {
    const r = loadEnv({ NODE_ENV: 'production' })
    expect(r.exited).toBe(true)
    expect(r.thrown.message).toBe('process.exit(1)')
    expect(r.errors).toMatch(/CSRF_SECRET — required when NODE_ENV=production/)
  })

  it('production with a CSRF_SECRET and the other production-required vars boots', () => {
    const r = loadEnv({ NODE_ENV: 'production', CSRF_SECRET, DATABASE_URL: 'postgres://u:p@db:5432/app', JWT_PRIVATE_KEY: 'x', JWT_PUBLIC_KEY: 'y' })
    expect(r.exited).toBe(false)
    expect(r.errors).toBe('')
  })

  it('production with a too-short CSRF_SECRET still fails (minLength 32)', () => {
    const r = loadEnv({ NODE_ENV: 'production', CSRF_SECRET: 'short' })
    expect(r.exited).toBe(true)
    expect(r.errors).toMatch(/CSRF_SECRET — must be at least 32 characters/)
  })

  it.each(['test', 'development'])('%s without CSRF_SECRET boots with a warning (auto-generated at startup)', (nodeEnv) => {
    const r = loadEnv({ NODE_ENV: nodeEnv })
    expect(r.exited).toBe(false)
    expect(r.warnings).toMatch(/CSRF_SECRET — not set\. A random secret will be generated/)
  })
})

describe('Env SCHEMA — generic requiredIn semantics', () => {
  it('a spec with required: true is required in every environment', () => {
    const { mod } = loadEnv({ NODE_ENV: 'test' })
    // Guard the contract the validator implements, independent of which keys use it today.
    const src = require('fs').readFileSync(require.resolve(ENV_MODULE), 'utf8')
    expect(src).toMatch(/spec\.required \|\|\s*\(Array\.isArray\(spec\.requiredIn\) && spec\.requiredIn\.includes\(env\)/)
    expect(Array.isArray(mod.SCHEMA)).toBe(true)
  })

})
