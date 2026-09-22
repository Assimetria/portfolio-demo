/**
 * Unit tests — ContactRepo SQL contract (db mocked).
 *
 * Asserts the parts of the SQL that matter to callers: the list projection
 * excludes ip/user_agent, inserts always set retention_expires_at from the
 * configured window, and mutations return what the router expects.
 */

jest.mock('../../../src/lib/@system/PostgreSQL', () => ({
  one: jest.fn(),
  oneOrNone: jest.fn(),
  none: jest.fn(),
  any: jest.fn(),
  result: jest.fn(),
}))

const db = require('../../../src/lib/@system/PostgreSQL')
const ContactRepo = require('../../../src/db/repos/@system/ContactRepo')

beforeEach(() => jest.clearAllMocks())

describe('ContactRepo.create', () => {
  it('inserts with retention_expires_at = now() + configured interval and returns the row', async () => {
    db.one.mockResolvedValueOnce({ id: 1 })
    const row = await ContactRepo.create({
      name: 'Ana', email: 'ana@example.com', phone: null, subject: null,
      message: 'Hello there, ten chars.', sourcePath: '/', ip: '127.0.0.1', userAgent: 'jest', retentionDays: 45,
    })
    expect(row).toEqual({ id: 1 })
    const [sql, params] = db.one.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO contact_submissions/)
    expect(sql).toMatch(/retention_expires_at\)/)
    expect(sql).toMatch(/now\(\) \+ \$9::interval/)
    expect(params).toEqual(['Ana', 'ana@example.com', null, null, 'Hello there, ten chars.', '/', '127.0.0.1', 'jest', '45 days'])
  })

  it('rejects a non-integer retention window before touching the DB', async () => {
    await expect(ContactRepo.create({ name: 'A', email: 'a@b.c', message: 'x'.repeat(10), retentionDays: 1.5 })).rejects.toThrow(TypeError)
    expect(db.one).not.toHaveBeenCalled()
  })
})

describe('ContactRepo.list', () => {
  it('projects without ip/user_agent, paginates, and returns total + unreadCount', async () => {
    db.any.mockResolvedValueOnce([{ id: 2 }])
    db.one.mockResolvedValueOnce({ total: 12 }).mockResolvedValueOnce({ unread_count: 3 })

    const out = await ContactRepo.list({ page: 2, limit: 5, unread: undefined })
    expect(out).toEqual({ rows: [{ id: 2 }], total: 12, unreadCount: 3 })

    const [listSql, listParams] = db.any.mock.calls[0]
    expect(listSql).not.toMatch(/\bip\b/)
    expect(listSql).not.toMatch(/user_agent/)
    expect(listSql).toMatch(/retention_expires_at/)
    expect(listSql).toMatch(/ORDER BY created_at DESC LIMIT \$1 OFFSET \$2/)
    expect(listParams).toEqual([5, 5])
    expect(ContactRepo.LIST_COLUMNS).not.toMatch(/ip|user_agent/)
  })

  it('applies the unread filter to rows and total but not to unreadCount', async () => {
    db.any.mockResolvedValueOnce([])
    db.one.mockResolvedValueOnce({ total: 0 }).mockResolvedValueOnce({ unread_count: 0 })
    await ContactRepo.list({ page: 1, limit: 25, unread: true })
    expect(db.any.mock.calls[0][0]).toMatch(/WHERE read_at IS NULL/)
    expect(db.one.mock.calls[0][0]).toMatch(/WHERE read_at IS NULL/)
    expect(db.one.mock.calls[1][0]).toMatch(/WHERE read_at IS NULL$/)

    jest.clearAllMocks()
    db.any.mockResolvedValueOnce([])
    db.one.mockResolvedValueOnce({ total: 0 }).mockResolvedValueOnce({ unread_count: 0 })
    await ContactRepo.list({ page: 1, limit: 25, unread: false })
    expect(db.any.mock.calls[0][0]).toMatch(/WHERE read_at IS NOT NULL/)
  })
})

describe('ContactRepo.markRead / markUnread', () => {
  it('markRead is idempotent (COALESCE) and returns id + read_at', async () => {
    db.oneOrNone.mockResolvedValueOnce({ id: 7, read_at: 'ts' })
    expect(await ContactRepo.markRead(7)).toEqual({ id: 7, read_at: 'ts' })
    const [sql, params] = db.oneOrNone.mock.calls[0]
    expect(sql).toMatch(/COALESCE\(read_at, now\(\)\)/)
    expect(params).toEqual([7])
  })

  it('markUnread clears read_at', async () => {
    db.oneOrNone.mockResolvedValueOnce({ id: 7, read_at: null })
    expect(await ContactRepo.markUnread(7)).toEqual({ id: 7, read_at: null })
    expect(db.oneOrNone.mock.calls[0][0]).toMatch(/SET read_at = NULL/)
  })
})

describe('ContactRepo.remove / purgeExpired', () => {
  it('remove returns true only when a row was deleted', async () => {
    db.result.mockResolvedValueOnce({ rowCount: 1 })
    expect(await ContactRepo.remove(7)).toBe(true)
    db.result.mockResolvedValueOnce({ rowCount: 0 })
    expect(await ContactRepo.remove(8)).toBe(false)
    expect(db.result.mock.calls[0]).toEqual(['DELETE FROM contact_submissions WHERE id = $1', [7]])
  })

  it('purgeExpired deletes by retention_expires_at and returns the count', async () => {
    db.result.mockResolvedValueOnce({ rowCount: 4 })
    expect(await ContactRepo.purgeExpired()).toBe(4)
    expect(db.result.mock.calls[0][0]).toMatch(/DELETE FROM contact_submissions WHERE retention_expires_at <= now\(\)/)
  })
})
