// @custom — Push Notifications Lambda Management Page ([SV4-172])
// Provides a dashboard view of the push notification Lambda processor
// and allows triggering a processing batch.
import { useState, useEffect, useCallback } from 'react'
import { Bell, Send, RefreshCw, Activity, AlertCircle, CheckCircle2 } from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/ui/card'
import { Button } from '../../../../components/@system/ui/button'
import { Separator } from '../../../../components/@system/ui/separator'
import { Input } from '../../../../components/@system/ui/input'
import { getPushNotificationStatus, triggerPushNotificationProcess } from '../../../api/@custom'

export function PushNotificationsPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [batchSize, setBatchSize] = useState(100)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPushNotificationStatus()
      setStatus(data)
    } catch (err) {
      setError(err.message || 'Failed to fetch processor status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function handleProcess() {
    setProcessing(true)
    setResult(null)
    setError(null)
    try {
      const data = await triggerPushNotificationProcess({ batchSize })
      setResult(data)
      await fetchStatus()
    } catch (err) {
      setError(err.message || 'Failed to trigger processing')
    } finally {
      setProcessing(false)
    }
  }

  const statusColor = status?.status === 'ready'
    ? 'bg-green-500'
    : status?.status === 'processing'
      ? 'bg-yellow-500'
      : 'bg-gray-500'

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto w-full max-w-4xl">
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-[var(--brand-primary)]" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Push Notifications</h1>
                <p className="mt-1 text-sm text-[var(--brand-text-muted)]">
                  Lambda processor for push notification delivery and management.
                </p>
              </div>
            </div>
          </header>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Processor Status
                    </CardTitle>
                    <CardDescription>
                      Current state of the push notification Lambda processor.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
                    <RefreshCw className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <Separator />
<Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Trigger Processing
                </CardTitle>
                <CardDescription>
                  Manually invoke the Lambda processor.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label htmlFor="batch-size" className="mb-1.5 block text-sm font-medium">
                    Batch Size
                  </label>
                  <Input
                    id="batch-size"
                    type="number"
                    min={1}
                    max={10000}
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value) || 100)}
                  />
                </div>
                <Button onClick={handleProcess} disabled={processing} className="w-full">
                  {processing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Process Batch
                    </>
                  )}
                </Button>

                {result && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm space-y-1">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Batch Complete</span>
                    </div>
                    <p className="text-[var(--brand-text-muted)]">
                      Processed: <span className="text-green-400">{result.processed}</span>
                      {' | '}Failed: <span className="text-red-400">{result.failed}</span>
                      {' | '}Size: {result.batchSize}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {status && (status.totalProcessed > 0 || status.failedCount > 0) && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Processing Summary</CardTitle>
                <CardDescription>
                  Aggregate metrics for the push notification Lambda processor.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--brand-border-subtle)] p-4">
                    <p className="text-xs text-[var(--brand-text-muted)]">Success Rate</p>
                    <p className="mt-1 text-xl font-bold text-green-400">
                      {status.totalProcessed > 0
                        ? `${Math.round(((status.totalProcessed - status.failedCount) / status.totalProcessed) * 100)}%`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--brand-border-subtle)] p-4">
                    <p className="text-xs text-[var(--brand-text-muted)]">Total Batches</p>
                    <p className="mt-1 text-xl font-bold">{Math.ceil(status.totalProcessed / 100)}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--brand-border-subtle)] p-4">
                    <p className="text-xs text-[var(--brand-text-muted)]">Error Rate</p>
                    <p className="mt-1 text-xl font-bold text-red-400">
                      {status.totalProcessed > 0
                        ? `${((status.failedCount / status.totalProcessed) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

export default PushNotificationsPage
              <CardContent className="pt-6">
                {loading && !status ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-[var(--brand-text-muted)]" />
                  </div>
                ) : status ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-3 w-3 rounded-full ${statusColor}`} />
                      <span className="text-sm font-medium capitalize">{status.status}</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-[var(--brand-border-subtle)] p-3">
                        <p className="text-xs text-[var(--brand-text-muted)]">Total Processed</p>
                        <p className="mt-1 text-lg font-bold">{status.totalProcessed?.toLocaleString() || 0}</p>
                      </div>
                      <div className="rounded-lg border border-[var(--brand-border-subtle)] p-3">
                        <p className="text-xs text-[var(--brand-text-muted)]">Failed</p>
                        <p className="mt-1 text-lg font-bold text-red-400">{status.failedCount || 0}</p>
                      </div>
                      <div className="rounded-lg border border-[var(--brand-border-subtle)] p-3">
                        <p className="text-xs text-[var(--brand-text-muted)]">Last Processed</p>
                        <p className="mt-1 text-sm font-medium">
                          {status.lastProcessedAt
                            ? new Date(status.lastProcessedAt).toLocaleString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>