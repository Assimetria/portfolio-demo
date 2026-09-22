/**
 * Audit Log System
 * 
 * Provides comprehensive audit trail for user actions, data changes,
 * and system events for compliance and security monitoring.
 */

const db = require('../PostgreSQL')
const logger = require('../Logger')

/**
 * Log a user or system action to the audit trail
 * 
 * @param {Object} options - Audit log details
 * @param {number} options.userId - User ID performing the action (null for system)
 * @param {string} options.action - Action performed (e.g., 'user.login', 'data.update')
 * @param {string} options.resourceType - Type of resource affected (e.g., 'user', 'post', 'subscription')
 * @param {string} options.resourceId - ID of the resource affected
 * @param {Object} options.details - Additional details (before/after, metadata, etc.)
 * @param {string} options.ipAddress - IP address of the request
 * @param {string} options.userAgent - User agent string
 * @param {string} options.status - Status of the action ('success', 'failure', 'pending')
 * @returns {Promise<Object>} Created audit log entry
 */
async function logAction({
  userId = null,
  action,
  resourceType = null,
  resourceId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  status = 'success',
}) {
  try {
    const entry = await db.one(
      `INSERT INTO audit_logs 
       (user_id, action, resource_type, resource_id, details, ip_address, user_agent, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        userId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details),
        ipAddress,
        userAgent,
        status,
      ]
    )

    logger.info({
      auditLogId: entry.id,
      userId,
      action,
      resourceType,
      resourceId,
      status,
    }, '[AuditLog] Action logged')

    return entry
  } catch (err) {
    logger.error({ err, userId, action, resourceType }, '[AuditLog] Failed to write audit log')
    // Don't throw - audit log failures shouldn't break the app
    return null
  }
}

/**
 * Log a data change with before/after snapshots
 * 
 * @param {Object} options - Change details
 * @param {number} options.userId - User making the change
 * @param {string} options.action - Action type (e.g., 'update', 'delete')
 * @param {string} options.resourceType - Resource type
 * @param {string} options.resourceId - Resource ID
 * @param {Object} options.before - Data before change
 * @param {Object} options.after - Data after change
 * @param {string} options.ipAddress - Request IP
 * @param {string} options.userAgent - User agent
 * @returns {Promise<Object>} Created audit log entry
 */
async function logDataChange({
  userId,
  action,
  resourceType,
  resourceId,
  before = null,
  after = null,
  ipAddress = null,
  userAgent = null,
}) {
  return logAction({
    userId,
    action: `${resourceType}.${action}`,
    resourceType,
    resourceId,
    details: { before, after },
    ipAddress,
    userAgent,
    status: 'success',
  })
}

/**
 * Log authentication events
 * 
 * @param {Object} options - Auth event details
 * @param {number} options.userId - User ID (null for failed logins)
 * @param {string} options.action - Auth action ('login', 'logout', 'failed_login', 'password_reset')
 * @param {boolean} options.success - Whether action succeeded
 * @param {string} options.ipAddress - Request IP
 * @param {string} options.userAgent - User agent
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Created audit log entry
 */
async function logAuthEvent({
  userId = null,
  action,
  success,
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) {
  return logAction({
    userId,
    action: `auth.${action}`,
    resourceType: 'user',
    resourceId: userId ? userId.toString() : null,
    details: metadata,
    ipAddress,
    userAgent,
    status: success ? 'success' : 'failure',
  })
}

/**
 * Log security events
 * 
 * @param {Object} options - Security event details
 * @param {number} options.userId - User ID if applicable
 * @param {string} options.event - Security event type
 * @param {string} options.severity - Severity level ('low', 'medium', 'high', 'critical')
 * @param {Object} options.details - Event details
 * @param {string} options.ipAddress - Request IP
 * @param {string} options.userAgent - User agent
 * @returns {Promise<Object>} Created audit log entry
 */
async function logSecurityEvent({
  userId = null,
  event,
  severity = 'medium',
  details = {},
  ipAddress = null,
  userAgent = null,
}) {
  const entry = await logAction({
    userId,
    action: `security.${event}`,
    resourceType: 'system',
    resourceId: null,
    details: { ...details, severity },
    ipAddress,
    userAgent,
    status: 'success',
  })

  // Log high/critical severity to main logger for alerting
  if (['high', 'critical'].includes(severity)) {
    logger.warn({
      auditLogId: entry?.id,
      userId,
      event,
      severity,
      details,
    }, `[Security] ${severity.toUpperCase()} event: ${event}`)
  }

  return entry
}

/**
 * Query audit logs
 * 
 * @param {Object} filters - Query filters
 * @param {number} filters.userId - Filter by user ID
 * @param {string} filters.action - Filter by action (supports wildcards with %)
 * @param {string} filters.resourceType - Filter by resource type
 * @param {string} filters.resourceId - Filter by resource ID
 * @param {Date} filters.startDate - Filter by date range (start)
 * @param {Date} filters.endDate - Filter by date range (end)
 * @param {number} filters.limit - Max results (default 100)
 * @param {number} filters.offset - Pagination offset
 * @returns {Promise<Array>} Audit log entries
 */
async function queryLogs(filters = {}) {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters

  const conditions = []
  const params = []
  let paramIndex = 1

  if (userId) {
    conditions.push(`user_id = $${paramIndex++}`)
    params.push(userId)
  }

  if (action) {
    conditions.push(`action LIKE $${paramIndex++}`)
    params.push(action)
  }

  if (resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`)
    params.push(resourceType)
  }

  if (resourceId) {
    conditions.push(`resource_id = $${paramIndex++}`)
    params.push(resourceId)
  }

  if (startDate) {
    conditions.push(`created_at >= $${paramIndex++}`)
    params.push(startDate)
  }

  if (endDate) {
    conditions.push(`created_at <= $${paramIndex++}`)
    params.push(endDate)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const query = `
    SELECT * FROM audit_logs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `

  params.push(limit, offset)

  try {
    return await db.any(query, params)
  } catch (err) {
    logger.error({ err, filters }, '[AuditLog] Failed to query logs')
    throw err
  }
}

/**
 * Get audit logs for a specific user
 * 
 * @param {number} userId - User ID
 * @param {number} limit - Max results
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Audit log entries
 */
async function getUserLogs(userId, limit = 50, offset = 0) {
  return queryLogs({ userId, limit, offset })
}

/**
 * Get audit logs for a specific resource
 * 
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Audit log entries
 */
async function getResourceLogs(resourceType, resourceId, limit = 50) {
  return queryLogs({ resourceType, resourceId, limit })
}

/**
 * Express middleware to capture request context for audit logging
 * Adds req.auditLog() helper function
 */
function auditMiddleware(req, res, next) {
  req.auditLog = (action, resourceType, resourceId, details = {}) => {
    return logAction({
      userId: req.user?.id || null,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    })
  }

  req.auditDataChange = (action, resourceType, resourceId, before, after) => {
    return logDataChange({
      userId: req.user?.id || null,
      action,
      resourceType,
      resourceId,
      before,
      after,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    })
  }

  next()
}

/**
 * Delete old audit logs (for retention policy)
 * 
 * @param {number} retentionDays - Days to keep (default from env or 90)
 * @returns {Promise<number>} Number of deleted records
 */
async function cleanOldLogs(retentionDays = null) {
  const days = retentionDays || parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90')

  try {
    const result = await db.result(
      `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '${days} days'`
    )

    logger.info({
      deletedCount: result.rowCount,
      retentionDays: days,
    }, '[AuditLog] Cleaned old audit logs')

    return result.rowCount
  } catch (err) {
    logger.error({ err, retentionDays: days }, '[AuditLog] Failed to clean old logs')
    throw err
  }
}

module.exports = {
  logAction,
  logDataChange,
  logAuthEvent,
  logSecurityEvent,
  queryLogs,
  getUserLogs,
  getResourceLogs,
  auditMiddleware,
  cleanOldLogs,
}
