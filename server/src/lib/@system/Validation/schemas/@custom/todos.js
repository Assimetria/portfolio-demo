// @custom — zod request schemas for api/@custom/todos-example.js
// Reference schemas agents copy for new resources: create/update bodies,
// integer id params and a whitelisted list-query schema.

const { z } = require('zod')

const PRIORITIES = ['low', 'medium', 'high']
const SORTABLE = ['title', 'priority', 'created_at', 'updated_at']

const CreateTodoBody = z.object({
  title: z.string().trim().min(1, 'title is required').max(200, 'title must be at most 200 characters'),
  description: z.string().trim().max(1000, 'description must be at most 1000 characters').optional(),
  priority: z.enum(PRIORITIES).optional(),
})

const UpdateTodoBody = z
  .object({
    title: z.string().trim().min(1, 'title cannot be empty').max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    completed: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'at least one field must be provided' })

const TodoIdParams = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
})

// Query params are validated (and unknown keys stripped) before they reach the
// SQL builders; sort/order are additionally whitelisted by buildOrderByClause.
const ListTodosQuery = z.object({
  q: z.string().trim().max(200).optional(),
  priority: z.enum(PRIORITIES).optional(),
  completed: z.enum(['true', 'false']).optional(),
  sort: z.enum(SORTABLE).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

module.exports = { PRIORITIES, SORTABLE, CreateTodoBody, UpdateTodoBody, TodoIdParams, ListTodosQuery }
