// @system — Unified Storage Adapter
// Abstracts AWS S3, Cloudflare R2, and local filesystem behind a single interface.
// Switch providers by setting STORAGE_PROVIDER=s3|r2|local (default: s3).
//
// Production guard: `local` writes to the container filesystem, which App
// Runner discards on every deploy, scale event and restart — customer uploads
// would silently vanish. In NODE_ENV=production the adapter therefore refuses
// STORAGE_PROVIDER=local unless ALLOW_EPHEMERAL_STORAGE=1 is set explicitly
// (demo / smoke environments that knowingly accept the loss). index.js calls
// `assertProductionSafe()` at boot so the process exits with the reason
// instead of failing on the first upload.
//
// Usage:
//   const Storage = require('../StorageAdapter')
//   const { url, key } = await Storage.createUploadUrl({ filename, contentType })
//   await Storage.delete(key)

'use strict'

const S3StorageAdapter    = require('./S3StorageAdapter')
const R2StorageAdapter    = require('./R2StorageAdapter')
const LocalStorageAdapter = require('./LocalStorageAdapter')

const ADAPTERS = { s3: S3StorageAdapter, r2: R2StorageAdapter, local: LocalStorageAdapter }

/**
 * @typedef {Object} UploadUrlOptions
 * @property {string}  filename     Original filename (used to derive extension)
 * @property {string}  contentType  MIME type
 * @property {string}  [folder]     Storage path prefix (default: 'uploads')
 * @property {number}  [expiresIn]  Seconds until URL expires (default: 300)
 *
 * @typedef {Object} UploadUrlResult
 * @property {string} url        Presigned upload URL (PUT to this URL)
 * @property {string} key        Storage key for later retrieval/deletion
 * @property {string} publicUrl  Public read URL for the object
 * @property {Date}   expiresAt  When the upload URL expires
 *
 * @typedef {Object} DownloadUrlResult
 * @property {string} url       Presigned download URL
 * @property {Date}   expiresAt When the download URL expires
 */

const EPHEMERAL_LOCAL_MESSAGE =
  '[StorageAdapter] STORAGE_PROVIDER=local is refused in production: the container ' +
  'filesystem is ephemeral on App Runner, so every deploy or restart would delete ' +
  'customer uploads. Set STORAGE_PROVIDER=s3 (S3_BUCKET + AWS credentials) or r2 ' +
  '(R2_* vars). Set ALLOW_EPHEMERAL_STORAGE=1 only for a throwaway demo that accepts the loss.'

function isTruthyFlag(value) {
  return value === '1' || value === 'true'
}

/** @returns {'s3'|'r2'|'local'} */
function resolveProvider() {
  const p = (process.env.STORAGE_PROVIDER ?? 's3').toLowerCase()
  if (!ADAPTERS[p]) {
    throw new Error(`[StorageAdapter] Unknown STORAGE_PROVIDER="${p}". Use "s3", "r2", or "local".`)
  }
  if (
    p === 'local' &&
    process.env.NODE_ENV === 'production' &&
    !isTruthyFlag(process.env.ALLOW_EPHEMERAL_STORAGE)
  ) {
    throw new Error(EPHEMERAL_LOCAL_MESSAGE)
  }
  return p
}

function getAdapter() {
  return ADAPTERS[resolveProvider()]
}

const StorageAdapter = {
  /** Which provider is currently active */
  get provider() { return resolveProvider() },

  /**
   * Boot-time guard — throws with an actionable message when the configured
   * provider is unknown or unsafe for this NODE_ENV (see header). Called from
   * index.js right after env validation so misconfiguration aborts startup.
   * @returns {'s3'|'r2'|'local'} the validated provider
   */
  assertProductionSafe() {
    return resolveProvider()
  },

  /**
   * Generate a presigned upload URL for direct browser-to-storage upload.
   * @param {UploadUrlOptions} opts
   * @returns {Promise<UploadUrlResult>}
   */
  createUploadUrl(opts) {
    return getAdapter().createUploadUrl(opts)
  },

  /**
   * Generate a presigned download URL for private object access.
   * For local storage, returns a direct public link.
   * @param {{ key: string, expiresIn?: number }} opts
   * @returns {Promise<DownloadUrlResult>}
   */
  createDownloadUrl(opts) {
    return getAdapter().createDownloadUrl(opts)
  },

  /**
   * Build the public URL for a stored object.
   * @param {string} key
   * @returns {string}
   */
  getPublicUrl(key) {
    return getAdapter().getPublicUrl(key)
  },

  /**
   * Delete a stored object.
   * @param {string} key
   * @returns {Promise<void>}
   */
  delete(key) {
    return getAdapter().delete(key)
  },

  /**
   * Check if an object exists and get metadata.
   * @param {string} key
   * @returns {Promise<{ exists: boolean, size?: number, contentType?: string }>}
   */
  exists(key) {
    return getAdapter().exists(key)
  },

  /**
   * List all objects in storage, optionally filtered by prefix.
   * Returns an array of { key, size, lastModified } objects.
   * @param {string} [prefix] - Optional key prefix to filter results
   * @returns {Promise<Array<{ key: string, size: number, lastModified: Date }>>}
   */
  list(prefix) {
    return getAdapter().list(prefix)
  },

  /**
   * Return health and configuration info for the active adapter.
   * Safe to expose in admin APIs.
   */
  health() {
    return getAdapter().health()
  },

  /**
   * Return health info for ALL configured adapters.
   * Useful for admin integration status pages.
   */
  healthAll() {
    return Object.fromEntries(
      Object.entries(ADAPTERS).map(([name, adapter]) => [name, adapter.health()])
    )
  },
}

module.exports = StorageAdapter
