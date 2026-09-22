// @system — Flexible filters bar for data tables
// Provides search, status filters, date range, and custom filters.
// Fully controlled component - parent manages filter state.

import { useState } from 'react'
import { Search, X, Filter, Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Button } from '../../Button'
import { Badge } from '../../Badge'

export function FiltersBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  activeFilters = {},
  onFilterChange,
  onClearAll,
  dateRange,
  onDateRangeChange,
  showDateRange = false,
  className
}) {
  const [showFilters, setShowFilters] = useState(false)
  
  const activeCount = Object.keys(activeFilters).reduce((count, key) => {
    const value = activeFilters[key]
    return count + (Array.isArray(value) ? value.length : value ? 1 : 0)
  }, 0)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main bar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        {onSearchChange && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'w-full pl-10 pr-10 py-2 text-sm rounded-lg border border-brand-border bg-brand-bg',
                'placeholder:text-brand-text-muted',
                'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2',
                'transition-colors'
              )}
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Filters toggle */}
        {filters.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 min-w-[20px]">
                {activeCount}
              </Badge>
            )}
            <ChevronDown 
              className={cn(
                'h-4 w-4 transition-transform',
                showFilters && 'rotate-180'
              )} 
            />
          </Button>
        )}

        {/* Date range */}
        {showDateRange && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {/* Open date picker */}}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            {dateRange ? `${dateRange.start} - ${dateRange.end}` : 'Date range'}
          </Button>
        )}

        {/* Clear all */}
        {(activeCount > 0 || searchValue) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange?.('')
              onClearAll?.()
            }}
            className="text-brand-text-muted"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && filters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-brand-surface">
          {filters.map((filter) => (
            <FilterControl
              key={filter.id}
              filter={filter}
              value={activeFilters[filter.id]}
              onChange={(value) => onFilterChange?.(filter.id, value)}
            />
          ))}
        </div>
      )}

      {/* Active filter pills */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-brand-text-muted">Active filters:</span>
          {Object.entries(activeFilters).map(([key, value]) => {
            if (!value || (Array.isArray(value) && value.length === 0)) return null
            
            const filter = filters.find(f => f.id === key)
            if (!filter) return null

            const displayValue = Array.isArray(value) 
              ? value.join(', ')
              : value

            return (
              <Badge
                key={key}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {filter.label}: {displayValue}
                <button
                  onClick={() => onFilterChange?.(key, filter.type === 'multi' ? [] : '')}
                  className="ml-1 hover:bg-brand-surface-hover rounded-sm p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Individual filter control component
function FilterControl({ filter, value, onChange }) {
  if (filter.type === 'select') {
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5">{filter.label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">All</option>
          {filter.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (filter.type === 'multi') {
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5">{filter.label}</label>
        <div className="space-y-1.5">
          {filter.options?.map((opt) => {
            const isChecked = Array.isArray(value) && value.includes(opt.value)
            return (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : []
                    const next = e.target.checked
                      ? [...current, opt.value]
                      : current.filter(v => v !== opt.value)
                    onChange(next)
                  }}
                  className="rounded border-brand-border"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  return null
}

// Example filters structure:
// const filters = [
//   {
//     id: 'status',
//     label: 'Status',
//     type: 'select',
//     options: [
//       { value: 'active', label: 'Active' },
//       { value: 'inactive', label: 'Inactive' },
//       { value: 'pending', label: 'Pending' }
//     ]
//   },
//   {
//     id: 'category',
//     label: 'Category',
//     type: 'multi',
//     options: [
//       { value: 'tech', label: 'Technology' },
//       { value: 'business', label: 'Business' },
//       { value: 'design', label: 'Design' }
//     ]
//   }
// ]
