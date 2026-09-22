// @system — Dropdown menu component
// Accessible dropdown with keyboard navigation
//
// Usage:
// <Dropdown trigger={<Button>Menu</Button>}>
//   <DropdownItem onClick={handleEdit}>Edit</DropdownItem>
//   <DropdownItem onClick={handleDelete} variant="danger">Delete</DropdownItem>
// </Dropdown>

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

/**
 * Dropdown — Dropdown menu container
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Trigger element
 * @param {React.ReactNode} props.children - Dropdown items
 * @param {string} [props.align='left'] - Menu alignment: 'left', 'right'
 * @param {string} [props.className] - Additional CSS classes
 */
export function Dropdown({
  trigger,
  children,
  align = 'left',
  className,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className={cn('relative inline-block', className)} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[12rem] sm:min-w-[12rem] rounded-lg border bg-brand-surface p-1 sm:p-1 shadow-lg animate-in fade-in-0 zoom-in-95',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * DropdownItem — Dropdown menu item
 * @param {Object} props
 * @param {React.ReactNode} props.children - Item content
 * @param {Function} [props.onClick] - Click handler
 * @param {React.ReactNode} [props.icon] - Leading icon
 * @param {string} [props.shortcut] - Keyboard shortcut text
 * @param {boolean} [props.checked] - Show check mark
 * @param {boolean} [props.disabled] - Disabled state
 * @param {string} [props.variant='default'] - Variant: 'default', 'danger'
 * @param {string} [props.className] - Additional CSS classes
 */
export function DropdownItem({
  children,
  onClick,
  icon,
  shortcut,
  checked,
  disabled = false,
  variant = 'default',
  className,
}) {
  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
    }
  }

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 sm:gap-2 px-3 sm:px-3 py-2.5 sm:py-2 text-sm sm:text-sm rounded-md transition-colors touch-target',
        'hover:bg-brand-surface-hover active:bg-brand-surface-active focus:bg-brand-surface-hover focus:outline-none',
        variant === 'danger' && 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] focus:bg-[var(--color-error-bg)]',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      onClick={handleClick}
      disabled={disabled}
      role="menuitem"
    >
      {checked && <Check className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
      {shortcut && (
        <span className="text-xs sm:text-xs text-brand-text-muted">{shortcut}</span>
      )}
    </button>
  )
}

/**
 * DropdownSeparator — Dropdown separator
 */
export function DropdownSeparator({ className }) {
  return <div className={cn('my-1 h-px bg-border', className)} role="separator" />
}

/**
 * DropdownLabel — Dropdown section label
 * @param {Object} props
 * @param {React.ReactNode} props.children - Label text
 * @param {string} [props.className] - Additional CSS classes
 */
export function DropdownLabel({ children, className }) {
  return (
    <div className={cn('px-3 sm:px-3 py-2 sm:py-2 text-xs sm:text-xs font-semibold text-brand-text-muted', className)}>
      {children}
    </div>
  )
}

/**
 * DropdownSubmenu — Nested submenu
 * @param {Object} props
 * @param {string} props.label - Submenu label
 * @param {React.ReactNode} props.icon - Leading icon
 * @param {React.ReactNode} props.children - Submenu items
 */
export function DropdownSubmenu({ label, icon, children }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="w-full flex items-center gap-2 sm:gap-2 px-3 sm:px-3 py-2.5 sm:py-2 text-sm sm:text-sm rounded-md hover:bg-brand-surface-hover active:bg-brand-surface-active transition-colors touch-target"
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="flex-1 text-left">{label}</span>
        <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4 text-brand-text-muted" />
      </button>

      {isOpen && (
        <div className="absolute left-full top-0 ml-1 min-w-[12rem] sm:min-w-[12rem] rounded-lg border bg-brand-surface p-1 sm:p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          {children}
        </div>
      )}
    </div>
  )
}
