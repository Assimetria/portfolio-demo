// @custom — API Gateway Onboarding Guide
//
// Step-by-step walkthrough for setting up the API Gateway.
// Features progress tracking with server sync, completion marking,
// reset functionality, and visual progress indicators.
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Circle, RotateCcw, ArrowRight, BookOpen } from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/ui/card'
import { Button } from '../../../../components/@system/ui/button'
import { Badge } from '../../../../components/@system/ui/badge'
import { Separator } from '../../../../components/@system/ui/separator'
import { Skeleton } from '../../../../components/@system/ui/skeleton'
import { cn } from '../../../../lib/@system/utils'

function ApiGatewayGuidePage() {
  const [steps, setSteps] = useState([])
  const [completedSteps, setCompletedSteps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchGuide = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/api-gateway-guide')
      if (!res.ok) throw new Error('Failed to load guide')
      const data = await res.json()
      setSteps(data.steps)
      setCompletedSteps(data.progress.completedSteps || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGuide()
  }, [fetchGuide])

  async function handleMarkComplete(stepId) {
    try {
      setSubmitting(true)
      const res = await fetch('/api/api-gateway-guide/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      })
      if (!res.ok) throw new Error('Failed to update progress')
      const data = await res.json()
      setCompletedSteps(data.progress.completedSteps)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset() {
    try {
      setSubmitting(true)
      const res = await fetch('/api/api-gateway-guide/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to reset progress')
      const data = await res.json()
      setCompletedSteps(data.progress.completedSteps)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const progressPercent =
    steps.length > 0 ? Math.round((completedSteps.length / steps.length) * 100) : 0
  const isComplete = completedSteps.length === steps.length && steps.length > 0

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardLayout.Content>
          <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        </DashboardLayout.Content>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto max-w-3xl p-4 sm:p-6">
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3">
              <BookOpen className="h-7 w-7 text-brand-primary" aria-hidden="true" />
              <h1 className="text-2xl font-bold tracking-tight">API Gateway Onboarding Guide</h1>
            </div>
            <p className="mt-2 text-sm text-brand-text-muted">
              Follow these steps to configure and deploy your API Gateway. Track your progress
              as you go.
            </p>
          </header>

          {/* Progress bar */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Progress: {completedSteps.length} of {steps.length} steps
                  </p>
                  <p className="text-xs text-brand-text-muted">{progressPercent}% complete</p>
                </div>
                <Badge variant={isComplete ? 'default' : 'secondary'} className="text-xs">
                  {isComplete ? 'Completed' : 'In Progress'}
                </Badge>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-brand-surface-hover">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${progressPercent}% complete`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Completion banner */}
          {isComplete && (
            <Card className="mb-8 border-green-500/30 bg-green-500/5">
              <CardContent className="flex items-center gap-3 pt-6">
                <CheckCircle className="h-6 w-6 text-green-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    All steps completed!
                  </p>
                  <p className="text-xs text-brand-text-muted">
                    You have finished the API Gateway onboarding guide.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error banner */}
          {error && (
            <Card className="mb-8 border-red-500/30 bg-red-500/5">
              <CardContent className="pt-6">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Steps list */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isStepCompleted = completedSteps.includes(step.id)
              return (
                <Card
                  key={step.id}
                  className={cn(
                    'transition-colors',
                    isStepCompleted && 'border-green-500/30',
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {isStepCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                          ) : (
                            <Circle className="h-5 w-5 text-brand-text-muted" aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            <span className="mr-2 text-brand-text-muted">Step {index + 1}:</span>
                            {step.title}
                          </CardTitle>
                          <CardDescription className="mt-1">{step.description}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-4">
                    <p className="mb-4 text-sm leading-relaxed text-brand-text-secondary">
                      {step.details}
                    </p>
                    <div className="flex justify-end">
                      {isStepCompleted ? (
                        <Badge variant="outline" className="text-xs text-green-500">
                          Completed
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleMarkComplete(step.id)}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <span className="flex items-center gap-1">
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Saving...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              Mark Complete
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Reset button */}
          {completedSteps.length > 0 && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={submitting}
                className="text-brand-text-muted hover:text-brand-text"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                Restart Guide
              </Button>
            </div>
          )}
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

export default ApiGatewayGuidePage