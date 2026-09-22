// @system — Quick actions panel for dashboard
// Display frequently used actions as clickable cards
//
// Usage:
// <QuickActions
//   actions={[
//     { id: 1, icon: Plus, label: 'Create project', onClick: () => {} },
//     { id: 2, icon: Upload, label: 'Upload file', onClick: () => {} }
//   ]}
// />

import { Plus, Upload, Users, Settings, FileText, Download } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Card, CardContent } from '../../Card'

const DEFAULT_ACTIONS = [
  { id: 'create', icon: Plus, label: 'Create new', description: 'Start something fresh' },
  { id: 'upload', icon: Upload, label: 'Upload file', description: 'Import your data' },
  { id: 'invite', icon: Users, label: 'Invite team', description: 'Collaborate together' },
  { id: 'settings', icon: Settings, label: 'Settings', description: 'Configure your account' },
]

/**
 * @typedef {Object} QuickAction
 * @property {string | number} id - Unique identifier
 * @property {React.ComponentType} icon - Lucide icon component
 * @property {string} label - Action label
 * @property {string} [description] - Optional description
 * @property {() => void} onClick - Click handler
 * @property {boolean} [disabled] - Disabled state
 */

/**
 * QuickActions — Grid of quick action buttons
 * @param {Object} props
 * @param {QuickAction[]} [props.actions=DEFAULT_ACTIONS] - Array of actions
 * @param {string} [props.className] - Additional CSS classes
 * @param {'grid' | 'list'} [props.layout='grid'] - Layout style
 */
export function QuickActions({
  actions = DEFAULT_ACTIONS,
  className,
  layout = 'grid',
}) {
  if (layout === 'list') {
    return (
      <div className={cn('space-y-2', className)}>
        {actions.map((action) => (
          <QuickActionCard key={action.id} action={action} variant="list" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {actions.map((action) => (
        <QuickActionCard key={action.id} action={action} />
      ))}
    </div>
  )
}

/**
 * QuickActionCard — Individual quick action button
 * @private
 */
function QuickActionCard({ action, variant = 'grid' }) {
  const { icon: Icon, label, description, onClick, disabled } = action

  if (variant === 'list') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-all',
          'hover:border-primary/60 hover:bg-brand-surface-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
          <Icon className="h-5 w-5 text-brand-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          {description && (
            <p className="text-xs text-brand-text-muted truncate">{description}</p>
          )}
        </div>
      </button>
    )
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all',
        'hover:border-primary/60 hover:shadow-md active:scale-[0.98]',
        // Mobile-friendly touch target
        'min-h-[120px] sm:min-h-[140px]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={!disabled ? onClick : undefined}
    >
      <CardContent className="flex flex-col items-center text-center justify-center h-full p-4 sm:p-6">
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-brand-primary/10 mb-2 sm:mb-3">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-brand-primary" />
        </div>
        <p className="text-xs sm:text-sm font-medium mb-1">{label}</p>
        {description && (
          <p className="text-[10px] sm:text-xs text-brand-text-muted line-clamp-2">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * QuickActions.Compact — Compact horizontal scrollable version
 * @param {Object} props
 * @param {QuickAction[]} props.actions - Array of actions
 * @param {string} [props.className] - Additional CSS classes
 */
QuickActions.Compact = function CompactQuickActions({ actions, className }) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-2', className)}>
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            'flex flex-col items-center gap-2 p-3 rounded-lg border bg-brand-surface min-w-[100px] transition-all',
            'hover:border-primary/60 hover:bg-brand-surface-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {action.icon && <action.icon className="h-5 w-5 text-brand-primary" />}
          <span className="text-xs font-medium text-center">{action.label}</span>
        </button>
      ))}
    </div>
  )
}
