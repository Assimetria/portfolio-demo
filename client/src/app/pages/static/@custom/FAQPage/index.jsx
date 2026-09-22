// @custom — FAQ Page for localization common issues
import { useState, useMemo } from 'react'
import { Header } from '@/app/components/@system/Header'
import { info } from '@/config'
import { FAQ_ITEMS, FAQ_CATEGORIES, filterByCategory, searchFAQ } from './data'
import { FaqSearchBar, CategoryFilter, FaqAccordionList } from './components'

export function FAQPage() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)

  const filtered = useMemo(() => {
    const byCategory = filterByCategory(FAQ_ITEMS, selectedCategory)
    return searchFAQ(byCategory, query)
  }, [query, selectedCategory])

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero / Search ───────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">
            Localization FAQ
          </h1>
          <p className="text-brand-text-muted mb-8 max-w-2xl mx-auto">
            Frequently asked questions about handling localization and
            internationalization in your web projects. Find answers to common
            issues with character encoding, date formatting, RTL support, and
            more.
          </p>
          <FaqSearchBar value={query} onChange={(v) => { setQuery(v); setSelectedCategory(null) }} />
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main id="main-content" className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Category filters */}
        <div className="mb-10">
          <CategoryFilter
            categories={FAQ_CATEGORIES}
            selected={selectedCategory}
            onSelect={(cat) => { setSelectedCategory(cat); setQuery('') }}
          />
        </div>

        {/* FAQ accordion */}
        <section>
          <FaqAccordionList items={filtered} />
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-text-muted">
          <p>&copy; {new Date().getFullYear()} {info.name}. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/" className="hover:text-brand-text">Home</a>
            <a href="/privacy" className="hover:text-brand-text">Privacy</a>
            <a href="/terms" className="hover:text-brand-text">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default FAQPage