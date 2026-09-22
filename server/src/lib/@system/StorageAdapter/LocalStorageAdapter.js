// @system — Local filesystem storage adapter implementation
// For development / self-hosted deployments without cloud storage.
// Files are stored under LOCAL_STORAGE_DIR (default: ./uploads).
// Served statically via /uploads express.static middleware.
//
// Required env vars:
//   LOCAL_STORAGE_DIR   — Absolute path to store files (default: <cwd>/uploads)
//   APP_URL             — Base URL for building public URLs
'use strict'

const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const logger = require('../Logger')

// Allowed upload extensions whitelist — reject anything not in this set
const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp',
  'pdf', 'txt', 'md', 'csv',
  'mp4', 'mp3', 'wav', 'ogg', 'webm',
  'zip',
])

/**
 * Sanitize a folder name to prevent path traversal.
 * Strips null bytes, slashes, backslashes, and .. sequences.
 * Returns only the first safe alphanumeric segment.
 */
function sanitizeFolder(input) {
  if (typeof input !== 'string') return 'uploads'
  // Strip null bytes and backslashes
  let s = input.replace(/\0/g, '').replace(/\\/g, '')
  // Split on path separators and take only the first non-empty, safe segment
  const segments = s.split('/').map(seg => seg.replace(/\.\./g, '').replace(/[^a-z0-9_-]/gi, '').toLowerCase())
  const safe = segments.find(seg => seg.length > 0)
  return safe || 'uploads'
}

/**
 * Extract and validate a file extension from a filename.
 * Returns the extension (without leading dot) if allowlisted and alphanumeric <=10 chars.
 * Splits on null bytes and uses only the content before the first null byte,
 * preventing null-byte injection attacks like "file.txt\0.exe".
 */
function safeExtension(filename) {
  if (typeof filename !== 'string') return ''
  // Take only the part before the first null byte to prevent null-byte injection
  const clean = filename.split('\0')[0]
  const ext = path.extname(clean).toLowerCase().replace(/^\./, '')
  // Must be alphanumeric only and within length limit
  if (!ext || !/^[a-z0-9]{1,10}$/.test(ext)) return ''
  if (!ALLOWED_EXTENSIONS.has(ext)) return ''
  return ext
}

function getStorageDir() {
  return process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), 'uploads')
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const LocalStorageAdapter = {
  provider: 'local',

  /**
   * For local storage, returns a token-based upload endpoint URL.
   * The server must expose POST /api/storage/upload to accept the file.
   * @param {{ filename: string, contentType: string, folder?: string, expiresIn?: number }} opts
   * @returns {Promise<{ url: string, key: string, publicUrl: string, expiresAt: Date }>}
   */
  async createUploadUrl({ filename, contentType, folder = 'uploads', expiresIn = 300 }) {
    const safeFolder = sanitizeFolder(folder)
    const ext = safeExtension(filename)
    const key = `${safeFolder}/${uuidv4()}${ext ? '.' + ext : ''}`
    const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
    const uploadToken = Buffer.from(JSON.stringify({ key, contentType, exp: Date.now() + expiresIn * 1000 })).toString('base64url')

    logger.info({ key }, '[StorageAdapter:local] upload URL created')
    return {
      url: `${appUrl}/api/storage/local-upload?token=${uploadToken}`,
      key,
      publicUrl: this.getPublicUrl(key),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    }
  },

  /**
   * Get a download URL (direct link for local storage).
   * @param {{ key: string }} opts
   * @returns {Promise<{ url: string, expiresAt: Date }>}
   */
  async createDownloadUrl({ key }) {
    return {
      url: this.getPublicUrl(key),
      expiresAt: new Date(Date.now() + 86400 * 1000),
    }
  },

  /**
   * Build the public URL for a local file.
   * @param {string} key
   * @returns {string}
   */
  getPublicUrl(key) {
    const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
    return `${appUrl}/uploads/${key}`
  },

  /**
   * Delete a local file.
   * @param {string} key
   */
  async delete(key) {
    const storageDir = getStorageDir()
    const filePath = path.join(storageDir, key)
    // Prevent path traversal
    if (!filePath.startsWith(storageDir)) {
      throw Object.assign(new Error('Invalid key: path traversal detected'), { status: 400 })
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      logger.info({ key }, '[StorageAdapter:local] file deleted')
    }
  },

  /**
   * Check if a local file exists.
   * @param {string} key
   * @returns {Promise<{ exists: boolean, size?: number }>}
   */
  async exists(key) {
    const storageDir = getStorageDir()
    const filePath = path.join(storageDir, key)
    if (!filePath.startsWith(storageDir)) return { exists: false }
    try {
      const stat = fs.statSync(filePath)
      return { exists: true, size: stat.size }
    } catch {
      return { exists: false }
    }
  },

  /**
   * List all files in local storage, optionally filtered by prefix.
   * Returns an array of { key, size, lastModified } objects.
   * @param {string} [prefix] - Optional path prefix to filter results
   * @returns {Promise<Array<{ key: string, size: number, lastModified: Date }>>}
   */
  async list(prefix = '') {
    const storageDir = getStorageDir()
    const targetDir = prefix ? path.join(storageDir, prefix) : storageDir
    if (!fs.existsSync(targetDir)) return []
    const objects = []
    function walk(dir, relBase) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        const relKey = relBase ? `${relBase}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          walk(fullPath, relKey)
        } else {
          const stat = fs.statSync(fullPath)
          objects.push({ key: relKey, size: stat.size, lastModified: stat.mtime })
        }
      }
    }
    walk(targetDir, prefix)
    return objects
  },

  /**
   * Write a file directly (used internally by the local upload endpoint).
   * @param {string} key
   * @param {Buffer} buffer
   */
  async write(key, buffer) {
    const storageDir = getStorageDir()
    const filePath = path.join(storageDir, key)
    if (!filePath.startsWith(storageDir)) {
      throw Object.assign(new Error('Invalid key: path traversal detected'), { status: 400 })
    }
    ensureDir(path.dirname(filePath))
    fs.writeFileSync(filePath, buffer)
    logger.info({ key, size: buffer.length }, '[StorageAdapter:local] file written')
  },

  /**
   * Return health/config info for this adapter.
   */
  health() {
    const dir = getStorageDir()
    return {
      provider: 'local',
      configured: true,
      directory: dir,
      exists: fs.existsSync(dir),
    }
  },
}

module.exports = LocalStorageAdapter
