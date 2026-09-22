'use strict'
const fs = require('fs')
const path = require('path')
exports.up = async (db) => {
  const sql = fs.readFileSync(path.join(__dirname, '../../schemas/@system/blog_posts.sql'), 'utf8')
  await db.none(sql)
  console.log('[023_blog_posts] applied schema: blog_posts')
}
exports.down = async (db) => {
  await db.none('DROP TABLE IF EXISTS blog_posts CASCADE')
  console.log('[023_blog_posts] rolled back blog_posts')
}
