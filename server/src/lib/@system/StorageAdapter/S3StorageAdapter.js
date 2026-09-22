// @system — AWS S3 storage adapter implementation
'use strict'

const { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { v4: uuidv4 } = require('uuid')
const logger = require('../Logger')

let _client = null

function getClient() {
  if (_client) return _client
  _client = new S3Client({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
      : {}),
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  })
  return _client
}

const S3StorageAdapter = {
  provider: 's3',

  /**
   * Generate a presigned PUT URL for direct browser-to-S3 upload.
   * @param {{ filename: string, contentType: string, folder?: string, expiresIn?: number }} opts
   * @returns {Promise<{ url: string, key: string, publicUrl: string, expiresAt: Date }>}
   */
  async createUploadUrl({ filename, contentType, folder = 'uploads', expiresIn = 300 }) {
    const bucket = process.env.S3_BUCKET
    if (!bucket) throw Object.assign(new Error('S3_BUCKET is not configured'), { status: 500 })

    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : ''
    const key = `${folder}/${uuidv4()}${ext ? '.' + ext : ''}`

    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType })
    const url = await getSignedUrl(getClient(), command, { expiresIn })
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    logger.info({ key, contentType }, '[StorageAdapter:s3] presigned upload URL created')
    return { url, key, publicUrl: this.getPublicUrl(key), expiresAt }
  },

  /**
   * Get a presigned GET URL for private object download.
   * @param {{ key: string, expiresIn?: number }} opts
   * @returns {Promise<{ url: string, expiresAt: Date }>}
   */
  async createDownloadUrl({ key, expiresIn = 3600 }) {
    const bucket = process.env.S3_BUCKET
    if (!bucket) throw Object.assign(new Error('S3_BUCKET is not configured'), { status: 500 })

    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(getClient(), command, { expiresIn })
    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    return { url, expiresAt }
  },

  /**
   * Build the public URL for an S3 object.
   * @param {string} key
   * @returns {string}
   */
  getPublicUrl(key) {
    const bucket = process.env.S3_BUCKET ?? ''
    const region = process.env.AWS_REGION ?? 'eu-west-1'
    const endpoint = process.env.S3_ENDPOINT
    if (endpoint) return `${endpoint}/${bucket}/${key}`
    const cdnUrl = process.env.CDN_URL
    if (cdnUrl) return `${cdnUrl.replace(/\/$/, '')}/${key}`
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
  },

  /**
   * Delete an object.
   * @param {string} key
   */
  async delete(key) {
    const bucket = process.env.S3_BUCKET
    if (!bucket) throw Object.assign(new Error('S3_BUCKET is not configured'), { status: 500 })
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    logger.info({ key }, '[StorageAdapter:s3] object deleted')
  },

  /**
   * Check if an object exists.
   * @param {string} key
   * @returns {Promise<{ exists: boolean, size?: number, contentType?: string }>}
   */
  async exists(key) {
    const bucket = process.env.S3_BUCKET
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
    const bucket = process.env.S3_BUCKET
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
    const configured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET)
    return {
      provider: 's3',
      configured,
      bucket: process.env.S3_BUCKET ?? null,
      region: process.env.AWS_REGION ?? 'eu-west-1',
      endpoint: process.env.S3_ENDPOINT ?? null,
    }
  },
}

module.exports = S3StorageAdapter
