// @system — Mobile-optimized table component with card view
// Provides a better mobile experience by displaying rows as cards
// Automatically switches between table and card view based on screen size
//
// Usage:
// <MobileTable
//   columns={[
//     { key: 'name', label: 'Name', mobileLabel: 'Name', primary: true },
//     { key: 'email', label: 'Email', mobileLabel: 'Email' },
//     { key: 'status', label: 'Status', render: (value) => <Badge>{value}</Badge> }
//   ]}
//   data={rows}
//   onRowClick={(row) => console.log(row)}
// />

import { cn } from '@/app/lib/@system/utils'
import { ChevronRight } from 'lucide-react'

/**
 * @typedef {Object} Column
 * @property {string} key - Data key
 * @property {string} label - Desktop label
 * @property {string} [mobileLabel] - Mobile label (defaults to label)
 * @property {boolean} [primary] - Primary field (highlighted on mobile)
 * @property {boolean} [hideOnMobile] - Hide this field on mobile
 * @property {(value: any, row: Object) => React.ReactNode} [render] - Custom render function
 * @property {string} [className] - Column CSS classes
 */

/**
 * MobileTable — Responsive table with mobile card view
 * @param {Object} props
 * @param {Column[]} props.columns - Table columns
 * @param {Object[]} props.data - Table data
 * @param {string} [props.keyField='id'] - Unique key field
 * @param {Function} [props.onRowClick] - Row click handler
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showRowNumber] - Show row numbers on mobile
 */
export function MobileTable({
  columns,
  data,
  keyField = 'id',
  onRowClick,
  className,
  showRowNumber = false,
}) {
  const primaryColumn = columns.find(col => col.primary) || columns[0]
  const mobileColumns = columns.filter(col => !col.hideOnMobile)

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop table view */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-brand-surface border-b">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      'text-left text-xs font-medium text-brand-text-muted uppercase tracking-wider px-4 py-3',
                      column.className
                    )}
                  >
                    {column.label}
                  </th>
                ))}
                {onRowClick && <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((row) => (
                <tr
                  key={row[keyField]}
                  className={cn(
                    'hover:bg-brand-surface-hover transition-colors',
                    onRowClick && 'cursor-pointer active:bg-brand-surface-active'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-sm">
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]}
                    </td>
                  ))}
                  {onRowClick && (
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-brand-text-muted" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {data.map((row, index) => (
          <div
            key={row[keyField]}
            className={cn(
              'rounded-lg border bg-brand-surface p-4 shadow-sm transition-all',
              onRowClick && 'cursor-pointer active:scale-[0.98] active:shadow-md'
            )}
            onClick={() => onRowClick?.(row)}
          >
            {/* Row number (optional) */}
            {showRowNumber && (
              <div className="text-xs text-brand-text-muted mb-2">
                #{index + 1}
              </div>
            )}

            {/* Primary field (larger, bold) */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-brand-text-muted mb-1">
                  {primaryColumn.mobileLabel || primaryColumn.label}
                </div>
                <div className="text-base font-semibold truncate">
                  {primaryColumn.render
                    ? primaryColumn.render(row[primaryColumn.key], row)
                    : row[primaryColumn.key]}
                </div>
              </div>
              {onRowClick && (
                <ChevronRight className="h-5 w-5 text-brand-text-muted shrink-0 mt-6" />
              )}
            </div>

            {/* Other fields (stacked) */}
            <div className="space-y-2">
              {mobileColumns
                .filter(col => col.key !== primaryColumn.key)
                .map((column) => (
                  <div key={column.key} className="flex justify-between gap-3 text-sm">
                    <span className="text-brand-text-muted shrink-0">
                      {column.mobileLabel || column.label}:
                    </span>
                    <span className="font-medium text-right truncate">
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
