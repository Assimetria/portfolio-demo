// Unit tests for lib/@system/Env — production fail-fast rules.
//
// The module validates on require() and calls process.exit(1) on errors, so
// every test loads it in an isolated module registry with process.exit stubbed
// and a controlled process.env, then calls the exported validate() directly.

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const ENV_MODULE = '../../../src/lib/@system/Env'

const PEM_PRIVATE = '-----BEGIN PRIVATE KEY-----\\nMIIEvQ\\n-----END PRIVATE KEY-----'
const PEM_PUBLIC = '-----BEGIN PUBLIC KEY-----\\nMIIBIj\\n-----END PUBLIC KEY-----'

const ORIGINAL_ENV = { ...process.env }

// Keys the tests manipulate — cleared before every test so the host shell
// (or a developer's server/.env) cannot leak into the assertions.
const MANAGED_KEYS = [
  'NODE_ENV', 'PORT', 'ALLOW_DEGRADED_BOOT', 'DATABASE_URL',
  'JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY_FILE', 'JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY_FILE',
  'CSRF_SECRET',
]

function loadEnv(overrides = {}) {
  for (const k of MANAGED_KEYS) delete process.env[k]
  Object.assign(process.env, overrides)

  let mod
  jest.isolateModules(() => {
    mod = require(ENV_MODULE)
  })
  return mod
}

describe('lib/@system/Env — production fail-fast', () => {
  let exitSpy
  let warnSpy
  let errorSpy

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit called') })
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    exitSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    for (const k of Object.keys(process.env)) {
      if (!(k in ORIGINAL_ENV)) delete process.env[k]
    }
    Object.assign(process.env, ORIGINAL_ENV)
  })

  describe('PORT default', () => {
    it('defaults to 3000 — the Dockerfile / App Runner contract', () => {
      loadEnv({ NODE_ENV: 'test' })
      expect(process.env.PORT).toBe('3000')
    })

    it('keeps an explicit PORT', () => {
      loadEnv({ NODE_ENV: 'test', PORT: '3001' })
      expect(process.env.PORT).toBe('3001')
    })

    it('declares 3000 as the schema default (single source of truth for index.js)', () => {
      const { SCHEMA } = loadEnv({ NODE_ENV: 'test' })
      const port = SCHEMA.find((s) => s.key === 'PORT')
      expect(port.default).toBe('3000')
      expect(port.type).toBe('number')
    })
  })

  describe('NODE_ENV=production', () => {
    const PROD_OK = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db.internal:5432/app',
      CSRF_SECRET: 'c'.repeat(48), // requiredIn production (see schema.js)
      JWT_PRIVATE_KEY: PEM_PRIVATE,
      JWT_PUBLIC_KEY: PEM_PUBLIC,
    }

    it('passes with DATABASE_URL and both JWT keys set', () => {
      const { validate } = loadEnv(PROD_OK)
      const { errors } = validate()
      expect(errors).toEqual([])
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('refuses to start without DATABASE_URL', () => {
      const env = { ...PROD_OK }
      delete env.DATABASE_URL
      // require() itself must abort: bootstrap() → process.exit(1)
      expect(() => loadEnv(env)).toThrow('process.exit called')
      expect(exitSpy).toHaveBeenCalledWith(1)
      const printed = errorSpy.mock.calls.flat().join('\n')
      expect(printed).toContain('DATABASE_URL')
      expect(printed).toContain('required when NODE_ENV=production')
      expect(printed).toContain('ALLOW_DEGRADED_BOOT=1')
    })

    it('refuses to start without a JWT private key source', () => {
      const env = { ...PROD_OK }
      delete env.JWT_PRIVATE_KEY
      expect(() => loadEnv(env)).toThrow('process.exit called')
      const printed = errorSpy.mock.calls.flat().join('\n')
      expect(printed).toContain('JWT_PRIVATE_KEY_FILE (or JWT_PRIVATE_KEY)')
    })

    it('refuses to start without a JWT public key source', () => {
      const env = { ...PROD_OK }
      delete env.JWT_PUBLIC_KEY
      expect(() => loadEnv(env)).toThrow('process.exit called')
      const printed = errorSpy.mock.calls.flat().join('\n')
      expect(printed).toContain('JWT_PUBLIC_KEY_FILE (or JWT_PUBLIC_KEY)')
    })

    it('accepts *_FILE variants as the key source', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'))
      const keyFile = path.join(dir, 'jwt-private.pem')
      fs.writeFileSync(keyFile, PEM_PRIVATE.replace(/\\n/g, '\n'))
      try {
        const env = { ...PROD_OK, JWT_PRIVATE_KEY_FILE: keyFile, ALLOW_DEGRADED_BOOT: '0' }
        delete env.JWT_PRIVATE_KEY
        const { validate } = loadEnv(env)
        expect(validate().errors).toEqual([])
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })

    it('a *_FILE that cannot be read is fatal (never silently degraded)', () => {
      const env = { ...PROD_OK, JWT_PRIVATE_KEY_FILE: '/nonexistent/jwt-private.pem' }
      delete env.JWT_PRIVATE_KEY
      expect(() => loadEnv(env)).toThrow('process.exit called')
      const printed = errorSpy.mock.calls.flat().join('\n')
      expect(printed).toContain('cannot read file')
      // the requirement itself was satisfied — no "not set" complaint
      expect(printed).not.toContain('JWT_PRIVATE_KEY_FILE (or JWT_PRIVATE_KEY) — not set')
    })

    it('ALLOW_DEGRADED_BOOT=1 downgrades the missing DATABASE_URL and JWT keys to warnings', () => {
      const { validate } = loadEnv({ NODE_ENV: 'production', ALLOW_DEGRADED_BOOT: '1' })
      const { errors, warnings } = validate()
      expect(errors).toEqual([])
      const text = warnings.join('\n')
      expect(text).toContain('ALLOW_DEGRADED_BOOT is set')
      expect(text).toContain('JWT_PRIVATE_KEY_FILE (or JWT_PRIVATE_KEY)')
      expect(text).toContain('JWT_PUBLIC_KEY_FILE (or JWT_PUBLIC_KEY)')
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('ALLOW_DEGRADED_BOOT=true is accepted as well; other values are rejected', () => {
      const { validate } = loadEnv({ NODE_ENV: 'production', ALLOW_DEGRADED_BOOT: 'true' })
      expect(validate().errors).toEqual([])

      expect(() => loadEnv({ ...PROD_OK, ALLOW_DEGRADED_BOOT: 'yes' })).toThrow('process.exit called')
      expect(errorSpy.mock.calls.flat().join('\n')).toContain('ALLOW_DEGRADED_BOOT — must be one of')
    })
  })

  describe('NODE_ENV=development / test', () => {
    it.each(['development', 'test'])('%s starts degraded without DATABASE_URL and JWT keys (warnings only)', (nodeEnv) => {
      const { validate } = loadEnv({ NODE_ENV: nodeEnv })
      const { errors, warnings } = validate()
      expect(errors).toEqual([])
      expect(warnings.join('\n')).toContain('JWT_PRIVATE_KEY_FILE (or JWT_PRIVATE_KEY)')
      expect(exitSpy).not.toHaveBeenCalled()
    })
  })

  describe('schema', () => {
    it('marks DATABASE_URL as requiredIn production and never unconditionally required', () => {
      const { SCHEMA } = loadEnv({ NODE_ENV: 'test' })
      const spec = SCHEMA.find((s) => s.key === 'DATABASE_URL')
      expect(spec.required).toBe(false)
      expect(spec.requiredIn).toEqual(['production'])
    })
  })
})
