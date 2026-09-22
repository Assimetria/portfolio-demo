/**
 * CRUD Helpers
 * 
 * Reusable utilities to reduce boilerplate in CRUD API endpoints
 */

const { formatPaginatedResponse } = require('../Middleware/pagination')

/**
 * Generic list handler with pagination, search, and filtering
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.repo - Repository instance with findAll and count methods
 * @param {Object} options.req - Express request object
 * @param {Object} options.res - Express response object
 * @param {Function} options.next - Express next middleware function
 * @param {Object} options.filters - Additional filter conditions
 * @param {Object} options.defaults - Default filter values
 * @param {string} options.dataKey - Key name for data in response (default: 'data')
 * @returns {Promise<void>}
 */
async function handleList(options) {
  const {
    repo,
    req,
    res,
    next,
    filters = {},
    defaults = {},
    dataKey = 'data',
  } = options

  try {
    const pagination = req.pagination || { limit: 20, offset: 0, page: 1 }
    
    // Build query parameters
    const queryParams = {
      ...defaults,
      ...filters,
      limit: pagination.limit,
      offset: pagination.offset,
    }

    // Fetch data and count
    const [data, total] = await Promise.all([
      repo.findAll(queryParams),
      repo.count({ ...defaults, ...filters }),
    ])

    const response = formatPaginatedResponse(data, total, pagination)
    
    // Use custom data key if provided
    if (dataKey !== 'data') {
      response[dataKey] = response.data
      delete response.data
    }

    res.json(response)
  } catch (err) {
    next(err)
  }
}

/**
 * Generic get-by-ID handler
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.repo - Repository instance with findById method
 * @param {Object} options.req - Express request object
 * @param {Object} options.res - Express response object
 * @param {Function} options.next - Express next middleware function
 * @param {string} options.idParam - Name of ID parameter (default: 'id')
 * @param {string} options.dataKey - Key name for data in response (default: 'data')
 * @param {string} options.notFoundMessage - Custom not found message
 * @returns {Promise<void>}
 */
async function handleGetById(options) {
  const {
    repo,
    req,
    res,
    next,
    idParam = 'id',
    dataKey = 'data',
    notFoundMessage = 'Resource not found',
  } = options

  try {
    const id = req.params[idParam]
    const data = await repo.findById(id)

    if (!data) {
      return res.status(404).json({ message: notFoundMessage })
    }

    res.json({ [dataKey]: data })
  } catch (err) {
    next(err)
  }
}

/**
 * Generic create handler
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.repo - Repository instance with create method
 * @param {Object} options.req - Express request object
 * @param {Object} options.res - Express response object
 * @param {Function} options.next - Express next middleware function
 * @param {Function} options.transformData - Optional function to transform req.body before create
 * @param {string} options.dataKey - Key name for data in response (default: 'data')
 * @param {number} options.statusCode - HTTP status code for success (default: 201)
 * @returns {Promise<void>}
 */
async function handleCreate(options) {
  const {
    repo,
    req,
    res,
    next,
    transformData,
    dataKey = 'data',
    statusCode = 201,
  } = options

  try {
    const inputData = transformData ? await transformData(req.body, req) : req.body
    const data = await repo.create(inputData)

    res.status(statusCode).json({ [dataKey]: data })
  } catch (err) {
    next(err)
  }
}

/**
 * Generic update handler
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.repo - Repository instance with findById and update methods
 * @param {Object} options.req - Express request object
 * @param {Object} options.res - Express response object
 * @param {Function} options.next - Express next middleware function
 * @param {string} options.idParam - Name of ID parameter (default: 'id')
 * @param {Function} options.transformData - Optional function to transform req.body before update
 * @param {string} options.dataKey - Key name for data in response (default: 'data')
 * @param {string} options.notFoundMessage - Custom not found message
 * @returns {Promise<void>}
 */
async function handleUpdate(options) {
  const {
    repo,
    req,
    res,
    next,
    idParam = 'id',
    transformData,
    dataKey = 'data',
    notFoundMessage = 'Resource not found',
  } = options

  try {
    const id = req.params[idParam]
    const existing = await repo.findById(id)

    if (!existing) {
      return res.status(404).json({ message: notFoundMessage })
    }

    const inputData = transformData ? await transformData(req.body, req, existing) : req.body
    const data = await repo.update(id, inputData)

    res.json({ [dataKey]: data })
  } catch (err) {
    next(err)
  }
}

/**
 * Generic delete handler
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.repo - Repository instance with findById and delete methods
 * @param {Object} options.req - Express request object
 * @param {Object} options.res - Express response object
 * @param {Function} options.next - Express next middleware function
 * @param {string} options.idParam - Name of ID parameter (default: 'id')
 * @param {string} options.notFoundMessage - Custom not found message
 * @param {string} options.successMessage - Success message (default: 'Resource deleted')
 * @param {boolean} options.hardDelete - Perform hard delete vs soft delete (default: true)
 * @returns {Promise<void>}
 */
async function handleDelete(options) {
  const {
    repo,
    req,
    res,
    next,
    idParam = 'id',
    notFoundMessage = 'Resource not found',
    successMessage = 'Resource deleted',
    hardDelete = true,
  } = options

  try {
    const id = req.params[idParam]
    const existing = await repo.findById(id)

    if (!existing) {
      return res.status(404).json({ message: notFoundMessage })
    }

    if (hardDelete) {
      await repo.delete(id)
    } else if (repo.softDelete) {
      await repo.softDelete(id)
    } else {
      throw new Error('Soft delete requested but repo does not implement softDelete method')
    }

    res.json({ message: successMessage })
  } catch (err) {
    next(err)
  }
}

/**
 * Create a standard CRUD router for a resource
 * Automatically wires up list, get, create, update, delete endpoints
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.repo - Repository instance
 * @param {Object} options.validation - Validation schemas { list, get, create, update, delete }
 * @param {Object} options.middleware - Middleware functions { list, get, create, update, delete }
 * @param {Object} options.config - Additional configuration
 * @param {string} options.config.basePath - Base path for routes (default: '/')
 * @param {string} options.config.dataKey - Key name for data in responses
 * @param {Object} options.config.messages - Custom messages { notFound, deleted }
 * @returns {Router} Express router with CRUD endpoints
 */
function createCrudRouter(options) {
  const express = require('express')
  const router = express.Router()
  const { validate } = require('../Validation')
  const { pagination } = require('../Middleware/pagination')

  const {
    repo,
    validation = {},
    middleware = {},
    config = {},
  } = options

  const {
    basePath = '/',
    dataKey = 'data',
    messages = {},
  } = config

  const notFoundMessage = messages.notFound || 'Resource not found'
  const deletedMessage = messages.deleted || 'Resource deleted'

  // LIST endpoint
  if (repo.findAll && repo.count) {
    const listMiddleware = [
      pagination(),
      ...(middleware.list || []),
    ]
    if (validation.list) {
      listMiddleware.unshift(validate(validation.list))
    }

    router.get(basePath, ...listMiddleware, (req, res, next) => {
      handleList({ repo, req, res, next, dataKey })
    })
  }

  // GET by ID endpoint
  if (repo.findById) {
    const getMiddleware = [...(middleware.get || [])]
    if (validation.get) {
      getMiddleware.unshift(validate(validation.get))
    }

    router.get(`${basePath}/:id`, ...getMiddleware, (req, res, next) => {
      handleGetById({ repo, req, res, next, dataKey, notFoundMessage })
    })
  }

  // CREATE endpoint
  if (repo.create) {
    const createMiddleware = [...(middleware.create || [])]
    if (validation.create) {
      createMiddleware.unshift(validate(validation.create))
    }

    router.post(basePath, ...createMiddleware, (req, res, next) => {
      handleCreate({ repo, req, res, next, dataKey })
    })
  }

  // UPDATE endpoint
  if (repo.update) {
    const updateMiddleware = [...(middleware.update || [])]
    if (validation.update) {
      updateMiddleware.unshift(validate(validation.update))
    }

    router.patch(`${basePath}/:id`, ...updateMiddleware, (req, res, next) => {
      handleUpdate({ repo, req, res, next, dataKey, notFoundMessage })
    })
  }

  // DELETE endpoint
  if (repo.delete) {
    const deleteMiddleware = [...(middleware.delete || [])]
    if (validation.delete) {
      deleteMiddleware.unshift(validate(validation.delete))
    }

    router.delete(`${basePath}/:id`, ...deleteMiddleware, (req, res, next) => {
      handleDelete({
        repo,
        req,
        res,
        next,
        notFoundMessage,
        successMessage: deletedMessage,
      })
    })
  }

  return router
}

module.exports = {
  handleList,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,
  createCrudRouter,
}
