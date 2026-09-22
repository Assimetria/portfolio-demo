// @system — Global date-range context.
//
// Holds a single "active reporting window" shared across the app (dashboard
// widgets, admin financial reports, …). A page's range selects read from and
// write to this context so navigating between reports keeps the window stable.
//
// Dates are stored as plain `YYYY-MM-DD` strings (UTC day granularity). That
// keeps <input type="date"> binding and the `startDate`/`endDate` query params
// (also `YYYY-MM-DD`) trivial and deterministic in every timezone.
//
// Value shape returned by useGlobalDateRange():
//   {
//     rangeStart: "YYYY-MM-DD",
//     rangeEnd:   "YYYY-MM-DD",
//     preset:     "last7" | "last30" | "custom",
//     applyRange(next),   // legacy alias for setRange
//     setRange({ rangeStart, rangeEnd, preset }) => void,
//   }
import { createContext, useCallback, useContext, useMemo, useState } from "react"

export const GLOBAL_RANGE_STORAGE_KEY = "system.globalDateRange"
export const GLOBAL_RANGE_PRESETS = {
  last7: { label: "Last 7 days", days: 7 },
  last30: { label: "Last 30 days", days: 30 },
  last90: { label: "Last 90 days", days: 90 },
}

// UTC day arithmetic helpers (kept plain for easy unit testing).
const DAY_MS = 24 * 60 * 60 * 1000

export function toDateOnlyISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export function addDaysISO(iso, days) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return iso
  d.setTime(d.getTime() + days * DAY_MS)
  return d.toISOString().slice(0, 10)
}

export function subDaysISO(iso, days) {
  return addDaysISO(iso, -days)
}

export function todayISO() {
  return toDateOnlyISO(new Date())
}

export function isISOAnchor(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * Normalise a 30-day default window: today back through today - 29.
 * @returns {{rangeStart: string, rangeEnd: string, preset: string}}
 */
export function defaultGlobalRange(now = new Date()) {
  const end = toDateOnlyISO(now)
  return {
    rangeStart: subDaysISO(end, GLOBAL_RANGE_PRESETS.last30.days - 1),
    rangeEnd: end,
    preset: "last30",
  }
}

function storedInitialRange() {
  if (typeof localStorage === "undefined") return defaultGlobalRange()
  try {
    const raw = localStorage.getItem(GLOBAL_RANGE_STORAGE_KEY)
    if (!raw) return defaultGlobalRange()
    const parsed = JSON.parse(raw)
    if (parsed && isISOAnchor(parsed.rangeStart) && isISOAnchor(parsed.rangeEnd)) {
      const now = todayISO()
      const end = parsed.rangeEnd > now ? now : parsed.rangeEnd
      const start = parsed.rangeStart > end ? end : parsed.rangeStart
      return {
        rangeStart: start,
        rangeEnd: end,
        preset: parsed.preset === "custom" ? "custom" : "last30",
      }
    }
  } catch {
    /* corrupted storage — fall through to defaults */
  }
  return defaultGlobalRange()
}

const GlobalDateRangeContext = createContext(null)

export function GlobalDateRangeProvider({ children, storageKey = GLOBAL_RANGE_STORAGE_KEY }) {
  const [initial] = useState(() => storedInitialRange())
  const [range, setRangeState] = useState(initial)

  const persist = useCallback((next) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* persistence is best-effort (private mode etc.) */
    }
  }, [storageKey])

  const setRange = useCallback(({ rangeStart, rangeEnd, preset }) => {
    // Swap when reversed so rangeStart is always <= rangeEnd.
    let start = isISOAnchor(rangeStart) ? rangeStart : initial.rangeStart
    let end = isISOAnchor(rangeEnd) ? rangeEnd : initial.rangeEnd
    if (start > end) [start, end] = [end, start]
    const next = { rangeStart: start, rangeEnd: end, preset: preset || "custom" }
    setRangeState(next)
    persist(next)
  }, [initial.rangeStart, initial.rangeEnd, persist])

  const value = useMemo(() => ({
    ...range,
    setRange,
    applyRange: setRange,
  }), [range, setRange])

  return (
    <GlobalDateRangeContext.Provider value={value}>
      {children}
    </GlobalDateRangeContext.Provider>
  )
}

export function useGlobalDateRange() {
  const ctx = useContext(GlobalDateRangeContext)
  if (!ctx) throw new Error("useGlobalDateRange must be used inside <GlobalDateRangeProvider>")
  return ctx
}

export default GlobalDateRangeProvider
