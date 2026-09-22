#!/usr/bin/env python3
"""Write the webhook-benchmark server file."""
import os

content = r"""// @custom — Benchmark webhook delivery strategies
// Provides endpoints for comparing webhook dispatch approaches:
//   - concurrent  : all webhooks dispatched in parallel
//   - sequential  : webhooks dispatched one at a time
//   - batched     : webhooks grouped into batches
//
// GET /api/webhook-benchmark — Run benchmarks and return performance metrics
// Query params:
//   rounds    — number of benchmark rounds (default 3, max 10)
//   webhooks  — number of simulated webhook endpoints (default 5, max 20)
//   latencyMs — simulated endpoint latency in ms (default 50, max 500)
//   errorRate — simulated error rate 0–1 (default 0)
// Response:
//   { ok: true, strategies: [...], summary: { ... } }

'use strict'

const express = require('express')
const router = express.Router()
const { authenticate } = require('../../lib/@system/Helpers/auth')
const logger = require('../../lib/@system/Logger')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function simulateDelivery({ latencyMs, errorRate, endpointId }) {
  const startTime = Date.now()
  const jitter = latencyMs * (0.75 + Math.random() * 0.5)
  await sleep(jitter)
  const durationMs = Date.now() - startTime
  const isError = Math.random() < errorRate
  const status = isError ? 500 : 200
  return { endpointId, status, durationMs, success: !isError }
}
"""

with open('/workspace/task-1061848/server/src/api/@custom/webhook-benchmark.js', 'w') as f:
    f.write(content)
print('Part 1 written')
"""