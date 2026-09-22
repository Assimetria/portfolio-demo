'use strict'
const BaseTask = require('../base/BaseTask')
const logger = require('../../../../lib/@system/Logger')
const db = require('../../../../lib/@system/PostgreSQL')

class DailyArticlePublishingTask extends BaseTask {
  constructor() { super('daily_article_publishing', false, { module: 'blog' }) }
  getSchedule() { return '0 1 * * *' } // Daily 1 AM

  async execute() {
    const stats = { total: 0, published: 0, failed: 0 }
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    const articles = await db.query(
      `UPDATE blog_posts SET status = 'published', published_at = NOW()
       WHERE status = 'scheduled' AND publish_date <= $1
       RETURNING id, title`,
      [today]
    )
    stats.total = articles?.rows?.length || 0
    stats.published = stats.total
    logger.info({ stats }, '[scheduler] daily article publishing done')
    return stats
  }
}

module.exports = DailyArticlePublishingTask
