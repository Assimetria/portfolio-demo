// @system — skeleton loading placeholder component
import { cn } from '@/app/lib/@system/utils'


export function Skeleton({ className, circle, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-brand-surface',
        circle && 'rounded-full',
        className
      )}
      {...props}
    />
  )
}

/** A common content-block skeleton: title + 3 lines of text */
export function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-brand-surface p-6 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

/** Row skeleton for tables */
export function SkeletonRow({ cols = 4 }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}

// ─── Page-level skeletons ─────────────────────────────────────────────────────

/** Skeleton for the HomePage dashboard (stat cards + activity feed) */
export function HomePageSkeleton() {
  return (
    <main id="main-content" className="flex-1 overflow-auto p-8">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-brand-surface p-6">
            <Skeleton className="h-3 w-28 mb-4" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Recent activity card */}
      <div className="rounded-lg border bg-brand-surface p-6">
        <div className="mb-4 space-y-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton circle className="h-8 w-8 shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

/** Skeleton for the ApiKeysPage (table of API keys) */
export function ApiKeysPageSkeleton() {
  return (
    <div className="rounded-lg border bg-brand-surface">
      <div className="p-6 border-b space-y-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="p-0">
        {/* Table header */}
        <div className="flex gap-4 px-6 py-3 border-b bg-brand-surface">
          {[1.5, 1, 1, 1, 1, 0.5].map((flex, i) => (
            <Skeleton key={i} className="h-3" style={{ flex }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
            <Skeleton className="h-4" style={{ flex: 1.5 }} />
            <Skeleton className="h-5 w-20 rounded-md" style={{ flex: 1 }} />
            <Skeleton className="h-4" style={{ flex: 1 }} />
            <Skeleton className="h-4" style={{ flex: 1 }} />
            <Skeleton className="h-4" style={{ flex: 1 }} />
            <Skeleton className="h-7 w-16 rounded-md" style={{ flex: 0.5 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the AdminPage users table */
export function AdminUsersTableSkeleton() {
  return (
    <div className="rounded-lg border bg-brand-surface">
      <div className="flex items-center justify-between p-6 border-b">
        <div className="space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      <div className="p-0">
        <div className="flex gap-4 px-6 py-3 border-b bg-brand-surface">
          {[0.5, 1, 1.5, 0.8, 1].map((flex, i) => (
            <Skeleton key={i} className="h-3" style={{ flex }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
            <Skeleton className="h-4" style={{ flex: 0.5 }} />
            <Skeleton className="h-4" style={{ flex: 1 }} />
            <Skeleton className="h-4" style={{ flex: 1.5 }} />
            <Skeleton className="h-5 w-14 rounded-full" style={{ flex: 0.8 }} />
            <Skeleton className="h-4" style={{ flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the ErrorTrackingPage (stat cards + error table) */
export function ErrorTrackingPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-brand-surface p-4 flex items-start gap-3">
            <Skeleton className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b bg-brand-surface/40">
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-16 hidden sm:block" />
          <Skeleton className="h-3 w-12 hidden md:block" />
          <Skeleton className="h-3 w-20 hidden md:block" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
            <Skeleton circle className="h-4 w-4 shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4 max-w-sm" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full hidden sm:block" />
            <Skeleton className="h-4 w-10 hidden md:block" />
            <Skeleton className="h-4 w-16 hidden md:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the SettingsPage (profile form + danger zone) */
export function SettingsPageSkeleton() {
  return (
    <main id="main-content" className="flex-1 overflow-auto p-8 max-w-2xl">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-52" />
      </div>

      {/* Profile card */}
      <div className="rounded-lg border bg-brand-surface p-6 mb-6 space-y-5">
        <div className="space-y-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-56" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Danger zone card */}
      <div className="rounded-lg border border-destructive/40 bg-brand-surface p-6 space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-3 w-72" />
      </div>
    </main>
  )
}
