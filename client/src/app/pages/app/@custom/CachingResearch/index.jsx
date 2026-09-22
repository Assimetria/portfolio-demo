// @custom — Caching Research page
// Displays caching strategies research with ratings, pros/cons,
// and interactive recommendation based on environment context.
// Uses shadcn components, lucide-react icons, Inter font, dark theme.
import { useState, useEffect, useCallback } from 'react'
import {
  Database,
  Server,
  Globe,
  RefreshCw,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Settings2,
  BarChart3,
} from 'lucide-react'
import { DashboardLayout } from '@/app/components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/@system/ui/card'
import { Button } from '@/app/components/@system/ui/button'
import { Badge } from '@/app/components/@system/ui/badge'
import { Separator } from '@/app/components/@system/ui/separator'
import { Skeleton } from '@/app/components/@system/ui/skeleton'
import { Switch } from '@/app/components/@system/ui/switch'
import { Label } from '@/app/components/@system/ui/label'
import { cn } from '@/app/lib/@system/utils'
import { getCachingStrategies, getCachingRecommendation } from '@/app/api/@custom/caching'

// ─── Icon map ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  server: Server,
  client: Globe,
  infra: Database,
}

const CATEGORY_COLORS = {
  server: 'text-blue-500',
  client: 'text-green-500',
  infra: 'text-purple-500',
}

const CATEGORY_BG = {
  server: 'bg-blue-500/10',
  client: 'bg-green-500/10',
  infra: 'bg-purple-500/10',
}
// ─── Rating stars ────────────────────────────────────────────────────────────

function RatingDots({ value, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-brand-text-muted">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((dot) => (
          <div
            key={dot}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              dot <= value ? 'bg-brand-text' : 'bg-brand-border'
            )}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  )
}

// ─── Strategy Card ───────────────────────────────────────────────────────────

function StrategyCard({ strategy, isRecommended, onSelect }) {
  const Icon = CATEGORY_ICONS[strategy.category] || Layers

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:border-brand-text/40',
        isRecommended && 'ring-2 ring-brand-text/30'
      )}
      data-testid={`strategy-${strategy.id}`}
      onClick={() => onSelect && onSelect(strategy.id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', CATEGORY_BG[strategy.category])}>
              <Icon className={cn('h-4 w-4', CATEGORY_COLORS[strategy.category])} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">{strategy.name}</p>
              <p className="text-xs text-brand-text-muted capitalize">{strategy.category}</p>
            </div>
          </div>
          {strategy.requiresRedis && (
            <Badge variant="outline" className="text-xs">
              Redis
            </Badge>
          )}
          {isRecommended && (
            <Badge className="text-xs" data-testid={`recommended-badge-${strategy.id}`}>
              Recommended
            </Badge>
          )}
        </div>

        <p className="text-xs text-brand-text-muted leading-relaxed">
          {strategy.description}
        </p>

        <Separator />

        <div className="grid grid-cols-3 gap-2">
          <RatingDots value={strategy.freshness} label="Fresh" />
          <RatingDots value={strategy.complexity} label="Complex" />
          <RatingDots value={strategy.infraCost} label="Cost" />
        </div>

        <Separator />

        <div className="space-y-1">
          <p className="text-xs font-medium text-green-400">Pros</p>
          <ul className="space-y-0.5">
            {strategy.pros.slice(0, 2).map((pro, i) => (
              <li key={i} className="text-xs text-brand-text-muted flex items-start gap-1">
                <span className="text-green-400 mt-0.5">+</span>
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-red-400">Cons</p>
          <ul className="space-y-0.5">
            {strategy.cons.slice(0, 2).map((con, i) => (
              <li key={i} className="text-xs text-brand-text-muted flex items-start gap-1">
                <span className="text-red-400 mt-0.5">-</span>
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
// ─── Recommendation Panel ────────────────────────────────────────────────────

function RecommendationPanel({ recommendation, env }) {
  if (!recommendation) return null

  return (
    <Card data-testid="recommendation-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
          Recommended Configuration
        </CardTitle>
        <CardDescription>
          Best caching strategy for{' '}
          {env.isMultiProcess ? 'multi-process' : 'single-process'} deployment
          {env.hasRedis ? ' with Redis' : ' without Redis'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Primary</p>
              <p className="text-xs text-brand-text-muted">{recommendation.primary.name}</p>
            </div>
          </div>
          <Badge>{recommendation.primary.id}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Secondary</p>
              <p className="text-xs text-brand-text-muted">{recommendation.secondary.name}</p>
            </div>
          </div>
          <Badge variant="secondary">{recommendation.secondary.id}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Fallback</p>
              <p className="text-xs text-brand-text-muted">{recommendation.fallback.name}</p>
            </div>
          </div>
          <Badge variant="outline">{recommendation.fallback.id}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
  )
}
// ─── Main Page ───────────────────────────────────────────────────────────────

export function CachingResearch() {
  const [strategies, setStrategies] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [hasRedis, setHasRedis] = useState(false)
  const [isMultiProcess, setIsMultiProcess] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const fetchStrategies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCachingStrategies()
      setStrategies(data.strategies)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strategies')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRecommendation = useCallback(async () => {
    setError(null)
    try {
      const data = await getCachingRecommendation({ hasRedis, isMultiProcess })
      setRecommendation(data.recommendation)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recommendation')
    }
  }, [hasRedis, isMultiProcess])

  useEffect(() => {
    fetchStrategies()
  }, [fetchStrategies])

  useEffect(() => {
    fetchRecommendation()
  }, [fetchRecommendation])

  const handleStrategySelect = useCallback((id) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])
return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto max-w-6xl space-y-6">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Caching Strategies</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Research and analysis of caching strategies for the dashboard API endpoint.
              Compare strategies by freshness, complexity, and cost ratings.
            </p>
          </header>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-red-500">Error</p>
                <p className="text-sm text-brand-text-muted">{error}</p>
              </div>
            </div>
          )}

          {/* Environment Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-5 w-5" aria-hidden="true" />
                Environment Configuration
              </CardTitle>
              <CardDescription>
                Toggle environment settings to see how the recommended strategy changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    id="has-redis"
                    checked={hasRedis}
                    onCheckedChange={setHasRedis}
                    data-testid="has-redis-switch"
                  />
                  <Label htmlFor="has-redis" className="text-sm">
                    Redis Available
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="multi-process"
                    checked={isMultiProcess}
                    onCheckedChange={setIsMultiProcess}
                    data-testid="multi-process-switch"
                  />
                  <Label htmlFor="multi-process" className="text-sm">
                    Multi-Process Mode
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRecommendation}
                  className="ml-auto"
                  data-testid="refresh-recommendation"
                >
                  <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Panel */}
          {recommendation && (
            <RecommendationPanel recommendation={recommendation} env={{ hasRedis, isMultiProcess }} />
          )}
<Separator />

          {/* Strategy Cards */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
              All Strategies ({strategies ? strategies.length : '...'})
            </h2>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {strategies && strategies.map((s) => (
                  <StrategyCard
                    key={s.id}
                    strategy={s}
                    isRecommended={recommendation?.primary?.id === s.id ||
                      recommendation?.secondary?.id === s.id ||
                      recommendation?.fallback?.id === s.id}
                    onSelect={handleStrategySelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

export default CachingResearch