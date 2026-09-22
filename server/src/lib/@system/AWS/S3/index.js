// @system — AWS S3 client
// Configured from environment variables. Shared singleton — import this instead of
// instantiating S3Client directly.
//
// Required env vars (see Env/index.js):
//   AWS_REGION            — e.g. "eu-west-1"
//   AWS_ACCESS_KEY_ID     — IAM access key
//   AWS_SECRET_ACCESS_KEY — IAM secret key
//   S3_BUCKET             — default bucket name
//
// Optional:
//   S3_ENDPOINT           — custom endpoint (e.g. for MinIO / localstack)
//
// Usage:
//   const { s3, bucket } = require('./lib/@system/AWS/S3')
//   const { GetObjectCommand } = require('@aws-sdk/client-s3')
//   await s3.send(new GetObjectCommand({ Bucket: bucket, Key: 'path/to/file' }))
//
// Presigned upload:
//   const S3 = require('./lib/@system/AWS/S3')
//   const { url, key, expiresAt } = await S3.createPresignedPutUrl({ filename, contentType })

const { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { v4: uuidv4 } = require('uuid')

const region = process.env.AWS_REGION ?? 'eu-west-1'
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? ''
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? ''
const endpoint = process.env.S3_ENDPOINT ?? undefined

const s3 = new S3Client({
  region,
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
})

const bucket = process.env.S3_BUCKET ?? ''

const DEFAULT_EXPIRES_IN = 300 // 5 minutes

/**
 * Generate a presigned PUT URL for direct browser-to-S3 upload.
 *
 * @param {object} options
 * @param {string} options.filename    - Original filename (used to derive extension)
 * @param {string} options.contentType - MIME type
 * @param {string} [options.folder]    - S3 key prefix (default: 'uploads')
 * @param {string} [options.targetBucket] - Override default bucket
 * @param {number} [options.expiresIn] - Seconds until URL expires (default: 300)
 * @returns {Promise<{ url: string, key: string, bucket: string, expiresAt: Date }>}
 */
async function createPresignedPutUrl({ filename, contentType, folder = 'uploads', targetBucket, expiresIn = DEFAULT_EXPIRES_IN }) {
  const useBucket = targetBucket ?? bucket
  if (!useBucket) throw new Error('[S3] S3_BUCKET is not configured')

  const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : ''
  const key = `${folder}/${uuidv4()}${ext ? '.' + ext : ''}`

  const command = new PutObjectCommand({
    Bucket: useBucket,
    Key: key,
    ContentType: contentType,
  })

  const url = await getSignedUrl(s3, command, { expiresIn })
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  return { url, key, bucket: useBucket, expiresAt }
}

/**
 * Build the public URL for an S3 object.
 * Assumes the object is publicly readable or served via CloudFront.
 *
 * @param {string} key
 * @param {string} [targetBucket]
 * @returns {string}
 */
function getPublicUrl(key, targetBucket) {
  const useBucket = targetBucket ?? bucket
  if (endpoint) return `${endpoint}/${useBucket}/${key}`
  return `https://${useBucket}.s3.${region}.amazonaws.com/${key}`
}

/**
 * Delete an S3 object.
 *
 * @param {string} key
 * @param {string} [targetBucket]
 */
async function deleteObject(key, targetBucket) {
  const useBucket = targetBucket ?? bucket
  await s3.send(new DeleteObjectCommand({ Bucket: useBucket, Key: key }))
}

/**
 * Check if an object exists and retrieve its metadata.
 *
 * @param {string} key
 * @param {string} [targetBucket]
 * @returns {Promise<{ exists: boolean, size?: number, contentType?: string }>}
 */
async function headObject(key, targetBucket) {
  const useBucket = targetBucket ?? bucket
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: useBucket, Key: key }))
    return { exists: true, size: res.ContentLength, contentType: res.ContentType }
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return { exists: false }
    }
    throw err
  }
}

module.exports = { s3, bucket, createPresignedPutUrl, getPublicUrl, deleteObject, headObject }
