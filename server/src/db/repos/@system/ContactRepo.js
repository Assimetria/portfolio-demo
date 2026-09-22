// @system — contact_submissions repository (informational template).
//
// All SQL for the public contact form and its admin inbox lives here so the
// router only deals with HTTP. Tenant-less: one deployed product = one site.
//
// Column policy:
//   • LIST_COLUMNS is what the admin inbox sees. `ip` and `user_agent` are
//     deliberately excluded — they stay in the table for abuse review (direct
//     DB access) but are not surfaced through the API.
//   • retention_expires_at is always set explicitly on insert from the
//     configured retention window (see api/@system/contact/config.js); the
//     column default in migration 031 is only a safety net for raw inserts.

const db = require('../../../lib/@system/PostgreSQL')
const { toIntervalLiteral } = require('../../../lib/@system/Helpers/date')

const LIST_COLUMNS = 'id, name, email, phone, subject, message, source_path, created_at, read_at, retention_expires_at'

/** SQL fragment for the optional unread filter. */
function whereUnread(unread) {
  if (unread === true) return 'WHERE read_at IS NULL'
  if (unread === false) return 'WHERE read_at IS NOT NULL'
  return ''
}

const ContactRepo = {
  /**
   * Insert a submission. `retentionDays` decides retention_expires_at.
   * Returns the columns the notification email needs (ip included — the
   * email goes to the site owner, not through the public API).
   */
  async create({ name, email, phone, subject, message, sourcePath, ip, userAgent, retentionDays }) {
    const interval = toIntervalLiteral(retentionDays)
    return db.one(
      `INSERT INTO contact_submissions
         (name, email, phone, subject, message, source_path, ip, user_agent, retention_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + $9::interval)
       RETURNING id, name, email, phone, subject, message, source_path, ip, created_at, retention_expires_at`,
      [
        name,
        email,
        phone ?? null,
        subject ?? null,
        message,
        sourcePath ?? null,
        ip ?? null,
        userAgent ?? null,
        interval,
      ],
    )
  },

  async findById(id) {
    return db.oneOrNone(`SELECT ${LIST_COLUMNS} FROM contact_submissions WHERE id = $1`, [id])
  },

  /**
   * Paginated list for the admin inbox.
   * @returns {{ rows: object[], total: number, unreadCount: number }}
   */
  async list({ page = 1, limit = 25, unread } = {}) {
    const offset = (page - 1) * limit
    const where = whereUnread(unread)
    const [rows, { total }, { unread_count }] = await Promise.all([
      db.any(
        `SELECT ${LIST_COLUMNS} FROM contact_submissions ${where}
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      db.one(`SELECT COUNT(*)::int AS total FROM contact_submissions ${where}`),
      db.one('SELECT COUNT(*)::int AS unread_count FROM contact_submissions WHERE read_at IS NULL'),
    ])
    return { rows, total, unreadCount: unread_count }
  },

  async countUnread() {
    const { unread_count } = await db.one('SELECT COUNT(*)::int AS unread_count FROM contact_submissions WHERE read_at IS NULL')
    return unread_count
  },

  /** Idempotent: keeps the original read_at when already read. */
  async markRead(id) {
    return db.oneOrNone(
      `UPDATE contact_submissions SET read_at = COALESCE(read_at, now())
       WHERE id = $1 RETURNING id, read_at`,
      [id],
    )
  },

  async markUnread(id) {
    return db.oneOrNone(
      `UPDATE contact_submissions SET read_at = NULL
       WHERE id = $1 RETURNING id, read_at`,
      [id],
    )
  },

  /** GDPR erasure (Art. 17) — hard delete. Returns true when a row was removed. */
  async remove(id) {
    const result = await db.result('DELETE FROM contact_submissions WHERE id = $1', [id])
    return result.rowCount > 0
  },

  /**
   * Retention purge — deletes rows whose retention window has elapsed.
   * Called daily by the scheduler (ContactRetentionPurgeTask). Returns the
   * number of rows removed.
   */
  async purgeExpired() {
    const result = await db.result('DELETE FROM contact_submissions WHERE retention_expires_at <= now()')
    return result.rowCount
  },
}

module.exports = ContactRepo
module.exports.LIST_COLUMNS = LIST_COLUMNS
