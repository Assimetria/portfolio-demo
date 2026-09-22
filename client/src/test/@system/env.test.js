// @system — Tests for client-side environment validation (lib/@system/env.js)
import { validateEnv, env } from '@/app/lib/@system/env'

describe('env()', () => {
  it('returns value when env var is set', () => {
    globalThis.__IMPORT_META_ENV__.VITE_APP_URL = 'https://example.com'
    expect(env('VITE_APP_URL')).toBe('https://example.com')
  })

  it('returns fallback when env var is not set', () => {
    delete globalThis.__IMPORT_META_ENV__.VITE_MISSING_VAR
    expect(env('VITE_MISSING_VAR', 'default')).toBe('default')
  })

  it('returns fallback when env var is empty string', () => {
    globalThis.__IMPORT_META_ENV__.VITE_EMPTY = ''
    expect(env('VITE_EMPTY', 'fallback')).toBe('fallback')
  })

  it('throws when env var is missing and no fallback given', () => {
    delete globalThis.__IMPORT_META_ENV__.VITE_REQUIRED
    expect(() => env('VITE_REQUIRED')).toThrow('[Env] import.meta.env.VITE_REQUIRED is not set')
  })

  it('prefers actual value over fallback', () => {
    globalThis.__IMPORT_META_ENV__.VITE_APP_VERSION = '1.2.3'
    expect(env('VITE_APP_VERSION', '0.0.0')).toBe('1.2.3')
  })
})

describe('validateEnv()', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...globalThis.__IMPORT_META_ENV__ }
  })

  afterEach(() => {
    globalThis.__IMPORT_META_ENV__ = originalEnv
  })

  it('returns silently when no required vars are missing', () => {
    // All vars in SCHEMA are optional (required: false)
    expect(() => validateEnv()).not.toThrow()
  })

  it('does not throw in dev mode even if required vars are missing', () => {
    globalThis.__IMPORT_META_ENV__.PROD = false
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
    // All SCHEMA entries are required: false, so no warnings expected
    validateEnv()
    consoleSpy.mockRestore()
  })
})
