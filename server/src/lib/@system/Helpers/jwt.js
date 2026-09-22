const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const { promisify } = require('util')

const ALGORITHM = 'RS256'

// Keys can be provided in two ways:
//
//   1. File path (preferred for security):
//      JWT_PRIVATE_KEY_FILE=/path/to/jwt_private.pem
//      The file is read at startup; only the file path is stored in .env,
//      never the raw key material.
//
//   2. Inline PEM via env var (for secrets managers like Railway / Doppler):
//      JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----"
//      Use this when your deployment platform injects secrets at runtime.
//
// In both cases the public key must also be provided (JWT_PUBLIC_KEY_FILE or JWT_PUBLIC_KEY).

function readPemFile(filePath) {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath)
  return fs.readFileSync(resolved, 'utf8').trim()
}

function parsePemKey(raw) {
  if (!raw) return null
  return raw.replace(/\\n/g, '\n')
}

function loadKey(fileEnvVar, inlineEnvVar) {
  const filePath = process.env[fileEnvVar]
  if (filePath) {
    try {
      return readPemFile(filePath)
    } catch (err) {
      throw new Error(`[jwt] Failed to read ${fileEnvVar}="${filePath}": ${err.message}`)
    }
  }
  return parsePemKey(process.env[inlineEnvVar])
}

const PRIVATE_KEY = loadKey('JWT_PRIVATE_KEY_FILE', 'JWT_PRIVATE_KEY')
const PUBLIC_KEY = loadKey('JWT_PUBLIC_KEY_FILE', 'JWT_PUBLIC_KEY')

if (!PRIVATE_KEY || !PUBLIC_KEY) {
  const msg =
    '[jwt] JWT keys not configured — token operations will fail.\n' +
    '  Option A (file-based, recommended): set JWT_PRIVATE_KEY_FILE and JWT_PUBLIC_KEY_FILE to PEM file paths.\n' +
    '  Option B (inline, for Railway/Doppler): set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY as PEM strings.\n' +
    '  Run: npm run generate-keys  to generate and configure keys automatically.'
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[jwt] FATAL: JWT keys must be configured in production. ' + msg)
  }
  console.warn(msg)
}

// Promisified versions of the jsonwebtoken callback API
const _signAsync = promisify(jwt.sign)
const _verifyAsync = promisify(jwt.verify)

// Access tokens are short-lived; refresh tokens are opaque (not JWT).
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m'

function signToken(payload, options = {}) {
  return jwt.sign(payload, PRIVATE_KEY, { algorithm: ALGORITHM, expiresIn: ACCESS_TOKEN_TTL, ...options })
}

function verifyToken(token) {
  return jwt.verify(token, PUBLIC_KEY, { algorithms: [ALGORITHM] })
}

async function signTokenAsync(payload, options = {}) {
  return _signAsync(payload, PRIVATE_KEY, { algorithm: ALGORITHM, expiresIn: ACCESS_TOKEN_TTL, ...options })
}

async function verifyTokenAsync(token) {
  return _verifyAsync(token, PUBLIC_KEY, { algorithms: [ALGORITHM] })
}

// Convenience aliases — semantically clearer when used alongside refresh tokens
const signAccessToken = signToken
const signAccessTokenAsync = signTokenAsync
const verifyAccessToken = verifyToken
const verifyAccessTokenAsync = verifyTokenAsync

module.exports = {
  signToken,
  verifyToken,
  signTokenAsync,
  verifyTokenAsync,
  signAccessToken,
  signAccessTokenAsync,
  verifyAccessToken,
  verifyAccessTokenAsync,
  ACCESS_TOKEN_TTL,
}
