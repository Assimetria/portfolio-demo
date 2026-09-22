// @system — Mobile-optimized modal/dialog component
// Full-screen on mobile, centered dialog on desktop
//
// Usage:
// <MobileModal
//   open={isOpen}
//   onClose={() => setIsOpen(false)}
//   title="Edit Profile"
//   description="Update your profile information"
// >
//   <MobileModal.Content>
//     {/* Modal content */}
//   </MobileModal.Content>
//   <MobileModal.Actions>
//     <Button onClick={onClose}>Cancel</Button>
//     <Button onClick={onSave}>Save</Button>
//   </MobileModal.Actions>
// </MobileModal>

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

/**
 * MobileModal — Responsive modal component
 * @param {Object} props
 * @param {boolean} props.open - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {string} [props.title] - Modal title
 * @param {string} [props.description] - Modal description
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.fullScreenOnMobile=true] - Use full screen on mobile
 * @param {boolean} [props.closeOnOverlayClick=true] - Close when clicking overlay
 * @param {string} [props.size='md'] - Modal size (sm, md, lg, xl)
 */
export function MobileModal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  fullScreenOnMobile = true,
  closeOnOverlayClick = true,
  size = 'md',
}) {
  const contentRef = useRef(null)

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [open])

  // Handle ESC key
  useEffect(() => {
    if (!open) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  const sizeClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={contentRef}
        className={cn(
          'relative w-full bg-brand-bg shadow-lg',
          'animate-in',
          fullScreenOnMobile
            ? 'h-full rounded-t-xl sm:h-auto sm:rounded-lg slide-in-from-bottom sm:zoom-in-95'
            : 'rounded-t-xl sm:rounded-lg slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95',
          'max-h-[100dvh] flex flex-col',
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b">
          <div className="flex-1 pr-8">
            {title && (
              <h2
                id="modal-title"
                className="text-lg sm:text-xl font-semibold leading-tight"
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                id="modal-description"
                className="mt-1.5 text-sm text-brand-text-muted leading-relaxed"
              >
                {description}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="touch-target rounded-md text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-hover transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * MobileModal.Content — Modal content area
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content
 * @param {string} [props.className] - Additional CSS classes
 */
MobileModal.Content = function MobileModalContent({ children, className }) {
  return (
    <div className={cn('p-4 sm:p-6', className)}>
      {children}
    </div>
  )
}

/**
 * MobileModal.Actions — Modal action buttons
 * Stacked on mobile, horizontal on desktop
 * @param {Object} props
 * @param {React.ReactNode} props.children - Action buttons
 * @param {string} [props.className] - Additional CSS classes
 */
MobileModal.Actions = function MobileModalActions({ children, className }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-3 p-4 sm:p-6 border-t',
        'sm:flex-row sm:justify-end',
        className
      )}
    >
      {children}
    </div>
  )
}
