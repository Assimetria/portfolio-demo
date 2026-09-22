// @system — Advanced data table with sorting, filtering, and pagination
// Feature-rich table for displaying and managing tabular data
//
// Usage:
// <DataTable
//   columns={[
//     { key: 'name', label: 'Name', sortable: true },
//     { key: 'email', label: 'Email' },
//     { key: 'status', label: 'Status', render: (value) => <Badge>{value}</Badge> }
//   ]}
//   data={rows}
//   searchable
//   paginated
// />

import { useState, useMemo, useEffect } from 'react'
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Table } from '../../Table'
import { Button } from '../../Button'
import { Select } from '../../Select'
import { EmptyState } from '../../EmptyState'
import { cn } from '@/app/lib/@system/utils'

/**
 * @typedef {Object} Column
 * @property {string} key - Data key
 * @property {string} label - Column header label
 * @property {boolean} [sortable] - Enable sorting
 * @property {(value: any, row: Object) => React.ReactNode} [render] - Custom render function
 * @property {string} [className] - Column CSS classes
 * @property {string} [width] - Column width
 */

/**
 * DataTable — Advanced data table component
 * @param {Object} props
 * @param {Column[]} props.columns - Table columns
 * @param {Object[]} props.data - Table data
 * @param {string} [props.keyField='id'] - Unique key field
 * @param {boolean} [props.searchable=false] - Enable search
 * @param {string[]} [props.searchFields] - Fields to search (defaults to all)
 * @param {boolean} [props.paginated=false] - Enable pagination
 * @param {number} [props.pageSize=10] - Items per page
 * @param {boolean} [props.loading=false] - Loading state
 * @param {React.ReactNode} [props.emptyState] - Custom empty state
 * @param {Function} [props.onRowClick] - Row click handler
 * @param {string} [props.className] - Additional CSS classes
 */
export function DataTable({
  columns,
  data,
  keyField = 'id',
  searchable = false,
  searchFields,
  paginated = false,
  pageSize: initialPageSize = 10,
  loading = false,
  emptyState,
  onRowClick,
  className,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Sorting
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  // Filtering and sorting
  const processedData = useMemo(() => {
    let result = [...data]

    // Search
    if (searchable && searchQuery) {
      const query = searchQuery.toLowerCase()
      const fields = searchFields || columns.map((col) => col.key)
      result = result.filter((row) =>
        fields.some((field) =>
          String(row[field] || '').toLowerCase().includes(query)
        )
      )
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        if (aVal === bVal) return 0
        const comparison = aVal < bVal ? -1 : 1
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, searchQuery, searchFields, columns, sortKey, sortDirection, searchable])

  // Pagination
  const paginatedData = useMemo(() => {
    if (!paginated) return processedData
    const start = (currentPage - 1) * pageSize
    return processedData.slice(start, start + pageSize)
  }, [processedData, paginated, currentPage, pageSize])

  const totalPages = Math.ceil(processedData.length / pageSize)

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  if (loading) {
    return <DataTableSkeleton columns={columns} rows={5} />
  }

  const displayData = paginated ? paginatedData : processedData

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search bar */}
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-9 pr-4 py-2 sm:py-2.5 rounded-lg border border-brand-border bg-brand-bg text-sm sm:text-base',
              'placeholder:text-brand-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2'
            )}
          />
        </div>
      )}

      {/* Table */}
      {displayData.length === 0 ? (
        emptyState || (
          <EmptyState
            title={searchQuery ? 'No results found' : 'No data'}
            description={searchQuery ? 'Try adjusting your search' : 'No items to display'}
          />
        )
      ) : (
        // Horizontal scroll wrapper for mobile
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <Table>
                <Table.Header>
                  <Table.Row>
                    {columns.map((column) => (
                      <Table.Head
                        key={column.key}
                        className={cn(
                          column.sortable && 'cursor-pointer select-none hover:bg-brand-surface-hover',
                          column.className
                        )}
                        style={{ width: column.width }}
                        onClick={() => column.sortable && handleSort(column.key)}
                      >
                        <div className="flex items-center gap-2">
                          {column.label}
                          {column.sortable && (
                            <span className="flex flex-col">
                              <ChevronUp
                                className={cn(
                                  'h-3 w-3 -mb-1',
                                  sortKey === column.key && sortDirection === 'asc'
                                    ? 'text-brand-primary'
                                    : 'text-[var(--brand-border)]'
                                )}
                              />
                              <ChevronDown
                                className={cn(
                                  'h-3 w-3',
                                  sortKey === column.key && sortDirection === 'desc'
                                    ? 'text-brand-primary'
                                    : 'text-[var(--brand-border)]'
                                )}
                              />
                            </span>
                          )}
                        </div>
                      </Table.Head>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {displayData.map((row) => (
                    <Table.Row
                      key={row[keyField]}
                      className={onRowClick && 'cursor-pointer hover:bg-brand-surface-hover active:bg-brand-surface-active'}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((column) => (
                        <Table.Cell key={column.key} className={column.className}>
                          {column.render
                            ? column.render(row[column.key], row)
                            : row[column.key]}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {paginated && displayData.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Rows per page selector */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-brand-text-muted whitespace-nowrap">Rows per page:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setCurrentPage(1)
              }}
              options={[
                { value: '10', label: '10' },
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
              ]}
            />
          </div>

          {/* Page navigation */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span className="text-sm text-brand-text-muted whitespace-nowrap">
              {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, processedData.length)} of{' '}
              {processedData.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="min-w-[40px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="min-w-[40px]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * DataTableSkeleton — Loading skeleton
 * @private
 */
function DataTableSkeleton({ columns, rows = 5 }) {
  return (
    <div className="rounded-lg border overflow-hidden animate-pulse">
      <div className="p-4 border-b bg-brand-surface">
        <div className="flex gap-4">
          {columns.map((col, i) => (
            <div key={i} className="h-4 bg-brand-surface rounded flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-b last:border-0">
          <div className="flex gap-4">
            {columns.map((col, j) => (
              <div key={j} className="h-4 bg-brand-surface rounded flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
