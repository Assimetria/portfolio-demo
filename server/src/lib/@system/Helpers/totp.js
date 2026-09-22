// @system — TOTP code verification shared by 2FA enrolment (api/@system/totp) and the login gate
// (Helpers/loginFlow). One definition of the algorithm parameters, so a code that enrols also logs in.
'use strict'

const OTPAuth = require('otpauth')

/** RFC 6238 defaults used by every authenticator app: SHA1, 6 digits, 30-second step. */
const TOTP_PARAMS = Object.freeze({ algorithm: 'SHA1', digits: 6, period: 30 })

/** ±1 step tolerates 30 s of clock skew between the phone and the server. */
const TOTP_WINDOW = 1

/**
 * @param {string} secret  base32 secret stored on the user row
 * @param {string|number} code  6-digit code (spaces tolerated — apps display "123 456")
 * @returns {boolean}
 */
function verifyTotpCode(secret, code) {
  if (!secret || code === undefined || code === null || code === '') return false
  const totp = new OTPAuth.TOTP({ ...TOTP_PARAMS, secret: OTPAuth.Secret.fromBase32(secret) })
  return totp.validate({ token: String(code).replace(/\s/g, ''), window: TOTP_WINDOW }) !== null
}

module.exports = { verifyTotpCode, TOTP_PARAMS, TOTP_WINDOW }
