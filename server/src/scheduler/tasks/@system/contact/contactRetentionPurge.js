'use strict'

// @system — ContactRetentionPurgeTask
// Deletes contact_submissions whose retention_expires_at has passed. Runs
// daily (03:30) so personal data from the public contact form is not kept
// beyond the configured window (brand.json site.contact.retentionDays /
// CONTACT_RETENTION_DAYS, default 180 — see api/@system/contact/config.js).
//
// Registered by scheduler/tasks/@system/init.js.

const BaseTask = require('../base/BaseTask')
const logger = require('../../../../lib/@system/Logger')
const ContactRepo = require('../../../../db/repos/@system/ContactRepo')
const { retentionDays } = require('../../../../api/@system/contact/config')

class ContactRetentionPurgeTask extends BaseTask {
  constructor() {
    super('contact_retention_purge', false)
  }

  getSchedule() {
    return '30 3 * * *' // daily 03:30
  }

  async execute() {
    const stats = { retentionDays: retentionDays(), deleted: 0 }
    try {
      stats.deleted = await ContactRepo.purgeExpired()
    } catch (err) {
      // Table not created yet (migrations pending) is not a task failure.
      if (err && err.code === '42P01') {
        logger.warn('[scheduler] contact_submissions missing — retention purge skipped')
        return stats
      }
      throw err
    }
    logger.info({ stats }, '[scheduler] contact retention purge done')
    return stats
  }
}

module.exports = ContactRetentionPurgeTask
