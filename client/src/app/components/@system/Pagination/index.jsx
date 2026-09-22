// @system — Pagination component
// Responsive pagination with page numbers and navigation
//
// Usage:
// <Pagination
//   currentPage={1}
//   totalPages={10}
//   onPageChange={(page) => setPage(page)}
// />

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Button } from '../ui/button'

/**
 * Pagination — Page navigation component
 * @param {Object} props
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {Function} props.onPageChange - Page change handler
 * @param {number} [props.siblingCount=1] - Number of pages to show on each side
 * @param {boolean} [props.showFirstLast=true] - Show first/last page buttons
 * @param {string} [props.className] - Additional CSS classes
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  className,
}) {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const leftSibling = Math.max(currentPage - siblingCount, 1)
    const rightSibling = Math.min(currentPage + siblingCount, totalPages)

    // Always show first page
    if (showFirstLast) {
      pages.push(1)
      if (leftSibling > 2) {
        pages.push('...')
      }
    }

    // Add pages around current
    for (let i = leftSibling; i <= rightSibling; i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(i)
      }
    }

    // Always show last page
    if (showFirstLast && totalPages > 1) {
      if (rightSibling < totalPages - 1) {
        pages.push('...')
      }
      pages.push(totalPages)
    }

    return pages
  }

  const pages = getPageNumbers()

  return (
    <nav
      className={cn('flex items-center justify-center gap-1 sm:gap-2', className)}
      aria-label="Pagination"
    >
      {/* Previous button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="gap-1 h-10 sm:h-9 px-3 sm:px-3 touch-target"
      >
        <ChevronLeft className="h-4 w-4 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      {/* Page numbers */}
      <div className="flex items-center gap-1 sm:gap-1">
        {pages.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center text-brand-text-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
              </span>
            )
          }

          return (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-10 w-10 sm:h-9 sm:w-9 text-sm sm:text-sm touch-target"
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Button>
          )
        })}
      </div>

      {/* Next button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="gap-1 h-10 sm:h-9 px-3 sm:px-3 touch-target"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4" />
      </Button>
    </nav>
  )
}

/**
 * SimplePagination — Minimal prev/next pagination
 * @param {Object} props
 * @param {number} props.currentPage - Current page number
 * @param {number} props.totalPages - Total pages
 * @param {Function} props.onPageChange - Page change handler
 * @param {string} [props.className] - Additional CSS classes
 */
export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) {
  return (
    <nav className={cn('flex items-center justify-between gap-3 sm:gap-4', className)}>
      <Button
        variant="outline"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="gap-1 sm:gap-2 h-10 sm:h-9 px-3 sm:px-4 touch-target"
      >
        <ChevronLeft className="h-4 w-4 sm:h-4 sm:w-4" />
        <span className="hidden xs:inline sm:inline">Previous</span>
      </Button>

      <span className="text-xs sm:text-sm text-brand-text-muted font-medium">
        Page {currentPage} of {totalPages}
      </span>

      <Button
        variant="outline"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="gap-1 sm:gap-2 h-10 sm:h-9 px-3 sm:px-4 touch-target"
      >
        <span className="hidden xs:inline sm:inline">Next</span>
        <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4" />
      </Button>
    </nav>
  )
}
