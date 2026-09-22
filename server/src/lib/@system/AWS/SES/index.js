// @system — AWS SES client (singleton)
// Low-level SES wrapper. For sending transactional emails prefer the higher-level
// Email lib (lib/@system/Email) which handles transport selection, templates, and logging.
//
// Use this module when you need direct SES access (e.g. bounce/complaint webhooks,
// sending-quota checks, suppression-list management).
//
// Required env vars:
//   AWS_REGION            — e.g. eu-west-1
//   AWS_ACCESS_KEY_ID     — IAM access key with ses:SendRawEmail permission
//   AWS_SECRET_ACCESS_KEY — IAM secret key
//   SES_FROM_EMAIL        — Verified sender (fallback when EMAIL_FROM is absent)
//
// Usage:
//   const SES = require('./lib/@system/AWS/SES')
//   const quota = await SES.getSendingQuota()
//   const stats  = await SES.getSendingStats()
//   const { messageId } = await SES.sendEmail({ to, subject, html, text })

'use strict'

const logger = require('../../Logger')

let _client = null

/**
 * Return (and lazily init) the SESClient singleton.
 * Throws if AWS credentials are not configured.
 */
function getClient() {
  if (_client) return _client

  const { SESClient } = require('@aws-sdk/client-ses')

  _client = new SESClient({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  })

  logger.info({ region: process.env.AWS_REGION }, '[SES] client initialized')
  return _client
}

// ── Quota & Stats ─────────────────────────────────────────────────────────────

/**
 * Retrieve the account's SES sending quota.
 * @returns {Promise<{ max24HourSend: number, maxSendRate: number, sentLast24Hours: number }>}
 */
async function getSendingQuota() {
  const { GetSendQuotaCommand } = require('@aws-sdk/client-ses')
  const res = await getClient().send(new GetSendQuotaCommand({}))
  return {
    max24HourSend: res.Max24HourSend,
    maxSendRate: res.MaxSendRate,
    sentLast24Hours: res.SentLast24Hours,
  }
}

/**
 * Retrieve SES send/bounce/complaint statistics for the last two weeks.
 * @returns {Promise<Array<{ timestamp: Date, deliveryAttempts: number, bounces: number, complaints: number, rejects: number }>>}
 */
async function getSendingStats() {
  const { GetSendStatisticsCommand } = require('@aws-sdk/client-ses')
  const res = await getClient().send(new GetSendStatisticsCommand({}))
  return (res.SendDataPoints ?? []).map((p) => ({
    timestamp: p.Timestamp,
    deliveryAttempts: p.DeliveryAttempts,
    bounces: p.Bounces,
    complaints: p.Complaints,
    rejects: p.Rejects,
  }))
}

// ── Suppression list ──────────────────────────────────────────────────────────

/**
 * Check if an email address is on the account-level suppression list.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function isSuppressed(email) {
  try {
    const { SESv2Client, GetSuppressedDestinationCommand } = require('@aws-sdk/client-sesv2')
    const v2 = new SESv2Client({
      region: process.env.AWS_REGION ?? 'eu-west-1',
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
        : {}),
    })
    await v2.send(new GetSuppressedDestinationCommand({ EmailAddress: email }))
    return true
  } catch (err) {
    if (err.name === 'NotFoundException') return false
    throw err
  }
}

// ── Direct send (escape hatch) ────────────────────────────────────────────────

/**
 * Send a simple email directly via SES (bypasses the Email lib transport system).
 * Prefer Email.send() for normal transactional emails.
 *
 * @param {object} opts
 * @param {string}   opts.to
 * @param {string}   opts.subject
 * @param {string}   opts.html
 * @param {string}  [opts.text]
 * @param {string}  [opts.from]   Defaults to SES_FROM_EMAIL / EMAIL_FROM
 * @returns {Promise<{ messageId: string }>}
 */
async function sendEmail({ to, subject, html, text, from }) {
  const { SendEmailCommand } = require('@aws-sdk/client-ses')

  const sender = from ?? process.env.SES_FROM_EMAIL ?? process.env.EMAIL_FROM ?? 'noreply@example.com'

  const cmd = new SendEmailCommand({
    Source: sender,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
      },
    },
  })

  const res = await getClient().send(cmd)
  const messageId = res.MessageId
  logger.info({ to, subject, messageId }, '[SES] sendEmail ok')
  return { messageId }
}

/**
 * Reset the cached SES client (useful in tests).
 */
function resetClient() {
  _client = null
}

module.exports = { getClient, getSendingQuota, getSendingStats, isSuppressed, sendEmail, resetClient }
