// @custom — comments alerting configuration route (SV4-136)
const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers/auth')

// In-memory alerting configuration store (replace with DB in production)
let alertConfig = {
  enabled: true,
  slack_webhook_url: '',
  email_notifications: true,
  error_threshold: 10,
  time_window_minutes: 60,
  notify_on: ['spam', 'abuse', 'technical_error'],
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
}

// GET /api/comments-alerting/config — current alerting configuration
router.get('/comments-alerting/config', authenticate, async (req, res, next) => {
  try {
    res.json({ config: alertConfig })
  } catch (err) {
    next(err)
  }
})

// PUT /api/comments-alerting/config — update alerting configuration
router.put('/comments-alerting/config', authenticate, async (req, res, next) => {
  try {
    const { enabled, slack_webhook_url, email_notifications, error_threshold, time_window_minutes, notify_on, quiet_hours_enabled, quiet_hours_start, quiet_hours_end } = req.body

    if (enabled !== undefined) alertConfig.enabled = Boolean(enabled)
    if (slack_webhook_url !== undefined) alertConfig.slack_webhook_url = String(slack_webhook_url)
    if (email_notifications !== undefined) alertConfig.email_notifications = Boolean(email_notifications)
    if (error_threshold !== undefined) alertConfig.error_threshold = Math.max(1, Number(error_threshold))
    if (time_window_minutes !== undefined) alertConfig.time_window_minutes = Math.max(1, Number(time_window_minutes))
    if (notify_on !== undefined) alertConfig.notify_on = Array.isArray(notify_on) ? notify_on : []
    if (quiet_hours_enabled !== undefined) alertConfig.quiet_hours_enabled = Boolean(quiet_hours_enabled)
    if (quiet_hours_start !== undefined) alertConfig.quiet_hours_start = String(quiet_hours_start)
    if (quiet_hours_end !== undefined) alertConfig.quiet_hours_end = String(quiet_hours_end)

    res.json({ config: alertConfig, message: 'Alerting configuration updated successfully' })
  } catch (err) {
    next(err)
  }
})

// POST /api/comments-alerting/test — send a test alert
router.post('/comments-alerting/test', authenticate, async (req, res, next) => {
  try {
    // Simulate sending a test alert (in production this would dispatch to Slack, email, etc.)
    res.json({ message: 'Test alert sent successfully', timestamp: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})

module.exports = router