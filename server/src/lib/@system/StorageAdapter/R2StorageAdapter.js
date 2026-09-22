// @system — Cloudflare R2 storage adapter implementation
// R2 is S3-compatible so we use the AWS SDK with a custom endpoint.
// Required env vars:
//   R2_ACCOUNT_ID        — Cloudflare account ID
//   R2_ACCESS_KEY_ID     — R2 access key
//   R2_SECRET_ACCESS_KEY — R2 secret key
//   R2_BUCKET            — Bucket name
//   R2_PUBLIC_URL        — Public URL prefix (e.g. https://pub-xxx.r2.dev)
'use strict'

const { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { v4: uuidv4 } = require('uuid')
const logger = require('../Logger')

let _client = null

function getClient() {
  if (_client) return _client
  const accountId = process.env.R2_ACCOUNT_ID
  if (!accountId) throw Object.assign(new Error('R2_ACCOUNT_ID is not configured'), { status: 500 })

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  return _client
}

const R2StorageAdapter = {
  provider: 'r2',

  /**
   * Generate a presigned PUT URL for direct browser-to-R2 upload.
   * @param {{ filename: string, contentType: string, folder?: string, expiresIn?: number }} opts
   * @returns {Promise<{ url: string, key: string, publicUrl: string, expiresAt: Date }>}
   */
  async createUploadUrl({ filename, contentType, folder = 'uploads', expiresIn = 300 }) {
    const bucket = process.env.R2_BUCKET
    if (!bucket) throw Object.assign(new Error('R2_BUCKET is not configured'), { status: 500 })

    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : ''
    const key = `${folder}/${uuidv4()}${ext ? '.' + ext : ''}`

    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })
    const url = await getSignedUrl(getClient(), command, { expiresIn })
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    logger.info({ key, contentType }, '[StorageAdapter:r2] presigned upload URL created')
    return { url, key, publicUrl: this.getPublicUrl(key), expiresAt }
  },

  /**
   * Get a presigned GET URL for private object download.
   * @param {{ key: string, expiresIn?: number }} opts
   * @returns {Promise<{ url: string, expiresAt: Date }>}
   */
  async createDownloadUrl({ key, expiresIn = 3600 }) {
    const bucket = process.env.R2_BUCKET
    if (!bucket) throw Object.assign(new Error('R2_BUCKET is not configured'), { status: 500 })

    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(getClient(), command, { expiresIn })
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) }
  },

  /**
   * Build the public URL for an R2 object.
   * @param {string} key
   * @returns {string}
   */
  getPublicUrl(key) {
    const publicUrl = process.env.R2_PUBLIC_URL
    if (publicUrl) return `${publicUrl.replace(/\/$/, '')}/${key}`
    const bucket = process.env.R2_BUCKET ?? ''
    const accountId = process.env.R2_ACCOUNT_ID ?? ''
    return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`
  },

  /**
   * Delete an object.
   * @param {string} key
   */
  async delete(key) {
    const bucket = process.env.R2_BUCKET
    if (!bucket) throw Object.assign(new Error('R2_BUCKET is not configured'), { status: 500 })
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    logger.info({ key }, '[StorageAdapter:r2] object deleted')
  },

  /**
   * Check if an object exists.
   * @param {string} key
   * @returns {Promise<{ exists: boolean, size?: number, contentType?: string }>}
   */
  async exists(key) {
    const bucket = process.env.R2_BUCKET
    if (!bucket) return { exists: false }
    try {
      const res = await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      return { exists: true, size: res.ContentLength, contentType: res.ContentType }
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return { exists: false }
      throw err
    }
  },

  /**
   * List all objects in storage, optionally filtered by prefix.
   * Returns an array of { key, size, lastModified } objects.
   * @param {string} [prefix] - Optional key prefix to filter results
   * @returns {Promise<Array<{ key: string, size: number, lastModified: Date }>>}
   */
  async list(prefix = '') {
    const bucket = process.env.R2_BUCKET
    if (!bucket) return []
    const objects = []
    let continuationToken
    do {
      const res = await getClient().send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
      }))
      for (const obj of (res.Contents ?? [])) {
        objects.push({ key: obj.Key, size: obj.Size, lastModified: obj.LastModified })
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (continuationToken)
    return objects
  },

  /**
   * Return health/config info for this adapter.
   */
  health() {
    const configured = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET)
    return {
      provider: 'r2',
      configured,
      bucket: process.env.R2_BUCKET ?? null,
      accountId: process.env.R2_ACCOUNT_ID ?? null,
      publicUrl: process.env.R2_PUBLIC_URL ?? null,
    }
  },
}

module.exports = R2StorageAdapter
