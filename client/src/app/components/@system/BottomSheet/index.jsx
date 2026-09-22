// @system — Mobile bottom sheet / action sheet component
// Provides a mobile-native way to display contextual actions or content
// Slides up from the bottom on mobile, appears as a dialog on desktop
//
// Usage:
// <BottomSheet open={isOpen} onClose={() => setIsOpen(false)} title="Actions">
//   <BottomSheetAction icon={<Edit />} onClick={handleEdit}>
//     Edit
//   </BottomSheetAction>
//   <BottomSheetAction icon={<Trash />} onClick={handleDelete} destructive>
//     Delete
//   </BottomSheetAction>
// </BottomSheet>

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { createPortal } from 'react-dom'

/**
 * BottomSheet — Mobile-optimized bottom drawer
 * @param {Object} props
 * @param {boolean} props.open - Open state
 * @param {Function} props.onClose - Close handler
 * @param {React.ReactNode} props.children - Sheet content
 * @param {string} [props.title] - Optional title
 * @param {string} [props.description] - Optional description
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showHandle=true] - Show drag handle
 */
export function BottomSheet({
  open,
  onClose,
  children,
  title,
  description,
  className,
  showHandle = true,
}) {
  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed z-50',
          // Mobile: bottom sheet
          'bottom-0 left-0 right-0 rounded-t-3xl',
          'sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          'sm:max-w-lg sm:w-full sm:mx-4',
          'bg-brand-bg shadow-2xl border-t sm:border',
          'animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
        aria-describedby={description ? 'bottom-sheet-description' : undefined}
      >
        {/* Drag handle (mobile only) */}
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2 sm:hidden">
            <div className="w-12 h-1.5 rounded-full bg-brand-text-muted/30" />
          </div>
        )}

        {/* Header */}
        {(title || description) && (
          <div className="px-4 py-4 sm:px-6 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id="bottom-sheet-title"
                    className="text-lg sm:text-xl font-semibold truncate"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id="bottom-sheet-description"
                    className="mt-1 text-sm text-brand-text-muted"
                  >
                    {description}
                  </p>
                )}
              </div>

              {/* Close button (desktop) */}
              <button
                onClick={onClose}
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-md hover:bg-brand-surface-hover transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-4 sm:px-6 max-h-[70vh] sm:max-h-[60vh] overflow-y-auto safe-padding-bottom">
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}

/**
 * BottomSheetAction — Action button for bottom sheet
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button label
 * @param {React.ReactNode} [props.icon] - Optional icon
 * @param {Function} [props.onClick] - Click handler
 * @param {boolean} [props.destructive] - Destructive variant (red)
 * @param {boolean} [props.disabled] - Disabled state
 * @param {string} [props.className] - Additional CSS classes
 */
export function BottomSheetAction({
  children,
  icon,
  onClick,
  destructive = false,
  disabled = false,
  className,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
        'min-h-touch', // Touch-friendly height
        !disabled && !destructive && 'hover:bg-brand-surface-hover active:bg-brand-surface-active',
        !disabled && destructive && 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] active:bg-[var(--color-error-bg)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {icon && (
        <span className={cn(
          'shrink-0',
          destructive ? 'text-[var(--color-error)]' : 'text-brand-text-muted'
        )}>
          {icon}
        </span>
      )}
      <span className="flex-1 font-medium">{children}</span>
    </button>
  )
}

/**
 * BottomSheetDivider — Visual separator between action groups
 */
export function BottomSheetDivider() {
  return <div className="h-px bg-border my-2" />
}
