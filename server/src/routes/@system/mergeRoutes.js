// @system — Server-side route merging: @custom Express routes override @system
const express = require('express')

function mergeRoutes(systemRouter, customRouter) {
  const merged = express.Router()
  if (customRouter) merged.use(customRouter)
  if (systemRouter) merged.use(systemRouter)
  return merged
}

module.exports = { mergeRoutes }
