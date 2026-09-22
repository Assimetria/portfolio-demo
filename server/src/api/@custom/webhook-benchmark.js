// @custom — Benchmark webhook delivery strategies
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
//   errorRate — simulated error rate 0-1 (default 0)
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
async function benchmarkConcurrent(numWebhooks, latencyMs, errorRate, round) {
  const endpoints = Array.from({ length: numWebhooks }, (_, i) => ({ endpointId: i + 1 }))
  const startTime = Date.now()
  const deliveries = endpoints.map((ep) => simulateDelivery({ latencyMs, errorRate, endpointId: ep.endpointId }))
  const results = await Promise.allSettled(deliveries)
  const totalDurationMs = Date.now() - startTime
  const latencies = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.durationMs)
  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
  return buildStrategyResult('concurrent', numWebhooks, latencies, successCount, totalDurationMs, round)
}

async function benchmarkSequential(numWebhooks, latencyMs, errorRate, round) {
  const latencies = []
  let successCount = 0
  const startTime = Date.now()
  for (let i = 0; i < numWebhooks; i++) {
    const result = await simulateDelivery({ latencyMs, errorRate, endpointId: i + 1 })
    latencies.push(result.durationMs)
    if (result.success) successCount++
  }
  const totalDurationMs = Date.now() - startTime
  return buildStrategyResult('sequential', numWebhooks, latencies, successCount, totalDurationMs, round)
}

async function benchmarkBatched(numWebhooks, latencyMs, errorRate, round, batchSize = 3) {
  const latencies = []
  let successCount = 0
  const startTime = Date.now()
  for (let i = 0; i < numWebhooks; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, numWebhooks - i) }, (_, j) => ({ endpointId: i + j + 1 }))
    const deliveries = batch.map((ep) => simulateDelivery({ latencyMs, errorRate, endpointId: ep.endpointId }))
    const results = await Promise.allSettled(deliveries)
    results.filter((r) => r.status === 'fulfilled').forEach((r) => latencies.push(r.value.durationMs))
    successCount += results.filter((r) => r.status === 'fulfilled' && r.value.success).length
  }
  const totalDurationMs = Date.now() - startTime
  return buildStrategyResult('batched', numWebhooks, latencies, successCount, totalDurationMs, round)
}

function buildStrategyResult(strategy, totalRequests, latencies, successCount, totalDurationMs, round) {
  const sorted = [...latencies].sort((a, b) => a - b)
  const len = sorted.length
  const avgLatencyMs = len > 0 ? sorted.reduce((sum, v) => sum + v, 0) / len : 0
  const p50 = percentile(sorted, 50)
  const p95 = percentile(sorted, 95)
  const p99 = percentile(sorted, 99)
  const throughput = totalDurationMs > 0 ? (totalRequests / totalDurationMs) * 1000 : 0
  return {
    strategy,
    round,
    totalRequests,
    totalDurationMs: Math.round(totalDurationMs),
    avgLatencyMs: Math.round(avgLatencyMs),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
    throughput: Math.round(throughput * 100) / 100,
    successCount,
    failedCount: totalRequests - successCount,
    successRate: totalRequests > 0 ? Math.round((successCount / totalRequests) * 10000) / 100 : 0,
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const low = Math.floor(idx)
  const high = Math.ceil(idx)
  if (low === high) return sorted[low]
  const frac = idx - low
  return Math.round(sorted[low] + (sorted[high] - sorted[low]) * frac)
}

router.get('/webhook-benchmark', authenticate, async (req, res, next) => {
  try {
    const rounds = Math.min(Math.max(parseInt(req.query.rounds, 10) || 3, 1), 10)
    const numWebhooks = Math.min(Math.max(parseInt(req.query.webhooks, 10) || 5, 1), 20)
    const latencyMs = Math.min(Math.max(parseInt(req.query.latencyMs, 10) || 50, 1), 500)
    const errorRate = Math.min(Math.max(parseFloat(req.query.errorRate) || 0, 0), 1)

    logger.info(
      { rounds, numWebhooks, latencyMs, errorRate, userId: req.user?.id },
      '[webhook-benchmark] starting benchmark'
    )

    const allResults = []

    for (let r = 1; r <= rounds; r++) {
      const concurrent = await benchmarkConcurrent(numWebhooks, latencyMs, errorRate, r)
      const sequential = await benchmarkSequential(numWebhooks, latencyMs, errorRate, r)
      const batched = await benchmarkBatched(numWebhooks, latencyMs, errorRate, r)
      allResults.push(concurrent, sequential, batched)
    }

    const strategyNames = ['concurrent', 'sequential', 'batched']
    const summary = {}

    for (const name of strategyNames) {
      const roundsData = allResults.filter((r) => r.strategy === name)
      summary[name] = {
        avgTotalDurationMs: Math.round(roundsData.reduce((s, r) => s + r.totalDurationMs, 0) / roundsData.length),
        avgLatencyMs: Math.round(roundsData.reduce((s, r) => s + r.avgLatencyMs, 0) / roundsData.length),
        avgThroughput: Math.round(roundsData.reduce((s, r) => s + r.throughput, 0) / roundsData.length * 100) / 100,
        avgSuccessRate: Math.round(roundsData.reduce((s, r) => s + r.successRate, 0) / roundsData.length * 100) / 100,
        rounds: roundsData.length,
      }
    }

    res.json({
      ok: true,
      config: { rounds, numWebhooks, latencyMs, errorRate },
      strategies: allResults,
      summary,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
