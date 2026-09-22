'use strict'

// @system — Scheduler
// Manages registration and execution of BaseTask subclasses.
// Uses node-cron for scheduling and records every run in scheduled_task_runs.

const cron = require('node-cron')
const logger = require('../../../lib/@system/Logger')
const db = require('../../../lib/@system/PostgreSQL')
const { isEnabled: isModuleEnabled } = require('../../../lib/@system/Helpers/modules')

class Scheduler {
  constructor() {
    /** @type {Map<string, import('./base/BaseTask')>} */
    this.tasks = new Map()
    /** @type {Array<import('./base/BaseTask')>} Sequential execution queue */
    this.taskQueue = []
    this.isExecuting = false
  }

  /**
   * Register a task and schedule it via node-cron.
   * @param {import('./base/BaseTask')} task
   */
  registerTask(task) {
    // Feature modules: a task tagged with a module (BaseTask `module` option)
    // is not scheduled when brand.json switches that module off, e.g. the
    // billing invoice/financials jobs on an informational site.
    if (task.module && !isModuleEnabled(task.module)) {
      logger.info({ task: task.name, module: task.module }, '[scheduler] module disabled in brand.json — task not scheduled')
      return
    }
    if (this.tasks.has(task.name)) {
      logger.warn({ task: task.name }, '[scheduler] task already registered — skipping duplicate')
      return
    }
    this.tasks.set(task.name, task)
    this._scheduleTask(task)
    task.logNextRun()
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _scheduleTask(task) {
    const expression = task.getSchedule()
    if (!cron.validate(expression)) {
      logger.error({ task: task.name, expression }, '[scheduler] invalid cron expression — task not scheduled')
      return
    }
    logger.info({ task: task.name, expression }, '[scheduler] task scheduled')
    cron.schedule(expression, () => this._enqueueTask(task))
  }

  _enqueueTask(task) {
    if (task.runInParallel) {
      this._executeParallelTask(task)
    } else {
      if (!this.taskQueue.some((t) => t.name === task.name)) {
        this.taskQueue.push(task)
        this._executeNextTask()
      }
    }
  }

  async _executeParallelTask(task) {
    logger.info({ task: task.name }, '[scheduler] executing parallel task')
    let runId = null
    try {
      runId = await this._createRun(task.name)
      task
        .execute()
        .then(() => this._finishRun(runId, 'completed'))
        .catch((err) => {
          logger.error({ task: task.name, err }, '[scheduler] parallel task failed')
          this._finishRun(runId, 'failed', err.message)
        })
    } catch (err) {
      logger.error({ task: task.name, err }, '[scheduler] failed to start parallel task')
      if (runId) await this._finishRun(runId, 'failed', err.message)
    }
  }

  async _executeNextTask() {
    if (this.isExecuting || this.taskQueue.length === 0) return
    this.isExecuting = true
    const task = this.taskQueue.shift()
    let runId = null
    try {
      runId = await this._createRun(task.name)
      await task.execute()
      await this._finishRun(runId, 'completed')
    } catch (err) {
      logger.error({ task: task.name, err }, '[scheduler] task failed')
      if (runId) await this._finishRun(runId, 'failed', err.message)
    } finally {
      this.isExecuting = false
      this._executeNextTask()
    }
  }

  // ── DB helpers ───────────────────────────────────────────────────────────

  async _createRun(taskName) {
    try {
      const row = await db.one(
        `INSERT INTO scheduled_task_runs (task_name, status, scheduled_for, started_at)
         VALUES ($1, 'processing', NOW(), NOW())
         RETURNING id`,
        [taskName]
      )
      return row.id
    } catch (err) {
      logger.error({ taskName, err }, '[scheduler] failed to create run record')
      return null
    }
  }

  async _finishRun(id, status, errorMsg = null) {
    if (!id) return
    try {
      await db.none(
        `UPDATE scheduled_task_runs
            SET status = $1, finished_at = NOW(), error = $2
          WHERE id = $3`,
        [status, errorMsg, id]
      )
    } catch (err) {
      logger.error({ id, status, err }, '[scheduler] failed to update run record')
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Immediately enqueue a task by name (bypasses cron schedule).
   * @param {string} taskName
   */
  executeTaskNow(taskName) {
    const task = this.tasks.get(taskName)
    if (!task) throw new Error(`[scheduler] task not found: ${taskName}`)
    this._enqueueTask(task)
  }
}

module.exports = new Scheduler()
