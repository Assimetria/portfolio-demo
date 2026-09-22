// @system — Bulk actions bar for data tables
// Appears when items are selected, provides common bulk operations.

import { Trash2, Archive, Download, MoreHorizontal, X } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Button } from '../../Button'

export function BulkActions({
  selectedCount = 0,
  totalCount = 0,
  onDeselectAll,
  onSelectAll,
  actions = [],
  className
}) {
  if (selectedCount === 0) {
    return null
  }

  const allSelected = selectedCount === totalCount

  return (
    <div className={cn(
      'flex items-center justify-between gap-4 p-4 bg-brand-primary/10 border border-primary/20 rounded-lg',
      'animate-in slide-in-from-top-2 duration-200',
      className
    )}>
      {/* Selection info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onDeselectAll}
          className="text-brand-text-muted hover:text-brand-text transition-colors"
          aria-label="Deselect all"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          {!allSelected && totalCount > 0 && (
            <>
              <span className="text-brand-text-muted">·</span>
              <button
                onClick={onSelectAll}
                className="text-sm text-brand-primary hover:underline"
              >
                Select all {totalCount}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {actions.map((action, index) => {
          if (action.type === 'separator') {
            return <div key={index} className="h-4 w-px bg-border" />
          }

          const Icon = action.icon

          return (
            <Button
              key={action.id}
              variant={action.variant || 'ghost'}
              size="sm"
              onClick={() => action.onClick?.(selectedCount)}
              disabled={action.disabled}
              className={cn(
                'gap-2',
                action.destructive && 'text-[var(--color-error)] hover:text-[var(--color-error)]'
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// Common bulk action presets
export const commonBulkActions = {
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    destructive: true,
    onClick: (count) => {
      if (confirm(`Delete ${count} item${count > 1 ? 's' : ''}?`)) {
        // Handle deletion
      }
    }
  },
  archive: {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    onClick: (count) => {
      // Handle archiving
    }
  },
  export: {
    id: 'export',
    label: 'Export',
    icon: Download,
    onClick: (count) => {
      // Handle export
    }
  },
  more: {
    id: 'more',
    label: 'More',
    icon: MoreHorizontal,
    onClick: () => {
      // Open menu
    }
  }
}

// Example usage:
// const actions = [
//   commonBulkActions.archive,
//   { type: 'separator' },
//   commonBulkActions.export,
//   { type: 'separator' },
//   { ...commonBulkActions.delete, onClick: handleBulkDelete }
// ]
