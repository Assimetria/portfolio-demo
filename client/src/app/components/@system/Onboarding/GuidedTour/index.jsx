// @system — Guided product tour with spotlight and tooltips
// Interactive walkthrough of key features with step-by-step guidance.
// Uses position-aware tooltips that adapt to available space.

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Button } from '../../Button'

export function GuidedTour({
  steps = [],
  isActive = false,
  onComplete,
  onSkip,
  storageKey = 'guided-tour-completed'
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [tooltipPlacement, setTooltipPlacement] = useState('bottom')
  const step = steps[currentStep]
  const targetElement = useRef(null)

  useEffect(() => {
    if (!isActive || !step) return

    // Find target element
    const element = document.querySelector(step.selector)
    if (!element) {
      console.warn(`GuidedTour: selector "${step.selector}" not found`)
      return
    }

    targetElement.current = element

    // Calculate tooltip position
    const updatePosition = () => {
      const rect = element.getBoundingClientRect()
      const tooltipWidth = 320 // Approximate tooltip width
      const tooltipHeight = 200 // Approximate tooltip height
      const padding = 16
      const spotlightPadding = 8

      // Add spotlight effect
      element.style.position = 'relative'
      element.style.zIndex = '9999'
      element.style.boxShadow = '0 0 0 4px rgba(var(--primary), 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)'
      element.style.borderRadius = '8px'

      // Determine best placement
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const spaceRight = window.innerWidth - rect.right
      const spaceLeft = rect.left

      let placement = 'bottom'
      let top = rect.bottom + padding + spotlightPadding
      let left = rect.left + rect.width / 2 - tooltipWidth / 2

      // Check if tooltip fits below
      if (spaceBelow < tooltipHeight + padding) {
        // Try above
        if (spaceAbove >= tooltipHeight + padding) {
          placement = 'top'
          top = rect.top - tooltipHeight - padding - spotlightPadding
        }
        // Try right
        else if (spaceRight >= tooltipWidth + padding) {
          placement = 'right'
          top = rect.top + rect.height / 2 - tooltipHeight / 2
          left = rect.right + padding + spotlightPadding
        }
        // Try left
        else if (spaceLeft >= tooltipWidth + padding) {
          placement = 'left'
          top = rect.top + rect.height / 2 - tooltipHeight / 2
          left = rect.left - tooltipWidth - padding - spotlightPadding
        }
      }

      // Keep tooltip in viewport
      if (left < padding) left = padding
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding
      }

      setTooltipPosition({ top, left })
      setTooltipPlacement(placement)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      // Remove spotlight
      if (targetElement.current) {
        targetElement.current.style.position = ''
        targetElement.current.style.zIndex = ''
        targetElement.current.style.boxShadow = ''
        targetElement.current.style.borderRadius = ''
      }
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [isActive, currentStep, step])

  if (!isActive || !step) return null

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      handleComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem(storageKey, 'true')
    onComplete?.()
  }

  const handleSkip = () => {
    localStorage.setItem(storageKey, 'skipped')
    onSkip?.()
  }

  return createPortal(
    <>
      {/* Backdrop (handled by spotlight effect on element) */}
      
      {/* Tooltip */}
      <div
        className={cn(
          'fixed z-[10000] w-80 bg-brand-surface text-brand-text rounded-lg border shadow-lg',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`
        }}
      >
        {/* Arrow */}
        <div
          className={cn(
            'absolute w-3 h-3 bg-brand-surface border rotate-45',
            tooltipPlacement === 'bottom' && 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-r-0 border-b-0',
            tooltipPlacement === 'top' && 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-l-0 border-t-0',
            tooltipPlacement === 'right' && 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-t-0 border-r-0',
            tooltipPlacement === 'left' && 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-b-0 border-l-0'
          )}
        />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-brand-text-muted">
                  Step {currentStep + 1} of {steps.length}
                </span>
              </div>
              <h3 className="text-base font-semibold">{step.title}</h3>
            </div>
            <button
              onClick={handleSkip}
              className="text-brand-text-muted hover:text-brand-text transition-colors"
              aria-label="Skip tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <p className="text-sm text-brand-text-muted mb-4">
            {step.content}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-brand-text-muted hover:text-brand-text transition-colors"
            >
              Skip tour
            </button>
            
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevious}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1"
              >
                {isLastStep ? 'Got it!' : 'Next'}
                {!isLastStep && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// Example steps:
// const tourSteps = [
//   {
//     selector: '[data-tour="dashboard"]',
//     title: 'Your Dashboard',
//     content: 'This is your command center. View key metrics and recent activity at a glance.'
//   },
//   {
//     selector: '[data-tour="create-button"]',
//     title: 'Create Something New',
//     content: 'Click here to create a new project. You can also use the keyboard shortcut Cmd+N.'
//   },
//   {
//     selector: '[data-tour="search"]',
//     title: 'Quick Search',
//     content: 'Use this to quickly find anything. Press Cmd+K to open from anywhere.'
//   }
// ]
