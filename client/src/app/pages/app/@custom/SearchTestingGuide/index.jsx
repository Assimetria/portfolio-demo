// @custom — Search Testing Guide page
// Provides an interactive UI for testing and validating search functionality
// across all configured search providers (Meilisearch / Algolia / none).
//
// Features:
//   - Provider status and health overview
//   - Interactive search query builder
//   - Result display with metadata
//   - Sample test data reference

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  FileText,
  Database,
  Settings2,
  Play,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Info,
} from 'lucide-react'
import { DashboardLayout } from '@/app/components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/@system/ui/card'
import { Button } from '@/app/components/@system/ui/button'
import { Input } from '@/app/components/@system/ui/input'
import { Label } from '@/app/components/@system/ui/label'
import { Badge } from '@/app/components/@system/ui/badge'
import { Separator } from '@/app/components/@system/ui/separator'
import { Skeleton } from '@/app/components/@system/ui/skeleton'
import { api } from '@/app/lib/@system/api'
import { cn } from '@/app/lib/@system/utils'

// ─── API helpers ───────────────────────────────────────────────────────────

async function fetchTestConfig() {
  const res = await api.get('/search-test')
  return res
}

async function runSearchTest(params) {
  const res = await api.post('/search-test/run', params)
  return res
}

// ─── Color helpers ─────────────────────────────────────────────────────────

function statusColor(configured) {
  return configured ? 'text-green-500' : 'text-brand-text-muted'
}

function providerBadgeVariant(provider) {
  switch (provider) {
    case 'meilisearch': return 'default'
    case 'algolia':     return 'secondary'
    case 'none':        return 'outline'
    default:            return 'outline'
  }
}

// ─── Provider Status Card ──────────────────────────────────────────────────

function ProviderStatusCard({ health, healthAll }) {
  if (!health) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" aria-hidden="true" />
          Search Provider Status
        </CardTitle>
        <CardDescription>
          Active provider and health information for all configured search backends.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            {health.configured
              ? <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
              : <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden="true" />
            }
            <div>
              <p className="text-sm font-medium">Active Provider</p>
              <p className="text-xs text-brand-text-muted">
                {health.provider ?? 'none'}
              </p>
            </div>
          </div>
          <Badge variant={providerBadgeVariant(health.provider)}>
            {health.configured ? 'Configured' : 'Not Configured'}
          </Badge>
        </div>

        {healthAll && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-text-muted">
              All Providers
            </p>
            {Object.entries(healthAll).map(([name, status]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span className="capitalize">{name}</span>
                <div className="flex items-center gap-2">
                  {status.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                  ) : (
                    <span className="text-xs text-brand-text-muted">Not configured</span>
                  )}
                  {status.packageAvailable === false && (
                    <span className="text-xs text-amber-500">(package not installed)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Sample Data Card ──────────────────────────────────────────────────────

function SampleDataCard({ documents }) {
  if (!documents || documents.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" aria-hidden="true" />
          Sample Test Documents
        </CardTitle>
        <CardDescription>
          Built-in sample data available for testing search queries.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-brand-text-muted">
                <th className="pb-2 pr-4 font-medium">ID</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Category</th>
                <th className="pb-2 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-brand-text-muted">{doc.id}</td>
                  <td className="py-2 pr-4 font-medium">{doc.title}</td>
                  <td className="py-2 pr-4">
                    <Badge variant="outline">{doc.category}</Badge>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block rounded bg-brand-surface-hover px-1.5 py-0.5 text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Search Test Form ──────────────────────────────────────────────────────

function SearchTestForm({ onRun, loading, sampleIndexes }) {
  const [index, setIndex] = useState('products')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState('')
  const [sort, setSort] = useState('')
  const [limit, setLimit] = useState('20')
  const [offset, setOffset] = useState('0')
  const [fields, setFields] = useState('')

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault()
      onRun({
        index: index.trim() || 'products',
        q: query,
        filters: filters.trim() || undefined,
        sort: sort.trim() || undefined,
        limit: parseInt(limit, 10) || 20,
        offset: parseInt(offset, 10) || 0,
        fields: fields.trim() || undefined,
      })
    },
    [index, query, filters, sort, limit, offset, fields, onRun]
  )

  const handleClear = useCallback(() => {
    setQuery('')
    setFilters('')
    setSort('')
    setLimit('20')
    setOffset('0')
    setFields('')
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" aria-hidden="true" />
          Search Query Builder
        </CardTitle>
        <CardDescription>
          Configure search parameters and execute a test query.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-index">Index *</Label>
              <Input
                id="test-index"
                value={index}
                onChange={(e) => setIndex(e.target.value)}
                placeholder="e.g. products, docs"
                required
              />
              {sampleIndexes && sampleIndexes.length > 0 && (
                <p className="text-xs text-brand-text-muted">
                  Available: {sampleIndexes.join(', ')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-query">Query *</Label>
              <Input
                id="test-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. getting started"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-filters">Filters (optional)</Label>
              <Input
                id="test-filters"
                value={filters}
                onChange={(e) => setFilters(e.target.value)}
                placeholder="e.g. category = docs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-sort">Sort (optional)</Label>
              <Input
                id="test-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                placeholder="e.g. price:asc,name:desc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-limit">Limit</Label>
              <Input
                id="test-limit"
                type="number"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-offset">Offset</Label>
              <Input
                id="test-offset"
                type="number"
                min="0"
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="test-fields">Fields to Retrieve (optional, comma-separated)</Label>
            <Input
              id="test-fields"
              value={fields}
              onChange={(e) => setFields(e.target.value)}
              placeholder="e.g. id, title, price"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                  Searching...
                </>
              ) : (
                <Play className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Run Test
            </Button>
            <Button type="button" variant="ghost" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Results Display ──────────────────────────────────────────────────────

function ResultsDisplay({ result }) {
  if (!result) return null

  const { query, provider, result: searchResult } = result
  const { hits, total, page, totalPages, processingTimeMs } = searchResult

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" aria-hidden="true" />
          Search Results
        </CardTitle>
        <CardDescription>
          Query &ldquo;{query.q}&rdquo; on index &ldquo;{query.index}&rdquo;
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className="flex items-center gap-1">
            <Layers className="h-3 w-3" aria-hidden="true" />
            Total: {total}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Info className="h-3 w-3" aria-hidden="true" />
            Page: {page} / {totalPages}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {processingTimeMs != null ? `${processingTimeMs} ms` : 'N/A'}
          </Badge>
          <Badge variant={providerBadgeVariant(provider)}>
            Provider: {provider}
          </Badge>
        </div>

        <Separator />

        {hits && hits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-brand-text-muted">
                  {Object.keys(hits[0]).map((key) => (
                    <th key={key} className="pb-2 pr-4 font-medium capitalize last:pr-0">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hits.map((hit, i) => (
                  <tr key={hit.id ?? i} className="border-b last:border-0">
                    {Object.keys(hits[0]).map((key) => (
                      <td key={key} className="py-2 pr-4 last:pr-0">
                        {String(hit[key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-brand-text-muted">
            <Search className="h-8 w-8" aria-hidden="true" />
            <p className="text-sm">No results found</p>
            <p className="text-xs">Try a different query or index.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export function SearchTestingGuide() {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [error, setError] = useState(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [runError, setRunError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchTestConfig()
      .then((data) => {
        if (!cancelled) setConfig(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load config')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const handleRun = useCallback(async (params) => {
    setRunning(true)
    setRunError(null)
    setResult(null)

    try {
      const data = await runSearchTest(params)
      setResult(data)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Search test failed')
    } finally {
      setRunning(false)
    }
  }, [])

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto max-w-5xl space-y-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Search Testing Guide</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Interactive tool for testing and validating search queries across configured
              search providers. Use the form below to execute test searches and inspect results.
            </p>
          </header>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-red-500">Configuration Error</p>
                <p className="text-sm text-brand-text-muted">{error}</p>
              </div>
            </div>
          )}

          {runError && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-amber-500">Search Error</p>
                <p className="text-sm text-brand-text-muted">{runError}</p>
              </div>
            </div>
          )}

          {loading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ) : (
            <>
              {config && (
                <ProviderStatusCard
                  health={config.health}
                  healthAll={config.healthAll}
                />
              )}
              {config?.sampleDocuments && (
                <SampleDataCard documents={config.sampleDocuments} />
              )}
            </>
          )}

          <SearchTestForm
            onRun={handleRun}
            loading={running}
            sampleIndexes={config?.sampleIndexes}
          />

          {result && <ResultsDisplay result={result} />}
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

export default SearchTestingGuide
