// @custom — Health Check Dependencies page
// Displays aggregated health status of all downstream service dependencies.
// Uses shadcn components, lucide-react icons, Inter font, dark theme.
import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  Server,
  Shield,
  Mail,
  HardDrive,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/ui/card'
import { Button } from '../../../../components/@system/ui/button'
import { getHealthCheckDependencies } from '../../../../api/@custom/health-check'

const ICON_MAP = {
  database: Database,
  redis: Server,
  auth: Shield,
  email: Mail,
  storage: HardDrive,
}

function getStatusColor(status) {
  switch (status) {
    case 'healthy':
      return 'text-green-500'
    case 'unhealthy':
      return 'text-red-500'
    case 'degraded':
      return 'text-yellow-500'
    default:
      return 'text-brand-text-muted'
  }
}

function getStatusBg(status) {
  switch (status) {
    case 'healthy':
      return 'bg-green-500/10'
    case 'unhealthy':
      return 'bg-red-500/10'
    case 'degraded':
      return 'bg-yellow-500/10'
    default:
      return 'bg-brand-surface'
  }
}

function StatusIcon({ status }) {
  if (status === 'healthy') {
    return <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
  }
  if (status === 'unhealthy') {
    return <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
  }
  return <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
}

function DependencyCard({ dependency }) {
  const Icon = ICON_MAP[dependency.name] || Server
  return (
    <Card data-testid={`dep-${dependency.name}`}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getStatusBg(dependency.status)}`}>
          <Icon className={`h-5 w-5 ${getStatusColor(dependency.status)}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{dependency.name}</span>
            <StatusIcon status={dependency.status} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs font-medium capitalize ${getStatusColor(dependency.status)}`}>
              {dependency.status}
            </span>
            <span className="text-xs text-brand-text-muted flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {dependency.latency_ms}ms
            </span>
          </div>
          {dependency.error && (
            <p className="mt-1 text-xs text-red-400 truncate" title={dependency.error}>
              {dependency.error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function HealthCheckPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHealth = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const result = await getHealthCheckDependencies()
      setData(result)
    } catch (err) {
      setError(err.message || 'Failed to fetch health status')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto w-full max-w-4xl">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Activity className="h-6 w-6 text-brand-primary" aria-hidden="true" />
                Service Health
              </h1>
              <p className="mt-1 text-sm text-brand-text-muted">
                Real-time health status of all downstream service dependencies.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
              aria-label="Refresh health status"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </header>

          {loading && !data && (
            <Card>
              <CardContent className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-brand-text-muted" aria-hidden="true" />
                <p className="mt-4 text-sm text-brand-text-muted">Checking dependencies…</p>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-red-500" role="alert">
                  <XCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {data && (
            <>
              {/* Overall status banner */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${getStatusBg(data.status)}`}>
                        <StatusIcon status={data.status} />
                      </div>
                      <div>
                        <p className="text-lg font-semibold capitalize" data-testid="overall-status">
                          System {data.status}
                        </p>
                        <p className="text-xs text-brand-text-muted">
                          Last checked: {new Date(data.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-500" data-testid="healthy-count">
                          {data.summary.healthy}
                        </p>
                        <p className="text-xs text-brand-text-muted">Healthy</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-500" data-testid="unhealthy-count">
                          {data.summary.unhealthy}
                        </p>
                        <p className="text-xs text-brand-text-muted">Unhealthy</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-brand-text" data-testid="total-count">
                          {data.summary.total}
                        </p>
                        <p className="text-xs text-brand-text-muted">Total</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Uptime */}
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Server Info</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex gap-6 text-sm">
                    <span className="text-brand-text-muted">
                      Uptime: <span className="text-brand-text font-medium">{formatUptime(data.uptime)}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Dependency cards */}
              <div className="space-y-3">
                <h2 className="text-base font-semibold">Dependencies</h2>
                {data.dependencies.map((dep) => (
                  <DependencyCard key={dep.name} dependency={dep} />
                ))}
              </div>
            </>
          )}
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default HealthCheckPage
