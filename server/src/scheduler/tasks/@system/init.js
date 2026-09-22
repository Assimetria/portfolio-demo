'use strict'

// @system — template-owned scheduled tasks.
// Called from src/index.js before scheduler/tasks/@custom/init.js so products
// can rely on these running (and can still register their own). Keep the list
// small and every task idempotent; the scheduler records each run in
// scheduled_task_runs.

const ContactRetentionPurgeTask = require('./contact/contactRetentionPurge')

/**
 * @param {import('./scheduler')} scheduler
 */
function init(scheduler) {
  scheduler.registerTask(new ContactRetentionPurgeTask())
}

module.exports = init
