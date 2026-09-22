// @system — Cancellations report page (role: admin)
//
// Mounted at /app/admin/cancellations (see AppRoutes.jsx). Reads and updates the
// global date-range context (store/@system/dateRange) so that the report window
// is shared with other admin/dashboard surfaces. Every server request carries the
// active YYYY-MM-DD start/end so filtering happens server-side.
import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarRange, Percent, RefreshCw } from "lucide-react"
import {
  useGlobalDateRange,
  GLOBAL_RANGE_PRESETS,
  subDaysISO,
  todayISO,
  isISOAnchor,
} from "@/app/store/@system/dateRange"
import { listCancellations } from "@/app/api/@system/admin"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/@system/Card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/app/components/@system/Table"
import { Button } from "@/app/components/@system/ui/button"
import { Input } from "@/app/components/@system/ui/input"
import { StatCard } from "./parts"
import { formatDate } from "./format"

const PRESET_KEYS = Object.keys(GLOBAL_RANGE_PRESETS)

function clampISO(value) {
  return isISOAnchor(value) ? value : null
}

function matchPreset(start, end, today) {
  for (const key of PRESET_KEYS) {
    const { days } = GLOBAL_RANGE_PRESETS[key]
    if (end === today && start === subDaysISO(today, days - 1)) return key
  }
  return "custom"
}

export function CancellationsPage() {
  const { rangeStart, rangeEnd, setRange } = useGlobalDateRange()
  const today = todayISO()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Draft copies of the active window so the "Custom" inputs never fight the
  // global value while the user types (see Range Persistence acceptance).
  const [draftStart, setDraftStart] = useState(rangeStart)
  const [draftEnd, setDraftEnd] = useState(rangeEnd)

  useEffect(() => setDraftStart(rangeStart), [rangeStart])
  useEffect(() => setDraftEnd(rangeEnd), [rangeEnd])

  const activePreset = useMemo(() => matchPreset(rangeStart, rangeEnd, today), [rangeStart, rangeEnd, today])
  const fetchReport = useCallback(async (start, end) => {
    setLoading(true)
    setError(null)
    const params = { period: "month" }
    const s = clampISO(start)
    const e = clampISO(end)
    if (s) params.startDate = s
    if (e) params.endDate = e
    try {
      const res = await listCancellations(params)
      if (res && typeof res.status === "number" && res.status !== 200) {
        throw new Error(res.message || `Request failed (${res.status})`)
      }
      setReport(res?.data ?? res ?? { total: 0, reasons: [] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cancellations")
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch whenever the *global* window changes.
  useEffect(() => {
    void fetchReport(rangeStart, rangeEnd)
  }, [rangeStart, rangeEnd, fetchReport])

  const total = Number(report?.total ?? 0)
  const reasons = Array.isArray(report?.reasons) ? report.reasons : []
  // floor (not round) so the shares of a breakdown never add up past 100%
  const share = (count) => (total > 0 ? Math.floor((Number(count) / total) * 100) : 0)

  const handlePresetChange = (e) => {
    const key = e.target.value
    if (key === "custom" || !GLOBAL_RANGE_PRESETS[key]) return
    const end = today
    const start = subDaysISO(end, GLOBAL_RANGE_PRESETS[key].days - 1)
    setRange({ rangeStart: start, rangeEnd: end, preset: key })
  }

  const handleApplyCustom = () => {
    const start = clampISO(draftStart)
    const end = clampISO(draftEnd)
    if (!start || !end) return
    setRange({
      rangeStart: start <= end ? start : end,
      rangeEnd: start <= end ? end : start,
      preset: "custom",
    })
  }
  return (
    <div className="space-y-6" data-testid="cancellations-page">
      <div>
        <h2 className="text-2xl font-bold">Cancellations</h2>
        <p className="text-sm text-brand-text-muted mt-1">
          Cancelled subscriptions and churn reasons for the global report window.
        </p>
      </div>

      {/* Window/range controls — bound to the global date-range context */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Report window</CardTitle>
          <CardDescription>
            Filters apply across the app from {formatDate(rangeStart)} to {formatDate(rangeEnd)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-brand-text-muted mb-1" htmlFor="global-range-preset">Preset</label>
            <select
              id="global-range-preset"
              aria-label="Range preset"
              data-testid="range-preset"
              value={activePreset}
              onChange={handlePresetChange}
              className="h-9 rounded-md border border-brand-border bg-brand-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              {PRESET_KEYS.map((k) => (
                <option key={k} value={k}>{GLOBAL_RANGE_PRESETS[k].label}</option>
              ))}
              <option value="custom">Custom range</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-brand-text-muted mb-1" htmlFor="range-start">Start date</label>
            <Input
              id="range-start"
              type="date"
              data-testid="range-start"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-brand-text-muted mb-1" htmlFor="range-end">End date</label>
            <Input
              id="range-end"
              type="date"
              data-testid="range-end"
              value={draftEnd}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="h-9"
            />
          </div>
          <Button variant="outline" className="gap-2 h-9" onClick={handleApplyCustom} data-testid="apply-range">
            <CalendarRange className="h-4 w-4" />
            Apply
          </Button>
          <Button
            variant="outline"
            className="gap-2 h-9 ml-auto"
            onClick={() => fetchReport(rangeStart, rangeEnd)}
            disabled={loading}
            data-testid="refresh-cancellations"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>
      {error && (
        <div className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={CalendarRange} label="Cancelled (window)" value={loading ? undefined : total.toLocaleString()} loading={loading} />
        <StatCard icon={Percent} label="Reasons with data" value={loading ? undefined : `${reasons.length}`} loading={loading} />
        <StatCard
          icon={RefreshCw}
          label="Leading reason share"
          value={loading ? undefined : total && reasons[0] ? `${share(reasons[0].count)}% of total` : "—"}
          loading={loading}
        />
      </div>

      {/* Reason breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cancellation reasons</CardTitle>
          <CardDescription>Breakdown of how customers cancelled, grouped by reason metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" role="status" aria-label="Loading cancellations">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-brand-surface" />
              ))}
            </div>
          ) : reasons.length > 0 ? (
            <Table data-testid="cancellations-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Reason type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reasons.map((r, idx) => (
                  <TableRow key={`${r.cancellation_type}:${r.cancellation_reason}:${idx}`} data-testid="reason-row">
                    <TableCell className="text-sm">{r.cancellation_type ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.cancellation_reason ?? "—"}</TableCell>
                    <TableCell className="text-sm text-right">{Number(r.count ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right">{share(r.count)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-brand-text-muted" data-testid="empty-state">
              No cancellations recorded in this window.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default CancellationsPage
