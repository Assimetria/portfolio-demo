// @system — structured logger (pino)
// Usage: const logger = require('../lib/@system/Logger')
//        logger.info('something happened')
//        logger.error({ err }, 'request failed')

const pino = require('pino')

const isDev = process.env.NODE_ENV !== 'production'

const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  base: {
    service: process.env.SERVICE_NAME ?? 'server',
    env: process.env.NODE_ENV ?? 'development',
  },
})

module.exports = logger
