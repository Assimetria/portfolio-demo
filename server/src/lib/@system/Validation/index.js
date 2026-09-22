// Zod-based request validation middleware factory
// Usage:
//   const { validate } = require('../../../lib/@system/Validation')
//   router.post('/foo', validate({ body: FooSchema }), handler)
//
// Validates req.body, req.query, and/or req.params against Zod schemas.
// On failure returns HTTP 400 with a structured error list.
// On success, replaces the validated object with the parsed (coerced) value.

const { ZodError } = require('zod')

/**
 * @param {{ body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }} schemas
 * @returns {import('express').RequestHandler}
 */
function validate(schemas) {
  return (req, res, next) => {
    const errors = []

    for (const [source, schema] of Object.entries(schemas)) {
      if (!schema) continue
      const result = schema.safeParse(req[source])
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: [source, ...issue.path].join('.'),
            message: issue.message,
          })
        }
      } else {
        // Replace with parsed/coerced values (e.g. string → number coercion)
        req[source] = result.data
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors })
    }

    next()
  }
}

module.exports = { validate }
