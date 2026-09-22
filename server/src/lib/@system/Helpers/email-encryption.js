// @system — email encryption helpers
// Provides normalisation and hashing utilities for email addresses.
//
// The decryptEmail stub is a no-op placeholder.  In production, replace it
// with actual symmetric encryption (e.g. AES-256-GCM) if you need encrypted
// email-at-rest.  The hash and normalise helpers are always functional.

const crypto = require('crypto')

/**
 * Return the SHA-256 hex digest of a normalised email address.
 * Useful for equality checks, bloom filters, or lookup keys that avoid
 * storing plaintext email addresses.
 */
function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

/**
 * Decrypt an email address that was previously encrypted with encryptEmail.
 * Stub: returns the value as-is — replace with real decryption when needed.
 */
function decryptEmail(encrypted) {
  // No-op: return as-is (no encryption configured)
  return encrypted
}

/**
 * Normalise an email address: lowercase + trim.
 * Apply this before storing or comparing email addresses.
 */
function normaliseEmail(email) {
  return email.toLowerCase().trim()
}

module.exports = { hashEmail, decryptEmail, normaliseEmail }
