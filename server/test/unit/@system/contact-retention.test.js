/**
 * Unit tests — contact retention: migration 031 + ContactRetentionPurgeTask
 * + @system scheduler init.
 */

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
  result: jest.fn(),
}))
jest.mock('../../../src/lib/@system/Logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock('../../../src/db/repos/@system/ContactRepo', () => ({ purgeExpired: jest.fn() }))

const ContactRepo = require('../../../src/db/repos/@system/ContactRepo')
const logger = require('../../../src/lib/@system/Logger')
const ContactRetentionPurgeTask = require('../../../src/scheduler/tasks/@system/contact/contactRetentionPurge')
const initSystemTasks = require('../../../src/scheduler/tasks/@system/init')
const migration = require('../../../src/db/migrations/@system/031_contact_submissions_retention')

const snapshot = process.env.CONTACT_RETENTION_DAYS
beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.CONTACT_RETENTION_DAYS
})
afterAll(() => {
  if (snapshot === undefined) delete process.env.CONTACT_RETENTION_DAYS
  else process.env.CONTACT_RETENTION_DAYS = snapshot
})

describe('ContactRetentionPurgeTask', () => {
  it('has a stable name and a daily cron schedule', () => {
    const task = new ContactRetentionPurgeTask()
    expect(task.name).toBe('contact_retention_purge')
    expect(task.runInParallel).toBe(false)
    expect(task.getSchedule()).toBe('30 3 * * *')
    expect(task.getNextRunTime()).toBeInstanceOf(Date)
  })

  it('purges via the repo and reports stats', async () => {
    process.env.CONTACT_RETENTION_DAYS = '30'
    ContactRepo.purgeExpired.mockResolvedValueOnce(9)
    const stats = await new ContactRetentionPurgeTask().execute()
    expect(stats).toEqual({ retentionDays: 30, deleted: 9 })
    expect(logger.info).toHaveBeenCalled()
  })

  it('treats a missing table as a skip, not a failure', async () => {
    ContactRepo.purgeExpired.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: '42P01' }))
    await expect(new ContactRetentionPurgeTask().execute()).resolves.toEqual({ retentionDays: 180, deleted: 0 })
    expect(logger.warn).toHaveBeenCalled()
  })

  it('propagates other errors so the scheduler records a failed run', async () => {
    ContactRepo.purgeExpired.mockRejectedValueOnce(new Error('boom'))
    await expect(new ContactRetentionPurgeTask().execute()).rejects.toThrow('boom')
  })
})

describe('scheduler/tasks/@system/init', () => {
  it('registers the purge task on the given scheduler', () => {
    const scheduler = { registerTask: jest.fn() }
    initSystemTasks(scheduler)
    expect(scheduler.registerTask).toHaveBeenCalledTimes(1)
    expect(scheduler.registerTask.mock.calls[0][0]).toBeInstanceOf(ContactRetentionPurgeTask)
  })
})

describe('migration 031_contact_submissions_retention', () => {
  function fakeDb() {
    return { none: jest.fn(async () => {}) }
  }

  it('adds the column idempotently, backfills only NULLs from created_at, sets default + NOT NULL, indexes', async () => {
    process.env.CONTACT_RETENTION_DAYS = '60'
    const db = fakeDb()
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    await migration.up(db)
    log.mockRestore()

    const statements = db.none.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').trim())
    expect(statements[0]).toMatch(/ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ/)
    expect(statements[1]).toMatch(/UPDATE contact_submissions SET retention_expires_at = created_at \+ \$1::interval WHERE retention_expires_at IS NULL/)
    expect(db.none.mock.calls[1][1]).toEqual(['60 days'])
    expect(statements[2]).toMatch(/SET DEFAULT \(now\(\) \+ interval '60 days'\)/)
    expect(statements[2]).toMatch(/SET NOT NULL/)
    expect(statements[3]).toMatch(/CREATE INDEX IF NOT EXISTS idx_contact_submissions_retention ON contact_submissions\(retention_expires_at\)/)
  })

  it('down drops the index and the column (IF EXISTS)', async () => {
    const db = fakeDb()
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    await migration.down(db)
    log.mockRestore()
    const statements = db.none.mock.calls.map(([sql]) => sql)
    expect(statements[0]).toMatch(/DROP INDEX IF EXISTS idx_contact_submissions_retention/)
    expect(statements[1]).toMatch(/DROP COLUMN IF EXISTS retention_expires_at/)
  })
})
