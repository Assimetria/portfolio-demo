// @system — AI/LLM adapters index
// Single import point for all LLM providers.
//
// Usage:
//   const { openai, anthropic } = require('../lib/@system/AI')
//   const { openai } = require('../lib/@system/AI')

const openai = require('./OpenAI')
const anthropic = require('./Anthropic')

module.exports = { openai, anthropic }
