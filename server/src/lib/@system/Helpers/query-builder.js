/**
 * Query Builder Helpers
 * 
 * Utilities for building SQL queries with proper parameterization
 */

/**
 * Build INSERT query
 * 
 * @param {string} table - Table name
 * @param {Object} data - Data object with column names as keys
 * @param {Object} options - Options
 * @param {boolean} options.returning - Return inserted row (default: true)
 * @returns {Object} SQL query and parameters
 */
function buildInsert(table, data, options = {}) {
  const { returning = true } = options
  
  const columns = Object.keys(data)
  const values = Object.values(data)
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
  
  let sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
  `
  
  if (returning) {
    sql += ' RETURNING *'
  }
  
  return {
    sql: sql.trim(),
    params: values,
  }
}

/**
 * Build UPDATE query
 * 
 * @param {string} table - Table name
 * @param {Object} data - Data object with column names as keys
 * @param {string|number} id - ID of row to update
 * @param {Object} options - Options
 * @param {string} options.idColumn - Name of ID column (default: 'id')
 * @param {boolean} options.returning - Return updated row (default: true)
 * @returns {Object} SQL query and parameters
 */
function buildUpdate(table, data, id, options = {}) {
  const { idColumn = 'id', returning = true } = options
  
  const columns = Object.keys(data)
  const values = Object.values(data)
  
  const setClause = columns
    .map((col, i) => `${col} = $${i + 1}`)
    .join(', ')
  
  let sql = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${idColumn} = $${columns.length + 1}
  `
  
  if (returning) {
    sql += ' RETURNING *'
  }
  
  return {
    sql: sql.trim(),
    params: [...values, id],
  }
}

/**
 * Build DELETE query
 * 
 * @param {string} table - Table name
 * @param {string|number} id - ID of row to delete
 * @param {Object} options - Options
 * @param {string} options.idColumn - Name of ID column (default: 'id')
 * @param {boolean} options.soft - Soft delete (set deleted_at) instead of hard delete
 * @param {boolean} options.returning - Return deleted row (default: false)
 * @returns {Object} SQL query and parameters
 */
function buildDelete(table, id, options = {}) {
  const { idColumn = 'id', soft = false, returning = false } = options
  
  let sql
  if (soft) {
    sql = `
      UPDATE ${table}
      SET deleted_at = NOW()
      WHERE ${idColumn} = $1
    `
  } else {
    sql = `
      DELETE FROM ${table}
      WHERE ${idColumn} = $1
    `
  }
  
  if (returning) {
    sql += ' RETURNING *'
  }
  
  return {
    sql: sql.trim(),
    params: [id],
  }
}

/**
 * Build SELECT query with pagination and filters
 * 
 * @param {string} table - Table name
 * @param {Object} options - Query options
 * @param {Array<string>} options.columns - Columns to select (default: ['*'])
 * @param {string} options.whereClause - WHERE clause (without 'WHERE' keyword)
 * @param {Array} options.whereParams - Parameters for WHERE clause
 * @param {string} options.orderBy - ORDER BY clause (without 'ORDER BY' keyword)
 * @param {number} options.limit - LIMIT value
 * @param {number} options.offset - OFFSET value
 * @param {Array<string>} options.joins - JOIN clauses
 * @returns {Object} SQL query and parameters
 */
function buildSelect(table, options = {}) {
  const {
    columns = ['*'],
    whereClause = '',
    whereParams = [],
    orderBy = '',
    limit = null,
    offset = null,
    joins = [],
  } = options
  
  let sql = `SELECT ${columns.join(', ')} FROM ${table}`
  
  if (joins.length > 0) {
    sql += ' ' + joins.join(' ')
  }
  
  if (whereClause) {
    sql += ` WHERE ${whereClause}`
  }
  
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`
  }
  
  const params = [...whereParams]
  
  if (limit !== null && limit > 0) {
    params.push(limit)
    sql += ` LIMIT $${params.length}`
  }
  
  if (offset !== null && offset > 0) {
    params.push(offset)
    sql += ` OFFSET $${params.length}`
  }
  
  return {
    sql: sql.trim(),
    params,
  }
}

/**
 * Build COUNT query
 * 
 * @param {string} table - Table name
 * @param {Object} options - Query options
 * @param {string} options.whereClause - WHERE clause (without 'WHERE' keyword)
 * @param {Array} options.whereParams - Parameters for WHERE clause
 * @param {string} options.column - Column to count (default: '*')
 * @param {boolean} options.distinct - Use COUNT DISTINCT (default: false)
 * @returns {Object} SQL query and parameters
 */
function buildCount(table, options = {}) {
  const {
    whereClause = '',
    whereParams = [],
    column = '*',
    distinct = false,
  } = options
  
  const countExpr = distinct ? `DISTINCT ${column}` : column
  let sql = `SELECT COUNT(${countExpr}) as count FROM ${table}`
  
  if (whereClause) {
    sql += ` WHERE ${whereClause}`
  }
  
  return {
    sql: sql.trim(),
    params: whereParams,
  }
}

/**
 * Build bulk INSERT query
 * 
 * @param {string} table - Table name
 * @param {Array<Object>} rows - Array of data objects
 * @param {Object} options - Options
 * @param {boolean} options.returning - Return inserted rows (default: true)
 * @returns {Object} SQL query and parameters
 */
function buildBulkInsert(table, rows, options = {}) {
  const { returning = true } = options
  
  if (!rows || rows.length === 0) {
    throw new Error('Cannot build bulk insert with empty rows')
  }
  
  const columns = Object.keys(rows[0])
  const values = []
  const placeholders = []
  
  rows.forEach((row, rowIndex) => {
    const rowPlaceholders = columns.map((col, colIndex) => {
      const paramIndex = rowIndex * columns.length + colIndex + 1
      values.push(row[col])
      return `$${paramIndex}`
    })
    placeholders.push(`(${rowPlaceholders.join(', ')})`)
  })
  
  let sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${placeholders.join(', ')}
  `
  
  if (returning) {
    sql += ' RETURNING *'
  }
  
  return {
    sql: sql.trim(),
    params: values,
  }
}

/**
 * Escape identifier (table/column names)
 * Prevents SQL injection in dynamic identifiers
 * 
 * @param {string} identifier - Table or column name
 * @returns {string} Escaped identifier
 */
function escapeIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * Build UPSERT query (INSERT ... ON CONFLICT)
 * 
 * @param {string} table - Table name
 * @param {Object} data - Data object
 * @param {string|Array<string>} conflictColumns - Column(s) that define uniqueness
 * @param {Object} updateData - Data to update on conflict (default: same as data)
 * @param {Object} options - Options
 * @param {boolean} options.returning - Return row (default: true)
 * @returns {Object} SQL query and parameters
 */
function buildUpsert(table, data, conflictColumns, updateData = null, options = {}) {
  const { returning = true } = options
  
  const columns = Object.keys(data)
  const values = Object.values(data)
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
  
  const conflict = Array.isArray(conflictColumns)
    ? conflictColumns.join(', ')
    : conflictColumns
  
  const updateFields = updateData || data
  const updateColumns = Object.keys(updateFields)
  const updateParams = Object.values(updateFields)
  
  const updateClause = updateColumns
    .map((col, i) => `${col} = $${values.length + i + 1}`)
    .join(', ')
  
  let sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${conflict})
    DO UPDATE SET ${updateClause}
  `
  
  if (returning) {
    sql += ' RETURNING *'
  }
  
  return {
    sql: sql.trim(),
    params: [...values, ...updateParams],
  }
}

module.exports = {
  buildInsert,
  buildUpdate,
  buildDelete,
  buildSelect,
  buildCount,
  buildBulkInsert,
  buildUpsert,
  escapeIdentifier,
}
