// @system — Notification message templates
// Pre-formatted notification templates for common scenarios.
// Each export is a function that accepts template-specific variables and returns
// a structured notification object suitable for passing to NotificationAdapter.send().
//
// Design: Concise, scannable messages optimized for Slack/Discord/Console output.

'use strict'

// ── Shared helpers ────────────────────────────────────────────────────────────

function appName() {
  return process.env.APP_NAME ?? 'App'
}

function formatMetadata(obj) {
  if (!obj || Object.keys(obj).length === 0) return undefined
  return obj
}

// ── Templates ─────────────────────────────────────────────────────────────────

/**
 * User signup notification.
 * @param {{ email: string, name?: string, userId?: string, source?: string }} opts
 */
function signup({ email, name, userId, source }) {
  const displayName = name ? `${name} (${email})` : email
  
  return {
    title: '🎉 New User Signup',
    body: `**${displayName}** just signed up${source ? ` via ${source}` : ''}`,
    level: 'info',
    metadata: formatMetadata({
      'User ID': userId,
      'Email': email,
      'Name': name || 'Not provided',
      'Source': source || 'Direct',
    }),
  }
}

/**
 * Payment received notification.
 * @param {{ amount: number, currency: string, email: string, name?: string, plan?: string }} opts
 */
function paymentReceived({ amount, currency = 'USD', email, name, plan }) {
  const displayName = name ? `${name} (${email})` : email
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100) // assuming amount is in cents

  return {
    title: '💰 Payment Received',
    body: `${formattedAmount} from **${displayName}**${plan ? ` for ${plan}` : ''}`,
    level: 'info',
    metadata: formatMetadata({
      'Amount': formattedAmount,
      'Email': email,
      'Name': name || 'Not provided',
      'Plan': plan,
    }),
  }
}

/**
 * Payment failed notification.
 * @param {{ email: string, name?: string, reason?: string, amount?: number, currency?: string }} opts
 */
function paymentFailed({ email, name, reason, amount, currency = 'USD' }) {
  const displayName = name ? `${name} (${email})` : email
  const formattedAmount = amount
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
    : 'Unknown'

  return {
    title: '⚠️ Payment Failed',
    body: `Payment from **${displayName}** failed${reason ? `: ${reason}` : ''}`,
    level: 'warning',
    metadata: formatMetadata({
      'Email': email,
      'Name': name || 'Not provided',
      'Amount': formattedAmount,
      'Reason': reason || 'Unknown',
    }),
  }
}

/**
 * Critical error notification.
 * @param {{ error: string, service?: string, userId?: string, context?: object }} opts
 */
function criticalError({ error, service, userId, context }) {
  return {
    title: '🚨 Critical Error',
    body: `**${service || appName()}** encountered an error: ${error}`,
    level: 'error',
    metadata: formatMetadata({
      'Service': service || appName(),
      'Error': error,
      'User ID': userId,
      ...context,
    }),
  }
}

/**
 * System health warning notification.
 * @param {{ metric: string, value: string, threshold?: string, details?: string }} opts
 */
function healthWarning({ metric, value, threshold, details }) {
  return {
    title: '⚠️ System Health Warning',
    body: `**${metric}** is at ${value}${threshold ? ` (threshold: ${threshold})` : ''}`,
    level: 'warning',
    metadata: formatMetadata({
      'Metric': metric,
      'Current Value': value,
      'Threshold': threshold,
      'Details': details,
    }),
  }
}

/**
 * Deployment notification.
 * @param {{ version: string, environment: string, deployer?: string, status: 'started' | 'completed' | 'failed' }} opts
 */
function deployment({ version, environment, deployer, status }) {
  const emoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🚀'
  const statusText = status.charAt(0).toUpperCase() + status.slice(1)

  return {
    title: `${emoji} Deployment ${statusText}`,
    body: `Version **${version}** ${status} on **${environment}**${deployer ? ` by ${deployer}` : ''}`,
    level: status === 'failed' ? 'error' : 'info',
    metadata: formatMetadata({
      'Version': version,
      'Environment': environment,
      'Status': statusText,
      'Deployer': deployer,
    }),
  }
}

/**
 * Background job notification.
 * @param {{ jobName: string, status: 'started' | 'completed' | 'failed', duration?: number, error?: string }} opts
 */
function backgroundJob({ jobName, status, duration, error }) {
  const emoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⚙️'
  const statusText = status.charAt(0).toUpperCase() + status.slice(1)
  const durationText = duration ? ` in ${(duration / 1000).toFixed(2)}s` : ''

  return {
    title: `${emoji} Background Job ${statusText}`,
    body: `**${jobName}** ${status}${durationText}${error ? `: ${error}` : ''}`,
    level: status === 'failed' ? 'error' : 'info',
    metadata: formatMetadata({
      'Job': jobName,
      'Status': statusText,
      'Duration': duration ? `${(duration / 1000).toFixed(2)}s` : undefined,
      'Error': error,
    }),
  }
}

/**
 * Rate limit exceeded notification.
 * @param {{ identifier: string, endpoint?: string, limit: number, window?: string }} opts
 */
function rateLimitExceeded({ identifier, endpoint, limit, window }) {
  return {
    title: '🚦 Rate Limit Exceeded',
    body: `**${identifier}** exceeded rate limit${endpoint ? ` on ${endpoint}` : ''} (${limit} requests${window ? `/${window}` : ''})`,
    level: 'warning',
    metadata: formatMetadata({
      'Identifier': identifier,
      'Endpoint': endpoint,
      'Limit': `${limit} requests${window ? `/${window}` : ''}`,
    }),
  }
}

/**
 * Security alert notification.
 * @param {{ type: string, details: string, userId?: string, ip?: string, severity?: 'low' | 'medium' | 'high' | 'critical' }} opts
 */
function securityAlert({ type, details, userId, ip, severity = 'medium' }) {
  const emoji = severity === 'critical' || severity === 'high' ? '🚨' : '⚠️'
  const level = severity === 'critical' || severity === 'high' ? 'error' : 'warning'

  return {
    title: `${emoji} Security Alert: ${type}`,
    body: `**${type}**: ${details}`,
    level,
    metadata: formatMetadata({
      'Type': type,
      'Severity': severity.toUpperCase(),
      'User ID': userId,
      'IP Address': ip,
      'Details': details,
    }),
  }
}

/**
 * Generic info notification.
 * @param {{ title: string, body: string, metadata?: object }} opts
 */
function info({ title, body, metadata }) {
  return {
    title,
    body,
    level: 'info',
    metadata: formatMetadata(metadata),
  }
}

module.exports = {
  signup,
  paymentReceived,
  paymentFailed,
  criticalError,
  healthWarning,
  deployment,
  backgroundJob,
  rateLimitExceeded,
  securityAlert,
  info,
}
