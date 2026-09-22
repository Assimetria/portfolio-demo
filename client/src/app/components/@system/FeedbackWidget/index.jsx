// @system — User feedback widget for collecting in-app feedback
// Floating button that opens a feedback form
//
// Usage:
// <FeedbackWidget />

import { useState } from 'react'
import { MessageSquare, X, Send, ThumbsUp, ThumbsDown, Meh, Smile, Frown } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../Form'
import { cn } from '@/app/lib/@system/utils'
import { api } from '@/app/lib/@system/api'

const FEEDBACK_TYPES = [
  { id: 'bug', label: 'Bug Report', icon: Frown, color: 'text-[var(--color-error)]' },
  { id: 'feature', label: 'Feature Request', icon: Smile, color: 'text-[var(--color-info)]' },
  { id: 'improvement', label: 'Improvement', icon: ThumbsUp, color: 'text-[var(--color-success)]' },
  { id: 'other', label: 'Other', icon: Meh, color: 'text-brand-text-muted' },
]

const SATISFACTION_LEVELS = [
  { value: 1, icon: Frown, label: 'Poor', color: 'text-[var(--color-error)]' },
  { value: 2, icon: ThumbsDown, label: 'Below Average', color: 'text-orange-500' },
  { value: 3, icon: Meh, label: 'Average', color: 'text-[var(--color-warning)]' },
  { value: 4, icon: ThumbsUp, label: 'Good', color: 'text-[var(--color-success)]' },
  { value: 5, icon: Smile, label: 'Excellent', color: 'text-emerald-500' },
]

/**
 * FeedbackWidget — Collect user feedback in-app
 * @param {Object} props
 * @param {string} [props.position='bottom-left'] - Widget position
 * @param {Function} [props.onSubmit] - Custom submit handler
 * @param {string} [props.className] - Additional CSS classes
 */
export function FeedbackWidget({ 
  position = 'bottom-left',
  onSubmit,
  className 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(1) // 1: type selection, 2: details, 3: success
  const [feedbackType, setFeedbackType] = useState(null)
  const [satisfaction, setSatisfaction] = useState(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleReset = () => {
    setStep(1)
    setFeedbackType(null)
    setSatisfaction(null)
    setMessage('')
    setEmail('')
    setError('')
  }

  const handleClose = () => {
    setIsOpen(false)
    setTimeout(handleReset, 300) // Reset after animation
  }

  const handleSubmitFeedback = async (e) => {
    e.preventDefault()
    
    if (!message.trim()) {
      setError('Please provide your feedback')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const feedbackData = {
        type: feedbackType,
        satisfaction,
        message: message.trim(),
        email: email.trim() || undefined,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }

      if (onSubmit) {
        await onSubmit(feedbackData)
      } else {
        // Default: send to API
        await api.post('/feedback', feedbackData)
      }

      setStep(3) // Success step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-20',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
  }

  const panelPositionClasses = {
    'bottom-right': 'bottom-20 right-0',
    'bottom-left': 'bottom-20 left-0',
    'top-right': 'top-20 right-0',
    'top-left': 'top-20 left-0',
  }

  return (
    <div className={cn('fixed z-40', positionClasses[position], className)}>
      {/* Feedback button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="default"
        variant="outline"
        className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all"
        aria-label="Feedback"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-5 w-5" />
        )}
      </Button>

      {/* Feedback panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
            onClick={handleClose}
          />

          {/* Panel */}
          <div
            className={cn(
              'absolute w-80 sm:w-96 bg-brand-bg border rounded-lg shadow-xl',
              'flex flex-col overflow-hidden',
              panelPositionClasses[position]
            )}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-base">Send Feedback</h3>
              <button
                onClick={handleClose}
                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-brand-surface-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-brand-text-muted">
                    What would you like to share with us?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDBACK_TYPES.map((type) => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setFeedbackType(type.id)
                            setStep(2)
                          }}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-[var(--brand-border-subtle)] hover:border-primary hover:bg-brand-surface-hover transition-all text-center"
                        >
                          <Icon className={cn('h-6 w-6', type.color)} />
                          <span className="text-xs font-medium">{type.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (
                <form onSubmit={handleSubmitFeedback} className="space-y-4">
                  {/* Satisfaction rating */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      How satisfied are you? (optional)
                    </label>
                    <div className="flex gap-2 justify-between">
                      {SATISFACTION_LEVELS.map((level) => {
                        const Icon = level.icon
                        return (
                          <button
                            key={level.value}
                            type="button"
                            onClick={() => setSatisfaction(level.value)}
                            className={cn(
                              'flex flex-col items-center gap-1 p-2 rounded-lg transition-all',
                              satisfaction === level.value
                                ? 'bg-brand-primary/10 border-2 border-primary'
                                : 'border-2 border-transparent hover:bg-brand-surface-hover'
                            )}
                            title={level.label}
                          >
                            <Icon className={cn('h-5 w-5', level.color)} />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Tell us more
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share your thoughts, ideas, or issues..."
                      className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      autoFocus
                    />
                  </div>

                  {/* Email (optional) */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Email (optional)
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                    <p className="text-xs text-brand-text-muted mt-1">
                      We'll only use this to follow up on your feedback
                    </p>
                  </div>

                  {error && (
                    <p className="text-sm text-[var(--color-error)]">{error}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 gap-2"
                    >
                      {submitting ? 'Sending...' : (
                        <>
                          <Send className="h-4 w-4" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {step === 3 && (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success-bg)] dark:bg-[var(--color-success-bg)]/30">
                    <ThumbsUp className="h-8 w-8 text-[var(--color-success)] dark:text-[var(--color-success)]" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Thank you!</h4>
                    <p className="text-sm text-brand-text-muted">
                      Your feedback helps us improve.
                    </p>
                  </div>
                  <Button onClick={handleClose} className="w-full">
                    Close
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
