import { Loader2 } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'

const SIZE_MAP = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
}

export function LoadingSpinner({
  size = 'md',
  label,
  fullScreen = false,
  className,
  labelClassName,
  ...props
}) {
  const pixelSize = typeof size === 'number' ? size : (SIZE_MAP[size] ?? SIZE_MAP.md)

  const spinner = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('inline-flex items-center gap-2 text-brand-text-muted', className)}
      {...props}
    >
      <Loader2 className="animate-spin" size={pixelSize} width={pixelSize} height={pixelSize} aria-hidden="true" />
      {label ? (
        <span className={cn('text-sm', labelClassName)}>{label}</span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-bg/80 backdrop-blur-sm">
        {spinner}
      </div>
    )
  }

  return spinner
}

export default LoadingSpinner
