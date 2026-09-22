// @system — Help Center / Knowledge Base page
// @custom — update CATEGORIES and ARTICLES with your product's real content
import { useState, useMemo } from 'react'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'
import { cn } from '../../../../lib/@system/utils'
import { HELP_CATEGORIES, HELP_ARTICLES, searchArticles } from './data'
import {
  SearchBar,
  CategoryGrid,
  PopularArticles,
  SearchResults,
  CategoryArticleList } from './components'

export { HELP_CATEGORIES, HELP_ARTICLES } from './data'

// ── Page ───────────────────────────────────────────────────────────────────────

export function HelpCenterPage() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)

  const searchResults = useMemo(
    () => searchArticles(HELP_ARTICLES, query),
    [query],
  )

  const isSearching = query.trim().length > 0

  const categoriesWithCount = HELP_CATEGORIES.map((c) => ({
    ...c,
    articleCount: HELP_ARTICLES.filter((a) => a.categoryId === c.id).length }))

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero / Search ───────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">How can we help?</h1>
          <p className="text-brand-text-muted mb-8">
            Search our knowledge base or browse categories below.
          </p>
          <SearchBar value={query} onChange={(v) => { setQuery(v); setSelectedCategory(null) }} />
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main id="main-content" className="container mx-auto px-4 py-12 max-w-5xl">
        {isSearching ? (
          <SearchResults articles={searchResults} query={query} />
        ) : selectedCategory ? (
          <CategoryArticleList
            categoryId={selectedCategory}
            onBack={() => setSelectedCategory(null)}
          />
        ) : (
          <>
            {/* Categories */}
            <section>
              <h2 className="text-xl font-semibold mb-6">Browse by category</h2>
              <CategoryGrid categories={categoriesWithCount} onSelect={setSelectedCategory} />
            </section>

            {/* Popular articles */}
            <PopularArticles articles={HELP_ARTICLES} />
          </>
        )}
      </main>

      {/* ── Contact CTA ─────────────────────────────────────────────────────── */}
      <section className={cn('border-t bg-brand-surface mt-8', isSearching && searchResults.length === 0 ? 'mt-0' : '')}>
        <div className="container mx-auto px-4 py-12 max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-xl border bg-brand-surface p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 flex-shrink-0">
                <MessageCircle className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Still need help?</h3>
                <p className="text-sm text-brand-text-muted mt-1">
                  Our support team is available Monday–Friday, 9am–6pm UTC.
                </p>
              </div>
            </div>
            <a href={`mailto:${info.supportEmail}`}>
              <Button className="gap-2 flex-shrink-0">
                Contact Support <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-text-muted">
          <p>© {new Date().getFullYear()} {info.name}. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/" className="hover:text-brand-text">Home</a>
            <a href="/privacy" className="hover:text-brand-text">Privacy</a>
            <a href="/terms" className="hover:text-brand-text">Terms</a>
            <a href={`mailto:${info.supportEmail}`} className="hover:text-brand-text">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
