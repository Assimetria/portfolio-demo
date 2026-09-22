// @system — Feature spotlight component to highlight new features
// Modal that highlights a new feature with optional onboarding steps
//
// Usage:
// <FeatureSpotlight
//   isOpen={showFeature}
//   onClose={() => setShowFeature(false)}
//   feature={{
//     title: 'New Dashboard',
//     description: 'Check out our redesigned dashboard...',
//     image: '/images/new-dashboard.png',
//     cta: { label: 'Try it now', href: '/app' }
//   }}
// />

import { X, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/app/lib/@system/utils'
import { useEffect } from 'react'

/**
 * FeatureSpotlight — Highlight new features to users
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the spotlight is visible
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.feature - Feature data
 * @param {string} props.feature.title - Feature title
 * @param {string} props.feature.description - Feature description
 * @param {string} [props.feature.image] - Feature image/screenshot URL
 * @param {React.ReactNode} [props.feature.content] - Custom content (overrides image)
 * @param {Object} [props.feature.cta] - Call-to-action button
 * @param {string} props.feature.cta.label - CTA button text
 * @param {string} [props.feature.cta.href] - CTA link
 * @param {Function} [props.feature.cta.onClick] - CTA click handler
 * @param {string} [props.feature.badge] - Badge text (e.g., "New", "Beta")
 * @param {string} [props.className] - Additional CSS classes
 */
export function FeatureSpotlight({ 
  isOpen, 
  onClose, 
  feature,
  className 
}) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCtaClick = () => {
    if (feature.cta?.onClick) {
      feature.cta.onClick()
    } else if (feature.cta?.href) {
      window.location.href = feature.cta.href
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative bg-brand-bg rounded-xl shadow-2xl',
          'max-w-2xl w-full max-h-[90vh] overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-300',
          className
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-[var(--brand-bg)]/80 backdrop-blur-sm hover:bg-brand-surface-hover transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="overflow-y-auto max-h-[90vh]">
          {/* Image/Visual */}
          {feature.content ? (
            <div className="p-6 sm:p-8 border-b">
              {feature.content}
            </div>
          ) : feature.image ? (
            <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
              <img
                src={feature.image}
                alt={feature.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-16 w-16 text-brand-primary/30" />
            </div>
          )}

          {/* Text content */}
          <div className="p-6 sm:p-8 space-y-4">
            {/* Badge */}
            {feature.badge && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-medium">
                <Sparkles className="h-3 w-3" />
                {feature.badge}
              </span>
            )}

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {feature.title}
            </h2>

            {/* Description */}
            <p className="text-sm sm:text-base text-brand-text-muted leading-relaxed">
              {feature.description}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {feature.cta && (
                <Button
                  onClick={handleCtaClick}
                  size="lg"
                  className="gap-2 w-full sm:w-auto"
                >
                  {feature.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                Maybe later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * useFeatureSpotlight — Hook to manage feature spotlight state
 * Automatically shows spotlight for new features and tracks which ones have been seen
 * 
 * @param {string} featureId - Unique feature identifier
 * @param {Object} feature - Feature data (same as FeatureSpotlight props)
 * @returns {Object} - { showSpotlight, closeSpotlight }
 */
export function useFeatureSpotlight(featureId, feature) {
  const [showSpotlight, setShowSpotlight] = React.useState(false)

  React.useEffect(() => {
    // Check if user has seen this feature
    const seenFeatures = JSON.parse(localStorage.getItem('seenFeatures') || '{}')
    
    if (!seenFeatures[featureId]) {
      setShowSpotlight(true)
    }
  }, [featureId])

  const closeSpotlight = React.useCallback(() => {
    setShowSpotlight(false)
    
    // Mark as seen
    const seenFeatures = JSON.parse(localStorage.getItem('seenFeatures') || '{}')
    seenFeatures[featureId] = true
    localStorage.setItem('seenFeatures', JSON.stringify(seenFeatures))
  }, [featureId])

  return { showSpotlight, closeSpotlight, feature }
}
