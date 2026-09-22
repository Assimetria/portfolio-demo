// @system — Communication preferences repository (raw SQL / pg-promise)
const db = require('../../../lib/@system/PostgreSQL')

const CommunicationPreferencesRepo = {
  async findByUserId(userId) {
    return db.oneOrNone('SELECT * FROM communication_preferences WHERE user_id = $1', [userId])
  },

  async ensureExists(userId) {
    return db.one(
      `INSERT INTO communication_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [userId],
    )
  },

  async update(userId, preferences) {
    const fields = []
    const values = [userId]
    let idx = 2

    const allowed = [
      'email_marketing',
      'product_updates',
      'weekly_digest',
      'in_app_notifications',
      'sms_notifications',
      'gdpr_consent',
    ]

    for (const key of allowed) {
      if (preferences[key] !== undefined) {
        fields.push(`${key} = $${idx}`)
        values.push(preferences[key])
        idx++
      }
    }

    if (preferences.gdpr_consent === true) {
      fields.push(`gdpr_consent_at = now()`)
    }

    if (fields.length === 0) return this.findByUserId(userId)

    fields.push('updated_at = now()')

    return db.oneOrNone(
      `UPDATE communication_preferences SET ${fields.join(', ')} WHERE user_id = $1 RETURNING *`,
      values,
    )
  },

  async toggleEmail(userId, enabled) {
    return db.oneOrNone(
      `UPDATE communication_preferences SET email_marketing = $2, updated_at = now()
       WHERE user_id = $1 RETURNING *`,
      [userId, enabled],
    )
  },

  async togglePush(userId, enabled) {
    return db.oneOrNone(
      `UPDATE communication_preferences SET in_app_notifications = $2, updated_at = now()
       WHERE user_id = $1 RETURNING *`,
      [userId, enabled],
    )
  },

  async toggleSms(userId, enabled) {
    return db.oneOrNone(
      `UPDATE communication_preferences SET sms_notifications = $2, updated_at = now()
       WHERE user_id = $1 RETURNING *`,
      [userId, enabled],
    )
  },

  async getUsersWithEmailEnabled() {
    return db.any(
      `SELECT cp.*, u.email, u.name FROM communication_preferences cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.email_marketing = true`,
    )
  },

  async isUnsubscribed(userId) {
    const prefs = await this.findByUserId(userId)
    return prefs ? !prefs.email_marketing : false
  },
}

module.exports = CommunicationPreferencesRepo
