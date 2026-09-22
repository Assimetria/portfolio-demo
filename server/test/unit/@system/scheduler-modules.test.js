/**
 * Scheduler ↔ feature modules.
 *
 * BaseTask accepts `{ module }`; Scheduler.registerTask() refuses to schedule a
 * task whose module brand.json switches off. The billing jobs
 * (dailyInvoiceGeneration, dailyFinancials) are tagged 'billing', the blog
 * publisher 'blog'.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn(), validate: jest.fn(() => true) }))
jest.mock('../../../src/lib/@system/PostgreSQL', () => ({ one: jest.fn(), none: jest.fn(), any: jest.fn() }))
jest.mock('../../../src/lib/@system/Logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }))
// The scheduler destructures isEnabled at require time, so the helper itself is mocked.
jest.mock('../../../src/lib/@system/Helpers/modules', () => ({ isEnabled: jest.fn(() => true) }))

const cron = require('node-cron')
const modules = require('../../../src/lib/@system/Helpers/modules')

const Scheduler = require('../../../src/scheduler/tasks/@system/scheduler').constructor
const BaseTask = require('../../../src/scheduler/tasks/@system/base/BaseTask')
const DailyInvoiceGenerationTask = require('../../../src/scheduler/tasks/@system/payments/dailyInvoiceGeneration')
const DailyFinancialsReportTask = require('../../../src/scheduler/tasks/@system/reports/financials/dailyFinancials')
const DailyArticlePublishingTask = require('../../../src/scheduler/tasks/@system/blog/dailyArticlePublishing')

const spy = modules.isEnabled
beforeEach(() => {
  cron.schedule.mockClear()
  spy.mockReset()
  spy.mockReturnValue(true)
})

describe('task module tags', () => {
  it('billing and blog tasks carry their module; untagged tasks are always-on', () => {
    expect(new DailyInvoiceGenerationTask().module).toBe('billing')
    expect(new DailyFinancialsReportTask().module).toBe('billing')
    expect(new DailyArticlePublishingTask().module).toBe('blog')
    expect(new BaseTask('plain').module).toBeNull()
  })
})

describe('Scheduler.registerTask', () => {
  it('skips tasks whose module is disabled and schedules the rest', () => {
    spy.mockImplementation((key) => key !== 'billing')
    const scheduler = new Scheduler()

    scheduler.registerTask(new DailyInvoiceGenerationTask())
    scheduler.registerTask(new DailyFinancialsReportTask())
    expect(scheduler.tasks.size).toBe(0)
    expect(cron.schedule).not.toHaveBeenCalled()

    scheduler.registerTask(new DailyArticlePublishingTask())
    scheduler.registerTask(new BaseTask('plain'))
    expect([...scheduler.tasks.keys()]).toEqual(['daily_article_publishing', 'plain'])
    expect(cron.schedule).toHaveBeenCalledTimes(2)
  })

  it('schedules billing tasks when the module is enabled', () => {
    spy.mockReturnValue(true)
    const scheduler = new Scheduler()
    scheduler.registerTask(new DailyInvoiceGenerationTask())
    expect(scheduler.tasks.has('daily_invoice_generation')).toBe(true)
    expect(cron.schedule).toHaveBeenCalledTimes(1)
  })
})
