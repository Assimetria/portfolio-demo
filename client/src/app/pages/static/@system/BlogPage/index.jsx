// @system — Blog index page: post grid + category filter + search
// @custom — posts load from /api/blog (DB-backed via admin panel). BLOG_POSTS is a fallback.
import { useState, useMemo, useEffect } from 'react'
import { Search, Tag, BookOpen } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Button } from '../../../../components/@system/ui/button'
import { Input } from '../../../../components/@system/ui/input'
import { text } from '@/config'
import { cn } from '../../../../lib/@system/utils'
import { BLOG_CATEGORIES, BLOG_POSTS } from './data'
import { apiPostToBlogPost, filterPosts } from './helpers'
import { PostCard, FeaturedPost } from './PostCards'

// Re-export data so downstream imports (e.g. BlogPostPage) keep working.
export { BLOG_CATEGORIES, BLOG_POSTS }

const bt = text.blog ?? {}

// ── Page ───────────────────────────────────────────────────────────────────────

export function BlogPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [apiPosts, setApiPosts] = useState(null)

  // Load posts from API; fall back to static seed data if API unavailable
  useEffect(() => {
    fetch('/api/blog')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data.posts && data.posts.length > 0) {
          setApiPosts(data.posts.map(apiPostToBlogPost))
        }
      })
      .catch(() => {
        // API unavailable — static fallback will be used
      })
  }, [])

  const allPosts = apiPosts ?? BLOG_POSTS

  const sorted = useMemo(
    () => [...allPosts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [allPosts],
  )

  const filtered = useMemo(
    () => filterPosts(sorted, activeCategory, query),
    [sorted, activeCategory, query],
  )

  const [featured, ...rest] = filtered

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-16 text-center max-w-3xl">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10">
              <BookOpen className="h-6 w-6 text-brand-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3">{bt.title ?? 'Blog'}</h1>
          <p className="text-brand-text-muted text-lg">
            {bt.subtitle ?? 'Product updates, engineering deep-dives, design thinking, and more.'}
          </p>
        </div>
      </section>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <section className="border-b bg-brand-bg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 max-w-5xl flex flex-col sm:flex-row items-center gap-3">
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {BLOG_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeCategory === cat
                    ? 'bg-brand-primary text-brand-text-on-primary'
                    : 'bg-brand-surface text-brand-text-muted hover:bg-brand-surface-hover/80 hover:text-brand-text',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-text-muted pointer-events-none" />
            <Input
              type="search"
              placeholder="Search posts…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveCategory('All') }}
              className="pl-9 h-8"
              aria-label="Search blog posts"
            />
          </div>
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main id="main-content" className="container mx-auto px-4 py-12 max-w-5xl">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <Tag className="h-10 w-10 text-brand-text-muted mx-auto mb-4" />
            <p className="text-lg font-medium">No posts found</p>
            <p className="text-sm text-brand-text-muted mt-2">
              Try a different category or search term.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-6"
              onClick={() => { setQuery(''); setActiveCategory('All') }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            {/* Featured post (first result) */}
            {featured && (
              <section className="mb-10">
                <FeaturedPost post={featured} />
              </section>
            )}

            {/* Rest of posts in grid */}
            {rest.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-brand-text-muted uppercase tracking-wider mb-5">
                  More posts
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
