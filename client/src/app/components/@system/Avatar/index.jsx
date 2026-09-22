// @system — Avatar component
// Displays user avatars with fallback initials and status indicators
//
// Usage:
// <Avatar src="/avatar.jpg" alt="John Doe" />
// <Avatar name="John Doe" />
// <Avatar name="John Doe" status="online" />

import { User } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

/**
 * Avatar — User avatar component with fallback
 * @param {Object} props
 * @param {string} [props.src] - Avatar image URL
 * @param {string} [props.alt] - Image alt text
 * @param {string} [props.name] - User name (used for fallback initials)
 * @param {string} [props.size='md'] - Avatar size: 'xs', 'sm', 'md', 'lg', 'xl'
 * @param {string} [props.status] - Status indicator: 'online', 'offline', 'away', 'busy'
 * @param {string} [props.className] - Additional CSS classes
 * @param {Function} [props.onClick] - Click handler
 */
export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  status,
  className,
  onClick,
}) {
  const sizeClasses = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl',
  }

  const statusSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  }

  const statusColors = {
    online: 'bg-[var(--color-success)]',
    offline: 'bg-brand-text-muted',
    away: 'bg-[var(--color-warning)]',
    busy: 'bg-[var(--color-error)]',
  }

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const initials = name ? getInitials(name) : ''

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full bg-brand-surface font-medium overflow-hidden',
          sizeClasses[size],
          onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
          className
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : initials ? (
          <span className="select-none">{initials}</span>
        ) : (
          <User className="h-1/2 w-1/2 text-brand-text-muted" />
        )}
      </div>

      {/* Status indicator */}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-background',
            statusSizes[size],
            statusColors[status]
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  )
}

/**
 * AvatarGroup — Group of stacked avatars
 * @param {Object} props
 * @param {Array} props.users - Array of user objects with src/name
 * @param {number} [props.max=3] - Max avatars to show
 * @param {string} [props.size='md'] - Avatar size
 * @param {string} [props.className] - Additional CSS classes
 */
export function AvatarGroup({
  users = [],
  max = 3,
  size = 'md',
  className,
}) {
  const visible = users.slice(0, max)
  const remaining = Math.max(users.length - max, 0)

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((user, index) => (
        <div
          key={user.id || index}
          className="ring-2 ring-background rounded-full"
        >
          <Avatar
            src={user.src}
            name={user.name}
            alt={user.name}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-brand-surface font-medium ring-2 ring-background',
            size === 'xs' && 'h-6 w-6 text-xs',
            size === 'sm' && 'h-8 w-8 text-sm',
            size === 'md' && 'h-10 w-10 text-base',
            size === 'lg' && 'h-12 w-12 text-lg',
            size === 'xl' && 'h-16 w-16 text-xl'
          )}
        >
          <span className="text-brand-text-muted">+{remaining}</span>
        </div>
      )}
    </div>
  )
}
