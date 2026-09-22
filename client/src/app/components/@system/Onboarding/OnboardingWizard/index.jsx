// @system — Multi-step onboarding wizard
// Guides new users through initial setup with a step-by-step flow.
// Tracks progress, allows back/forward navigation, and saves state.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Rocket,
} from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Button } from '../../ui/button'
import { useAuthContext } from '@/app/store/@system/auth'
import { api } from '@/app/lib/@system/api'
import {
  STEPS,
  WelcomeStep,
  ProfileStep,
  PreferencesStep,
  InviteStep,
  CompleteStep,
} from './steps'

export function OnboardingWizard() {
  const navigate = useNavigate()
  const { updateUser } = useAuthContext()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [data, setData] = useState({
    name: '',
    displayName: '',
    jobTitle: '',
    company: '',
    location: '',
    preferences: {
      emailNotifications: true,
      marketingEmails: false,
      weeklyDigest: false,
    },
    invites: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const currentStep = STEPS[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === STEPS.length - 1

  const handleDataChange = (updates) => {
    setData((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  const handleNext = async () => {
    if (isLastStep) {
      await handleComplete()
    } else {
      setCurrentStepIndex((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }

  const handleComplete = async () => {
    setSaving(true)
    setError('')

    try {
      // Save onboarding data
      await api.patch('/users/me/onboarding', {
        ...data,
        onboardingCompleted: true,
      })

      // Update auth context
      await updateUser({ onboardingCompleted: true })

      // Send invitations if any
      if (data.invites && data.invites.length > 0) {
        try {
          await api.post('/teams/invites', {
            emails: data.invites,
          })
        } catch (err) {
          // Don't block completion if invites fail
          console.error('Failed to send invites:', err)
        }
      }

      // Navigate to app
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setSaving(true)
    try {
      await api.patch('/users/me/onboarding', {
        onboardingCompleted: true,
      })
      await updateUser({ onboardingCompleted: true })
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip onboarding')
      setSaving(false)
    }
  }

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'welcome':
        return <WelcomeStep data={data} onDataChange={handleDataChange} />
      case 'profile':
        return <ProfileStep data={data} onDataChange={handleDataChange} />
      case 'preferences':
        return <PreferencesStep data={data} onDataChange={handleDataChange} />
      case 'invite':
        return <InviteStep data={data} onDataChange={handleDataChange} />
      case 'complete':
        return <CompleteStep />
      default:
        return null
    }
  }

  return (
    <div className="w-full space-y-8">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isActive = index === currentStepIndex
          const isComplete = index < currentStepIndex

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  isComplete && 'border-primary bg-brand-primary text-brand-text-on-primary',
                  isActive && !isComplete && 'border-primary bg-brand-primary/10 text-brand-primary',
                  !isActive && !isComplete && 'border-muted-foreground/30 text-brand-text-muted'
                )}
              >
                {isComplete ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-12 mx-2 transition-all',
                    isComplete ? 'bg-brand-primary' : 'bg-brand-text-muted/30'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">{renderStepContent()}</div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-error)]/20 p-4">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          {!isFirstStep && !isLastStep && (
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={saving}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isLastStep && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip for now
            </Button>
          )}

          <Button
            onClick={handleNext}
            disabled={saving}
            className="gap-2"
          >
            {isLastStep ? (
              <>
                {saving ? 'Completing...' : 'Go to Dashboard'}
                <Rocket className="h-4 w-4" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
