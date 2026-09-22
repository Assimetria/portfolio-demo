// @system — Mobile-optimized form wrapper
// Provides better spacing, touch targets, and keyboard handling on mobile
//
// Usage:
// <MobileForm onSubmit={handleSubmit}>
//   <MobileForm.Field label="Name" error={errors.name}>
//     <Input name="name" value={name} onChange={setName} />
//   </MobileForm.Field>
//   <MobileForm.Actions>
//     <Button type="submit">Save</Button>
//   </MobileForm.Actions>
// </MobileForm>

import { cn } from '@/app/lib/@system/utils'

/**
 * MobileForm — Form wrapper with mobile optimizations
 * @param {Object} props
 * @param {React.ReactNode} props.children - Form fields
 * @param {Function} props.onSubmit - Submit handler
 * @param {string} [props.className] - Additional CSS classes
 */
export function MobileForm({ children, onSubmit, className, ...props }) {
  const handleSubmit = (e) => {
    e.preventDefault()
    // Hide keyboard on mobile after submit
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    onSubmit?.(e)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-5 sm:space-y-6', className)}
      {...props}
    >
      {children}
    </form>
  )
}

/**
 * MobileForm.Field — Form field with mobile-optimized spacing and labels
 * @param {Object} props
 * @param {string} props.label - Field label
 * @param {string} [props.description] - Helper text
 * @param {string} [props.error] - Error message
 * @param {boolean} [props.required] - Required field indicator
 * @param {React.ReactNode} props.children - Input component
 * @param {string} [props.className] - Additional CSS classes
 */
MobileForm.Field = function MobileFormField({
  label,
  description,
  error,
  required = false,
  children,
  className,
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Label */}
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-[var(--color-error)] ml-1">*</span>}
      </label>

      {/* Description */}
      {description && (
        <p className="text-xs sm:text-sm text-brand-text-muted">{description}</p>
      )}

      {/* Input */}
      <div className="relative">
        {children}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs sm:text-sm text-[var(--color-error)] font-medium flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * MobileForm.Group — Group multiple fields together (e.g., first/last name)
 * Stacks on mobile, side-by-side on desktop
 * @param {Object} props
 * @param {React.ReactNode} props.children - Field components
 * @param {string} [props.className] - Additional CSS classes
 */
MobileForm.Group = function MobileFormGroup({ children, className }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6', className)}>
      {children}
    </div>
  )
}

/**
 * MobileForm.Actions — Form actions (buttons) section
 * Mobile: Full-width stacked buttons
 * Desktop: Horizontal with proper spacing
 * @param {Object} props
 * @param {React.ReactNode} props.children - Action buttons
 * @param {string} [props.className] - Additional CSS classes
 * @param {'start' | 'end' | 'between'} [props.align='end'] - Button alignment
 */
MobileForm.Actions = function MobileFormActions({
  children,
  className,
  align = 'end',
}) {
  const alignClasses = {
    start: 'justify-start',
    end: 'justify-end',
    between: 'justify-between',
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 pt-4 sm:pt-6',
        'sm:flex-row sm:items-center',
        alignClasses[align],
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * MobileForm.Section — Section divider with optional title
 * @param {Object} props
 * @param {string} [props.title] - Section title
 * @param {string} [props.description] - Section description
 * @param {React.ReactNode} props.children - Section fields
 * @param {string} [props.className] - Additional CSS classes
 */
MobileForm.Section = function MobileFormSection({
  title,
  description,
  children,
  className,
}) {
  return (
    <div className={cn('space-y-4 sm:space-y-5', className)}>
      {(title || description) && (
        <div className="space-y-1 pb-2 border-b">
          {title && (
            <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
          )}
          {description && (
            <p className="text-xs sm:text-sm text-brand-text-muted">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-5 sm:space-y-6">
        {children}
      </div>
    </div>
  )
}
