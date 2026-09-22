// @system — Admin integrations status page
// Shows all configured integration adapters (email, payment, storage, etc.)
// with their active provider, health status, and test actions.
import { useEffect, useState } from 'react'
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, FlaskConical,
} from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { Badge } from '../../../../components/@system/ui/badge'
import { api } from '../../../../lib/@system/api'

const CATEGORY_ICONS = {
  email:         '📧',
  payment:       '💳',
  storage:       '🗄️',
  notifications: '🔔',
  sms:           '💬',
  ai:            '🤖',
  oauth:         '🔐',
}

function StatusBadge({ configured, devMode }) {
  if (devMode) {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <AlertCircle className="h-3 w-3" /> Dev
      </Badge>
    )
  }
  return configured ? (
    <Badge variant="default" className="gap-1 bg-[var(--color-success)] text-xs hover:bg-[var(--color-success)]">
      <CheckCircle2 className="h-3 w-3" /> Ready
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-xs text-brand-text-muted">
      <XCircle className="h-3 w-3" /> Not configured
    </Badge>
  )
}

function ProviderRow({ name, health, isActive }) {
  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${isActive ? 'bg-brand-surface' : ''}`}>
      <div className="flex items-center gap-2">
        {isActive && <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" title="Active provider" />}
        {!isActive && <span className="h-2 w-2 rounded-full bg-brand-text-muted/30" />}
        <span className={`font-mono ${isActive ? 'font-semibold' : 'text-brand-text-muted'}`}>{name}</span>
      </div>
      <StatusBadge configured={health.configured} devMode={health.devMode} />
    </div>
  )
}

function IntegrationCard({ category, onTest, testing, testResult }) {
  const icon = CATEGORY_ICONS[category.id] ?? '🔌'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>{icon}</span>
            <div>
              <CardTitle className="text-base">{category.label}</CardTitle>
              <CardDescription className="mt-0.5 text-xs">{category.description}</CardDescription>
            </div>
          </div>
          <StatusBadge configured={category.configured} />
        </div>
      </CardHeader>

      <CardContent className="space-y-1 pb-3">
        {Object.entries(category.providers).map(([name, health]) => (
          <ProviderRow
            key={name}
            name={name}
            health={health}
            isActive={category.activeProvider === name}
          />
        ))}
      </CardContent>

      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-brand-text-muted">
            Active: <span className="font-mono font-semibold">{category.activeProvider}</span>
            {' · '}
            <span className="font-mono text-brand-text-muted/70">{category.envVar}</span>
          </div>
          {['email', 'notifications', 'storage'].includes(category.id) && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={testing}
              onClick={() => onTest(category.id)}
            >
              <FlaskConical className="h-3 w-3" />
              {testing ? 'Testing…' : 'Test'}
            </Button>
          )}
        </div>
        {testResult && (
          <div className={`mt-2 rounded px-2 py-1 text-xs ${testResult.ok ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-error-bg)] text-[var(--color-error)]'}`}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
          </div>
        )}
      </div>
    </Card>
  )
}

export function IntegrationsPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(null)
  const [testResults, setTestResults] = useState({})

  async function fetchStatus() {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/integrations')
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integration status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  async function handleTest(id) {
    setTesting(id)
    setTestResults((prev) => ({ ...prev, [id]: { ok: false, message: 'Testing…' } }))
    try {
      await api.post(`/integrations/${id}/test`, {})
      setTestResults((prev) => ({ ...prev, [id]: { ok: true, message: 'Test passed successfully' } }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test failed'
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, message } }))
    } finally {
      setTesting(null)
    }
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
              <p className="mt-1 text-sm text-brand-text-muted">
                Provider-agnostic adapter status for all configured services
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={fetchStatus} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Summary bar */}
          {status && (
            <div className="flex items-center gap-6 rounded-lg border bg-brand-surface px-4 py-3">
              <div className="text-sm">
                <span className="font-semibold text-[var(--color-success)]">{status.summary.configured}</span>
                <span className="ml-1 text-brand-text-muted">configured</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-brand-text-muted">{status.summary.missing}</span>
                <span className="ml-1 text-brand-text-muted">not configured</span>
              </div>
              <div className="ml-auto text-xs text-brand-text-muted">
                Last checked: {new Date(status.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[var(--color-error)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}

          {loading && !status && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-lg border bg-brand-surface" />
              ))}
            </div>
          )}

          {status && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {status.categories.map((category) => (
                <IntegrationCard
                  key={category.id}
                  category={category}
                  onTest={handleTest}
                  testing={testing === category.id}
                  testResult={testResults[category.id] ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}
