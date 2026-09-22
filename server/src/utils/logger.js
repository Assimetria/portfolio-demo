// Structured application logger
// - Development: colorized, human-readable output via pino-pretty
// - Production:  JSON to stdout (ingested by log aggregator / Railway logs)
// - Test:        silent
//
// Usage:
//   const logger = require('../utils/logger')
//   logger.info('server started')
//   logger.warn({ userId }, 'rate limit reached')
//   logger.error({ err }, 'operation failed')
//   const childLog = logger.child({ module: 'billing' })

const pino = require('pino')

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const logger = pino(
  process.env.NODE_ENV === 'test'
    ? { level: 'silent' }
    : process.env.NODE_ENV === 'production'
      ? {
          level,
          base: {
            service: process.env.SERVICE_NAME ?? 'server',
            env: 'production',
          },
        }
      : {
          level,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        },
)

module.exports = logger
