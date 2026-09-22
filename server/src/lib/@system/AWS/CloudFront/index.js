// @system — AWS CloudFront CDN service: signed URLs, geo-restriction config
'use strict'

const crypto = require('crypto')
const logger = require('../Logger')

// CloudFront base64 uses URL-safe variant: replace +→-, =→_, /→~
function cfBase64(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/=/g, '_').replace(/\//g, '~')
}

function getConfig() {
  return {
    domain: process.env.CLOUDFRONT_DOMAIN ?? null,
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID ?? null,
    privateKey: process.env.CLOUDFRONT_PRIVATE_KEY
      ? process.env.CLOUDFRONT_PRIVATE_KEY.replace(/\\n/g, '\n')
      : null,
    customDomain: process.env.CDN_CUSTOM_DOMAIN ?? null,
    geoRestriction: process.env.CDN_GEO_RESTRICTION
      ? process.env.CDN_GEO_RESTRICTION.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
      : [],
    signedUrlTtl: parseInt(process.env.CLOUDFRONT_SIGNED_URL_TTL ?? '3600', 10),
  }
}

function isConfigured() {
  const { domain, keyPairId, privateKey } = getConfig()
  return !!(domain && keyPairId && privateKey)
}

/**
 * Build the CDN URL for a given storage key.
 * Falls back to the CDN_URL env var (used by S3StorageAdapter) or null.
 */
function getPublicUrl(key) {
  const { domain, customDomain } = getConfig()
  const base = customDomain ?? (domain ? `https://${domain}` : null) ?? process.env.CDN_URL ?? null
  if (!base) return null
  return `${base.replace(/\/$/, '')}/${key}`
}

/**
 * Generate a CloudFront signed URL for private content using a canned policy.
 * Requires CLOUDFRONT_DOMAIN, CLOUDFRONT_KEY_PAIR_ID, CLOUDFRONT_PRIVATE_KEY.
 *
 * @param {{ key: string, expiresIn?: number }} opts
 * @returns {{ url: string, expiresAt: Date }}
 */
function createSignedUrl({ key, expiresIn }) {
  const { domain, keyPairId, privateKey, signedUrlTtl, customDomain } = getConfig()

  if (!domain) throw Object.assign(new Error('CLOUDFRONT_DOMAIN is not configured'), { status: 500 })
  if (!keyPairId) throw Object.assign(new Error('CLOUDFRONT_KEY_PAIR_ID is not configured'), { status: 500 })
  if (!privateKey) throw Object.assign(new Error('CLOUDFRONT_PRIVATE_KEY is not configured'), { status: 500 })

  const ttl = expiresIn ?? signedUrlTtl
  const expires = Math.floor(Date.now() / 1000) + ttl
  const expiresAt = new Date(expires * 1000)

  const baseUrl = customDomain
    ? `${customDomain.replace(/\/$/, '')}/${key}`
    : `https://${domain}/${key}`

  // Canned policy document
  const policy = JSON.stringify({
    Statement: [{
      Resource: baseUrl,
      Condition: { DateLessThan: { 'AWS:EpochTime': expires } },
    }],
  })

  const sign = crypto.createSign('RSA-SHA1')
  sign.update(policy)
  const signature = cfBase64(sign.sign(privateKey))

  const url = `${baseUrl}?Expires=${expires}&Signature=${signature}&Key-Pair-Id=${keyPairId}`

  logger.info({ key, expiresAt }, '[CloudFront] signed URL created')
  return { url, expiresAt }
}

/**
 * Generate CloudFront signed cookies for a path prefix (e.g. for video streaming).
 * Returns Set-Cookie values for CloudFront-Policy, CloudFront-Signature, CloudFront-Key-Pair-Id.
 *
 * @param {{ resourcePattern: string, expiresIn?: number }} opts
 * @returns {{ cookies: Record<string, string>, expiresAt: Date }}
 */
function createSignedCookies({ resourcePattern, expiresIn }) {
  const { domain, keyPairId, privateKey, signedUrlTtl } = getConfig()

  if (!domain) throw Object.assign(new Error('CLOUDFRONT_DOMAIN is not configured'), { status: 500 })
  if (!keyPairId) throw Object.assign(new Error('CLOUDFRONT_KEY_PAIR_ID is not configured'), { status: 500 })
  if (!privateKey) throw Object.assign(new Error('CLOUDFRONT_PRIVATE_KEY is not configured'), { status: 500 })

  const ttl = expiresIn ?? signedUrlTtl
  const expires = Math.floor(Date.now() / 1000) + ttl
  const expiresAt = new Date(expires * 1000)

  const policy = JSON.stringify({
    Statement: [{
      Resource: resourcePattern,
      Condition: { DateLessThan: { 'AWS:EpochTime': expires } },
    }],
  })

  const encodedPolicy = cfBase64(Buffer.from(policy))

  const sign = crypto.createSign('RSA-SHA1')
  sign.update(policy)
  const signature = cfBase64(sign.sign(privateKey))

  const cookies = {
    'CloudFront-Policy': encodedPolicy,
    'CloudFront-Signature': signature,
    'CloudFront-Key-Pair-Id': keyPairId,
  }

  logger.info({ resourcePattern, expiresAt }, '[CloudFront] signed cookies created')
  return { cookies, expiresAt }
}

/**
 * Return CDN health/config status.
 */
function health() {
  const { domain, keyPairId, customDomain, geoRestriction, signedUrlTtl } = getConfig()
  return {
    configured: isConfigured(),
    domain: domain ?? null,
    customDomain: customDomain ?? null,
    keyPairId: keyPairId ? `${keyPairId.slice(0, 4)}…` : null,
    geoRestriction,
    signedUrlTtl,
    cdnUrl: process.env.CDN_URL ?? null,
  }
}

module.exports = { createSignedUrl, createSignedCookies, getPublicUrl, health, isConfigured, getConfig }
