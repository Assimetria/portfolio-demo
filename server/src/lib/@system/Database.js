// Database.js — Compatibility wrapper for PostgreSQL module
//
// This file provides a unified Database export that wraps the PostgreSQL module.
// It exists to maintain backward compatibility and provide a cleaner import path
// for code that doesn't need to know the specific database technology.

const db = require('./PostgreSQL')

module.exports = { 
  db,
  // Re-export lifecycle methods for convenience
  connectPool: db.connectPool,
  disconnectPool: db.disconnectPool,
  pgp: db.pgp,
}
