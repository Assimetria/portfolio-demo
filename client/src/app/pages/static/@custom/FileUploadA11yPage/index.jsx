// @custom — File-Upload Accessibility Standards research page
import { useState, useMemo } from 'react'
import { Header } from '@/app/components/@system/Header'
import { info } from '@/config'
import { A11Y_STANDARDS, A11Y_CATEGORIES, filterByCategory, searchStandards } from './data'
import { A11ySearchBar, CategoryFilter, A11yAccordionList } from './components'

export function FileUploadA11yPage() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)

  const filtered = useMemo(() => {
    const byCategory = filterByCategory(A11Y_STANDARDS, selectedCategory)
    return searchStandards(byCategory, query)
  }, [query, selectedCategory])

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero / Search ──────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">
            File-Upload Accessibility Standards
          </h1>
          <p className="text-brand-text-muted mb-8 max-w-2xl mx-auto">
            Researched WCAG criteria, ARIA attributes, and best practices for
            building accessible file-upload components. Covers keyboard
            operability, focus management, screen reader announcements, drag-and-drop
            alternatives, error identification, and mobile considerations.
          </p>
          <A11ySearchBar value={query} onChange={setQuery} />
        </div>
      </section>

      {/* ── Categories ─────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-6">
        <CategoryFilter
          categories={A11Y_CATEGORIES}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      </section>

      {/* ── Standards List ──────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 pb-16 max-w-3xl">
        {filtered.length > 0 && (
          <p className="text-sm text-brand-text-muted mb-4">
            Showing {filtered.length} of {A11Y_STANDARDS.length} standard{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
        <A11yAccordionList items={filtered} />
      </section>
    </div>
  )
}