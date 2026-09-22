// @system — Feature Flags tab for AdminPage
import { RefreshCw, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { Toggle } from './parts'

export function FeatureFlagsTab({
  featureFlags, flagsLoading, flagsError,
  flagCategoryFilter, setFlagCategoryFilter,
  showAddFlag, setShowAddFlag,
  newFlag, setNewFlag,
  fetchFeatureFlags,
  handleFlagToggle,
  handleAddFlag,
  handleDeleteFlag,
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>Toggle platform features on or off. Changes are persisted immediately.</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={flagCategoryFilter}
              onChange={e => {
                setFlagCategoryFilter(e.target.value)
                fetchFeatureFlags(e.target.value)
              }}
              className="h-8 rounded-md border border-brand-border bg-brand-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <option value="">All categories</option>
              {[...new Set(featureFlags.map(f => f.category))].sort().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddFlag(!showAddFlag)}
              className="gap-2"
            >
              <Plus className="h-3 w-3" />
              Add Flag
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchFeatureFlags(flagCategoryFilter)}
              disabled={flagsLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${flagsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {flagsError && (
            <p className="text-sm text-[var(--color-error)] mb-4">{flagsError}</p>
          )}

          {/* Add flag form */}
          {showAddFlag && (
            <div className="mb-6 p-4 border rounded-lg bg-brand-surface space-y-3">
              <p className="text-sm font-medium">New Feature Flag</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="key (e.g. dark_mode)"
                  value={newFlag.key}
                  onChange={e => setNewFlag(prev => ({ ...prev, key: e.target.value }))}
                  className="h-8 rounded-md border border-brand-border bg-brand-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <input
                  type="text"
                  placeholder="Label (e.g. Dark Mode)"
                  value={newFlag.label}
                  onChange={e => setNewFlag(prev => ({ ...prev, label: e.target.value }))}
                  className="h-8 rounded-md border border-brand-border bg-brand-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newFlag.description}
                  onChange={e => setNewFlag(prev => ({ ...prev, description: e.target.value }))}
                  className="h-8 rounded-md border border-brand-border bg-brand-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
                <select
                  value={newFlag.category}
                  onChange={e => setNewFlag(prev => ({ ...prev, category: e.target.value }))}
                  className="h-8 rounded-md border border-brand-border bg-brand-bg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="general">general</option>
                  <option value="auth">auth</option>
                  <option value="email">email</option>
                  <option value="billing">billing</option>
                  <option value="beta">beta</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddFlag} disabled={!newFlag.key || !newFlag.label}>
                  Create
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddFlag(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {flagsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded bg-brand-surface" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {featureFlags.map((flag) => (
                <div
                  key={flag.key}
                  className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-brand-surface-hover/30 transition-colors border-b last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{flag.label}</p>
                      <span className="inline-flex items-center rounded-full bg-brand-surface px-2 py-0.5 text-[10px] font-medium text-brand-text-muted">
                        {flag.category}
                      </span>
                    </div>
                    {flag.description && (
                      <p className="text-xs text-brand-text-muted mt-0.5">{flag.description}</p>
                    )}
                    <p className="text-[10px] text-brand-text-muted mt-0.5 font-mono">{flag.key}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Toggle
                      checked={flag.enabled}
                      onChange={() => handleFlagToggle(flag)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-brand-text-muted hover:text-[var(--color-error)]"
                      onClick={() => handleDeleteFlag(flag.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {featureFlags.length === 0 && (
                <p className="text-center text-brand-text-muted py-8">
                  No feature flags configured. Click "Add Flag" to create one.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
