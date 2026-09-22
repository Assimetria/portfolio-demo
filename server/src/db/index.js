// Database connection re-export
// Provides a central import point for database access across repos

const db = require('../lib/@system/PostgreSQL')

module.exports = { db }
