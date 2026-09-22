// @custom — Comments Alerting configuration page (SV4-136)
// Allows users to configure alerting rules for comment errors including
// Slack webhook URL, email notifications, error thresholds, and quiet hours.
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bell,
  Save,
  Send,
  RefreshCw,
  AlertTriangle,
  Slack,
  Mail,
  Clock,
  Settings2,
} from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/ui/card'
import { Button } from '../../../../components/@system/ui/button'
import { Switch } from '../../../../components/@system/ui/switch'
import { Input } from '../../../../components/@system/ui/input'
const NOTIFY_OPTIONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abuse / Harassment' },
  { value: 'technical_error', label: 'Technical Errors' },
  { value: 'flagged', label: 'Flagged Content' },
  { value: 'offensive', label: 'Offensive Language' },
]

const SECTIONS = [
  { id: 'general', label: 'General', icon: Settings2, description: 'Master toggle and notification channels.' },
  { id: 'thresholds', label: 'Thresholds', icon: AlertTriangle, description: 'Error frequency thresholds for triggering alerts.' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Choose which error types to watch.' },
  { id: 'quiet-hours', label: 'Quiet Hours', icon: Clock, description: 'Suppress alerts during specific times.' },
]

export function CommentsAlertingPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeId = searchParams.get('section') ?? SECTIONS[0].id
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0]

  function handleSelect(id) {
    setSearchParams({ section: id }, { replace: true })
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Comments Alerting</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Configure real-time alerting for comment errors and policy violations.
            </p>
          </header>

          <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
            <SectionNav
              sections={SECTIONS}
              activeId={active.id}
              onSelect={handleSelect}
            />

            <section aria-labelledby="alerting-section-title">
              {active.id === 'general' && <GeneralSection />}
              {active.id === 'thresholds' && <ThresholdsSection />}
              {active.id === 'notifications' && <NotificationsSection />}
              {active.id === 'quiet-hours' && <QuietHoursSection />}
            </section>
          </div>
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

// ─── Section navigation ──────────────────────────────────────────────

function SectionNav({ sections, activeId, onSelect }) {
  return (
    <nav
      aria-label="Alerting configuration sections"
      className="lg:sticky lg:top-6 lg:self-start"
    >
      <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = section.id === activeId
          return (
            <li key={section.id}>
              <Button
                variant="ghost"
                onClick={() => onSelect(section.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full justify-start gap-2 whitespace-nowrap',
                  isActive
                    ? 'bg-brand-surface-hover text-brand-text'
                    : 'text-brand-text-muted hover:text-brand-text'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{section.label}</span>
              </Button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
import { Label } from '../../../../components/@system/ui/label'
import { Separator } from '../../../../components/@system/ui/separator'
import { cn } from '../../../../lib/@system/utils'
// ─── General Section ─────────────────────────────────────────────────

function GeneralSection() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getAlertingConfig()
      setConfig(res.config)
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to load alerting configuration.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  async function handleSave() {
    try {
      setSaving(true)
      const res = await updateAlertingConfig(config)
      setConfig(res.config)
      setStatusMessage({ type: 'success', text: res.message })
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to save configuration.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestAlert() {
    try {
      setTesting(true)
      const res = await sendTestAlert()
      setTestResult({ type: 'success', text: res.message })
    } catch (err) {
      setTestResult({ type: 'error', text: 'Test alert failed.' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-text-muted" />
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-brand-text-muted">
          Unable to load configuration.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="alerting-section-title">General Settings</CardTitle>
        <CardDescription>Enable or disable comment error alerting and configure notification channels.</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-6 pt-6">
        {statusMessage && (
          <div
            role="alert"
            className={cn(
              'rounded-md px-4 py-3 text-sm',
              statusMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="alerting-enabled">Enable Alerting</Label>
            <p className="text-sm text-brand-text-muted">
              When enabled, the system monitors comments for errors and policy violations.
            </p>
          </div>
          <Switch
            id="alerting-enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Notification Channels</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-text-muted" aria-hidden="true" />
              <Label htmlFor="email-notifications">Email Notifications</Label>
            </div>
            <Switch
              id="email-notifications"
              checked={config.email_notifications}
              onCheckedChange={(checked) => setConfig({ ...config, email_notifications: checked })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Slack className="h-4 w-4 text-brand-text-muted" aria-hidden="true" />
              <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
            </div>
            <Input
              id="slack-webhook"
              placeholder="https://hooks.slack.com/services/..."
              value={config.slack_webhook_url}
              onChange={(e) => setConfig({ ...config, slack_webhook_url: e.target.value })}
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>

          <Button variant="outline" onClick={handleTestAlert} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending Test...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test Alert
              </>
            )}
          </Button>
        </div>

        {testResult && (
          <div
            role="status"
            className={cn(
              'rounded-md px-4 py-3 text-sm',
              testResult.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {testResult.text}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ─── Thresholds Section ──────────────────────────────────────────────

function ThresholdsSection() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getAlertingConfig()
      setConfig(res.config)
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to load alerting configuration.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  async function handleSave() {
    try {
      setSaving(true)
      const res = await updateAlertingConfig({
        error_threshold: config.error_threshold,
        time_window_minutes: config.time_window_minutes,
      })
      setConfig(res.config)
      setStatusMessage({ type: 'success', text: res.message })
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to save thresholds.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-text-muted" />
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-brand-text-muted">
          Unable to load configuration.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="alerting-section-title">Error Thresholds</CardTitle>
        <CardDescription>Set the error frequency thresholds that trigger alerts.</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-6 pt-6">
        {statusMessage && (
          <div
            role="alert"
            className={cn(
              'rounded-md px-4 py-3 text-sm',
              statusMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="error-threshold">Error Threshold</Label>
          <p className="text-sm text-brand-text-muted">
            Minimum number of errors within the time window to trigger an alert.
          </p>
          <Input
            id="error-threshold"
            type="number"
            min="1"
            value={config.error_threshold}
            onChange={(e) => setConfig({ ...config, error_threshold: parseInt(e.target.value, 10) || 1 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="time-window">Time Window (minutes)</Label>
          <p className="text-sm text-brand-text-muted">
            The sliding window of time in which errors are counted.
          </p>
          <Input
            id="time-window"
            type="number"
            min="1"
            value={config.time_window_minutes}
            onChange={(e) => setConfig({ ...config, time_window_minutes: parseInt(e.target.value, 10) || 1 })}
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Thresholds
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
// ─── Notifications Section ───────────────────────────────────────────

function NotificationsSection() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getAlertingConfig()
      setConfig(res.config)
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to load alerting configuration.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  function toggleNotifyOption(value) {
    const current = config.notify_on || []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    setConfig({ ...config, notify_on: next })
  }

  async function handleSave() {
    try {
      setSaving(true)
      const res = await updateAlertingConfig({ notify_on: config.notify_on })
      setConfig(res.config)
      setStatusMessage({ type: 'success', text: res.message })
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to save notification preferences.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-text-muted" />
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-brand-text-muted">
          Unable to load configuration.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="alerting-section-title">Notification Types</CardTitle>
        <CardDescription>Choose which types of comment errors and violations trigger alerts.</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-6 pt-6">
        {statusMessage && (
          <div
            role="alert"
            className={cn(
              'rounded-md px-4 py-3 text-sm',
              statusMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="space-y-3">
          {NOTIFY_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center justify-between rounded-lg border border-brand-border p-3">
              <Label htmlFor={`notify-${option.value}`} className="cursor-pointer">
                {option.label}
              </Label>
              <Switch
                id={`notify-${option.value}`}
                checked={(config.notify_on || []).includes(option.value)}
                onCheckedChange={() => toggleNotifyOption(option.value)}
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Notifications
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
// ─── Quiet Hours Section ─────────────────────────────────────────────

function QuietHoursSection() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getAlertingConfig()
      setConfig(res.config)
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to load alerting configuration.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  async function handleSave() {
    try {
      setSaving(true)
      const res = await updateAlertingConfig({
        quiet_hours_enabled: config.quiet_hours_enabled,
        quiet_hours_start: config.quiet_hours_start,
        quiet_hours_end: config.quiet_hours_end,
      })
      setConfig(res.config)
      setStatusMessage({ type: 'success', text: res.message })
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Failed to save quiet hours.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-text-muted" />
        </CardContent>
      </Card>
    )
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-brand-text-muted">
          Unable to load configuration.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="alerting-section-title">Quiet Hours</CardTitle>
        <CardDescription>Suppress alerts during specified hours to avoid unnecessary disruptions.</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-6 pt-6">
        {statusMessage && (
          <div
            role="alert"
            className={cn(
              'rounded-md px-4 py-3 text-sm',
              statusMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            )}
          >
            {statusMessage.text}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="quiet-hours-enabled">Enable Quiet Hours</Label>
            <p className="text-sm text-brand-text-muted">
              When enabled, alerts are suppressed during the configured time range.
            </p>
          </div>
          <Switch
            id="quiet-hours-enabled"
            checked={config.quiet_hours_enabled}
            onCheckedChange={(checked) => setConfig({ ...config, quiet_hours_enabled: checked })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quiet-start">Start Time</Label>
            <Input
              id="quiet-start"
              type="time"
              value={config.quiet_hours_start}
              onChange={(e) => setConfig({ ...config, quiet_hours_start: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiet-end">End Time</Label>
            <Input
              id="quiet-end"
              type="time"
              value={config.quiet_hours_end}
              onChange={(e) => setConfig({ ...config, quiet_hours_end: e.target.value })}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Quiet Hours
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export default CommentsAlertingPage
import { getAlertingConfig, updateAlertingConfig, sendTestAlert } from '../../../../api/@custom'