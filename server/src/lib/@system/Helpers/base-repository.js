/**
 * Base Repository Class
 * 
 * Abstract base class for repositories with common CRUD operations
 * Extend this class for specific repositories
 */

const { 
  buildInsert, 
  buildUpdate, 
  buildDelete, 
  buildSelect, 
  buildCount,
  buildBulkInsert,
} = require('./query-builder')

class BaseRepository {
  /**
   * Create a new repository
   * @param {Object} db - Database connection
   * @param {string} table - Table name
   * @param {Object} options - Options
   * @param {string} options.idColumn - Primary key column name (default: 'id')
   * @param {Array<string>} options.columns - Table columns (default: ['*'])
   */
  constructor(db, table, options = {}) {
    this.db = db
    this.table = table
    this.idColumn = options.idColumn || 'id'
    this.columns = options.columns || ['*']
  }

  /**
   * Find all records with optional filters, pagination, and sorting
   * 
   * @param {Object} params - Query parameters
   * @param {string} params.whereClause - WHERE clause
   * @param {Array} params.params - Query parameters
   * @param {string} params.orderBy - ORDER BY clause
   * @param {number} params.limit - LIMIT value
   * @param {number} params.offset - OFFSET value
   * @returns {Promise<Array>} Array of records
   */
  async findAll(params = {}) {
    const { sql, params: queryParams } = buildSelect(this.table, {
      columns: this.columns,
      whereClause: params.whereClause,
      whereParams: params.params || [],
      orderBy: params.orderBy,
      limit: params.limit,
      offset: params.offset,
    })
    
    const result = await this.db.query(sql, queryParams)
    return result.rows
  }

  /**
   * Count records with optional filters
   * 
   * @param {Object} params - Query parameters
   * @param {string} params.whereClause - WHERE clause
   * @param {Array} params.params - Query parameters
   * @returns {Promise<number>} Record count
   */
  async count(params = {}) {
    const { sql, params: queryParams } = buildCount(this.table, {
      whereClause: params.whereClause,
      whereParams: params.params || [],
    })
    
    const result = await this.db.query(sql, queryParams)
    return parseInt(result.rows[0].count, 10)
  }

  /**
   * Find a single record by ID
   * 
   * @param {string|number} id - Record ID
   * @returns {Promise<Object|null>} Record or null if not found
   */
  async findById(id) {
    const sql = `SELECT ${this.columns.join(', ')} FROM ${this.table} WHERE ${this.idColumn} = $1`
    const result = await this.db.query(sql, [id])
    return result.rows[0] || null
  }

  /**
   * Find a single record by custom criteria
   * 
   * @param {Object} criteria - Key-value pairs for WHERE clause
   * @returns {Promise<Object|null>} Record or null if not found
   */
  async findOne(criteria) {
    const columns = Object.keys(criteria)
    const values = Object.values(criteria)
    const whereClause = columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')
    
    const sql = `SELECT ${this.columns.join(', ')} FROM ${this.table} WHERE ${whereClause} LIMIT 1`
    const result = await this.db.query(sql, values)
    return result.rows[0] || null
  }

  /**
   * Find records by custom criteria
   * 
   * @param {Object} criteria - Key-value pairs for WHERE clause
   * @param {Object} options - Query options
   * @param {string} options.orderBy - ORDER BY clause
   * @param {number} options.limit - LIMIT value
   * @returns {Promise<Array>} Array of records
   */
  async findBy(criteria, options = {}) {
    const columns = Object.keys(criteria)
    const values = Object.values(criteria)
    const whereClause = columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')
    
    let sql = `SELECT ${this.columns.join(', ')} FROM ${this.table} WHERE ${whereClause}`
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`
    }
    
    if (options.limit) {
      values.push(options.limit)
      sql += ` LIMIT $${values.length}`
    }
    
    const result = await this.db.query(sql, values)
    return result.rows
  }

  /**
   * Create a new record
   * 
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
   */
  async create(data) {
    const { sql, params } = buildInsert(this.table, data, { returning: true })
    const result = await this.db.query(sql, params)
    return result.rows[0]
  }

  /**
   * Create multiple records in bulk
   * 
   * @param {Array<Object>} rows - Array of record data
   * @returns {Promise<Array>} Created records
   */
  async createMany(rows) {
    if (!rows || rows.length === 0) {
      return []
    }
    
    const { sql, params } = buildBulkInsert(this.table, rows, { returning: true })
    const result = await this.db.query(sql, params)
    return result.rows
  }

  /**
   * Update a record by ID
   * 
   * @param {string|number} id - Record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated record
   */
  async update(id, data) {
    const { sql, params } = buildUpdate(this.table, data, id, { 
      idColumn: this.idColumn,
      returning: true,
    })
    const result = await this.db.query(sql, params)
    return result.rows[0]
  }

  /**
   * Delete a record by ID (hard delete)
   * 
   * @param {string|number} id - Record ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    const { sql, params } = buildDelete(this.table, id, { 
      idColumn: this.idColumn,
      soft: false,
    })
    await this.db.query(sql, params)
  }

  /**
   * Soft delete a record by ID
   * Sets deleted_at to current timestamp
   * 
   * @param {string|number} id - Record ID
   * @returns {Promise<Object>} Soft-deleted record
   */
  async softDelete(id) {
    const { sql, params } = buildDelete(this.table, id, { 
      idColumn: this.idColumn,
      soft: true,
      returning: true,
    })
    const result = await this.db.query(sql, params)
    return result.rows[0]
  }

  /**
   * Bulk delete records by IDs
   * 
   * @param {Array<string|number>} ids - Array of record IDs
   * @returns {Promise<void>}
   */
  async bulkDelete(ids) {
    if (!ids || ids.length === 0) {
      return
    }
    
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `DELETE FROM ${this.table} WHERE ${this.idColumn} IN (${placeholders})`
    await this.db.query(sql, ids)
  }

  /**
   * Check if a record exists by ID
   * 
   * @param {string|number} id - Record ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const sql = `SELECT 1 FROM ${this.table} WHERE ${this.idColumn} = $1 LIMIT 1`
    const result = await this.db.query(sql, [id])
    return result.rows.length > 0
  }

  /**
   * Check if any records exist matching criteria
   * 
   * @param {Object} criteria - Key-value pairs for WHERE clause
   * @returns {Promise<boolean>} True if exists
   */
  async existsBy(criteria) {
    const columns = Object.keys(criteria)
    const values = Object.values(criteria)
    const whereClause = columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')
    
    const sql = `SELECT 1 FROM ${this.table} WHERE ${whereClause} LIMIT 1`
    const result = await this.db.query(sql, values)
    return result.rows.length > 0
  }

  /**
   * Execute a raw SQL query
   * Use with caution - prefer the type-safe methods above
   * 
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(sql, params = []) {
    return await this.db.query(sql, params)
  }

  /**
   * Begin a transaction
   * 
   * @returns {Promise<void>}
   */
  async beginTransaction() {
    await this.db.query('BEGIN')
  }

  /**
   * Commit a transaction
   * 
   * @returns {Promise<void>}
   */
  async commit() {
    await this.db.query('COMMIT')
  }

  /**
   * Rollback a transaction
   * 
   * @returns {Promise<void>}
   */
  async rollback() {
    await this.db.query('ROLLBACK')
  }

  /**
   * Execute function within a transaction
   * Automatically commits on success or rolls back on error
   * 
   * @param {Function} callback - Async function to execute
   * @returns {Promise<*>} Callback result
   */
  async transaction(callback) {
    await this.beginTransaction()
    try {
      const result = await callback()
      await this.commit()
      return result
    } catch (error) {
      await this.rollback()
      throw error
    }
  }
}

module.exports = BaseRepository
