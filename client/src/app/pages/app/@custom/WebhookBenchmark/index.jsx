// @custom — Webhook Benchmark page
// Provides an interactive UI for benchmarking webhook delivery strategies:
//   - concurrent  : all webhooks dispatched in parallel
//   - sequential  : webhooks dispatched one at a time
//   - batched     : webhooks grouped into batches
//
// Features:
//   - Configurable benchmark parameters (rounds, webhooks, latency, error rate)
//   - Results table with per-strategy performance metrics
//   - Summary card showing the best-performing strategy

import { useState, useCallback } from 'react'
import {
  Play,
  AlertCircle,
  Loader2,
  BarChart3,
  Settings2,
} from 'lucide-react'
import { DashboardLayout } from '@/app/components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/@system/ui/card'
import { Button } from '@/app/components/@system/ui/button'
import { Input } from '@/app/components/@system/ui/input'
import { Label } from '@/app/components/@system/ui/label'
import { Badge } from '@/app/components/@system/ui/badge'
import { Skeleton } from '@/app/components/@system/ui/skeleton'
import { api } from '@/app/lib/@system/api'
// ─── API helpers ───────────────────────────────────────────────────────────

async function runBenchmark(params) {
  return api.get('/webhook-benchmark', { params })
}

function strategyBadgeVariant(strategy) {
  switch (strategy) {
    case 'concurrent': return 'default'
    case 'sequential': return 'secondary'
    case 'batched':    return 'outline'
    default:           return 'outline'
  }
}

function formatDuration(ms) {
  return `${Math.round(ms)} ms`
}

function formatThroughput(tp) {
  return `${tp.toLocaleString()} req/s`
}

// ─── Strategy Comparison Card ─────────────────────────────────────────────

function StrategyComparisonCard({ strategies, summary }) {
  if (!strategies || strategies.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
          Benchmark Results
        </CardTitle>
        <CardDescription>
          Performance comparison across all dispatch strategies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 pr-4 font-medium">Strategy</th>
                <th className="pb-3 pr-4 font-medium">Round</th>
                <th className="pb-3 pr-4 font-medium text-right">Avg Latency</th>
                <th className="pb-3 pr-4 font-medium text-right">P50</th>
                <th className="pb-3 pr-4 font-medium text-right">P95</th>
                <th className="pb-3 pr-4 font-medium text-right">P99</th>
                <th className="pb-3 pr-4 font-medium text-right">Throughput</th>
                <th className="pb-3 pr-4 font-medium text-right">Success Rate</th>
                <th className="pb-3 pr-4 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <Badge variant={strategyBadgeVariant(s.strategy)}>
                      {s.strategy}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-brand-text-muted">#{s.round}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">{formatDuration(s.avgLatencyMs)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">{formatDuration(s.p50LatencyMs)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">{formatDuration(s.p95LatencyMs)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">{formatDuration(s.p99LatencyMs)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">{formatThroughput(s.throughput)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">
                    <span className={s.successRate === 100 ? 'text-green-500' : s.successRate > 80 ? 'text-amber-500' : 'text-red-500'}>
                      {s.successRate}%
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">{formatDuration(s.totalDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {summary && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Object.entries(summary).map(([name, data]) => (
              <div key={name} className="rounded-lg border p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">{name}</p>
                <p className="mt-1 text-lg font-bold">{formatDuration(data.avgTotalDurationMs)}</p>
                <p className="text-xs text-brand-text-muted">
                  {formatThroughput(data.avgThroughput)} avg &middot; {data.avgSuccessRate}% success
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ─── Benchmark Form ──────────────────────────────────────────────────────

function BenchmarkForm({ onRun, loading }) {
  const [rounds, setRounds] = useState('3')
  const [webhooks, setWebhooks] = useState('5')
  const [latencyMs, setLatencyMs] = useState('50')
  const [errorRate, setErrorRate] = useState('0')

  const handleSubmit = (e) => {
    e.preventDefault()
    onRun({
      rounds: parseInt(rounds, 10) || 3,
      webhooks: parseInt(webhooks, 10) || 5,
      latencyMs: parseInt(latencyMs, 10) || 50,
      errorRate: parseFloat(errorRate) || 0,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" aria-hidden="true" />
          Benchmark Configuration
        </CardTitle>
        <CardDescription>
          Configure the webhook benchmark parameters and run the test.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="rounds">Rounds</Label>
              <Input
                id="rounds"
                type="number"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
              />
              <p className="text-xs text-brand-text-muted">1–10</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhooks">Webhook Endpoints</Label>
              <Input
                id="webhooks"
                type="number"
                min={1}
                max={20}
                value={webhooks}
                onChange={(e) => setWebhooks(e.target.value)}
              />
              <p className="text-xs text-brand-text-muted">1–20</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="latencyMs">Latency (ms)</Label>
              <Input
                id="latencyMs"
                type="number"
                min={1}
                max={500}
                value={latencyMs}
                onChange={(e) => setLatencyMs(e.target.value)}
              />
              <p className="text-xs text-brand-text-muted">1–500</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="errorRate">Error Rate</Label>
              <Input
                id="errorRate"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={errorRate}
                onChange={(e) => setErrorRate(e.target.value)}
              />
              <p className="text-xs text-brand-text-muted">0–1 (0%–100%)</p>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Running Benchmark...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                Run Benchmark
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Main Page Component ─────────────────────────────────────────────────

export function WebhookBenchmark() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleRun = useCallback(async (params) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await runBenchmark(params)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark failed')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto max-w-6xl space-y-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Webhook Benchmark</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Performance comparison of webhook dispatch strategies. Configure benchmark parameters
              below and run tests to see how concurrent, sequential, and batched delivery compare.
            </p>
          </header>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-red-500">Benchmark Error</p>
                <p className="text-sm text-brand-text-muted">{error}</p>
              </div>
            </div>
          )}

          <BenchmarkForm onRun={handleRun} loading={loading} />

          {loading && (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          )}

          {result && (
            <StrategyComparisonCard
              strategies={result.strategies}
              summary={result.summary}
            />
          )}
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

export default WebhookBenchmark