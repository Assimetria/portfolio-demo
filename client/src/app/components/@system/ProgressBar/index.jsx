// @system — Progress bar component
// Visual progress indicator with labels and variants
//
// Usage:
// <ProgressBar value={75} />
// <ProgressBar value={50} label="Uploading..." showPercentage />

import { cn } from '@/app/lib/@system/utils'

/**
 * ProgressBar — Progress indicator component
 * @param {Object} props
 * @param {number} props.value - Progress value (0-100)
 * @param {number} [props.max=100] - Maximum value
 * @param {string} [props.label] - Progress label
 * @param {boolean} [props.showPercentage=false] - Show percentage text
 * @param {string} [props.size='md'] - Bar size: 'sm', 'md', 'lg'
 * @param {string} [props.variant='default'] - Color variant: 'default', 'success', 'warning', 'danger'
 * @param {boolean} [props.animated=false] - Animated stripes
 * @param {string} [props.className] - Additional CSS classes
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = false,
  size = 'md',
  variant = 'default',
  animated = false,
  className,
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  const variantClasses = {
    default: 'bg-brand-primary',
    success: 'bg-[var(--color-success)]',
    warning: 'bg-[var(--color-warning)]',
    danger: 'bg-[var(--color-error)]',
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Label */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2 text-sm">
          {label && <span className="font-medium">{label}</span>}
          {showPercentage && (
            <span className="text-brand-text-muted">{Math.round(percentage)}%</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div
        className={cn(
          'w-full bg-brand-surface rounded-full overflow-hidden',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            variantClasses[variant],
            animated && 'bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

/**
 * CircularProgress — Circular progress indicator
 * @param {Object} props
 * @param {number} props.value - Progress value (0-100)
 * @param {string} [props.size='md'] - Size: 'sm', 'md', 'lg'
 * @param {boolean} [props.showPercentage=true] - Show percentage text
 * @param {string} [props.variant='default'] - Color variant
 * @param {string} [props.className] - Additional CSS classes
 */
export function CircularProgress({
  value,
  size = 'md',
  showPercentage = true,
  variant = 'default',
  className,
}) {
  const percentage = Math.min(Math.max(value, 0), 100)
  
  const sizes = {
    sm: { size: 40, stroke: 3 },
    md: { size: 60, stroke: 4 },
    lg: { size: 80, stroke: 5 },
  }

  const variantColors = {
    default: 'var(--brand-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-error)',
  }

  const { size: svgSize, stroke } = sizes[size]
  const radius = (svgSize - stroke * 2) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={svgSize} height={svgSize} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          className="text-brand-surface"
        />
        {/* Progress circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          stroke={variantColors[variant]}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      
      {showPercentage && (
        <span className="absolute text-sm font-semibold">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  )
}
