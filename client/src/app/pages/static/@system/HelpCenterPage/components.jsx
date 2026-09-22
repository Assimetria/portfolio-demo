// @system — Help Center sub-components
import { Link } from 'react-router-dom'
import { Search, BookOpen, ChevronRight, FileText } from 'lucide-react'
import { Card, CardContent } from '../../../../components/@system/Card'
import { info } from '@/config'
import { HELP_CATEGORIES, HELP_ARTICLES } from './data'

// ── Sub-components ────────────────────────────────────────────────────────────

export function SearchBar({
  value,
  onChange }) {
  return (
    <div className="relative max-w-xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-text-muted pointer-events-none" />
      <input
        type="search"
        placeholder="Search articles…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border bg-brand-surface pl-12 pr-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-brand-text-muted"
        aria-label="Search help articles"
      />
    </div>
  )
}

export function CategoryGrid({ categories, onSelect }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map(({ id, title, description, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className="text-left group"
          aria-label={`Browse ${title}`}
        >
          <Card className="h-full transition-shadow group-hover:shadow-md group-hover:border-primary/40">
            <CardContent className="pt-6 flex flex-col gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
                <Icon className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base group-hover:text-brand-primary transition-colors">{title}</h3>
                <p className="mt-1 text-sm text-brand-text-muted">{description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-brand-primary font-medium mt-auto">
                Browse articles <ChevronRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  )
}

export function ArticleRow({ article }) {
  return (
    <Link
      to={`/help/${article.slug}`}
      className="flex items-start justify-between gap-4 py-4 border-b last:border-b-0 hover:bg-brand-surface-hover/40 -mx-4 px-4 rounded-lg transition-colors group"
    >
      <div className="flex items-start gap-3 min-w-0">
        <FileText className="h-4 w-4 text-brand-text-muted mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm group-hover:text-brand-primary transition-colors truncate">{article.title}</p>
          <p className="text-xs text-brand-text-muted mt-0.5 line-clamp-2">{article.excerpt}</p>
        </div>
      </div>
      <span className="text-xs text-brand-text-muted flex-shrink-0">{article.readingTime} min</span>
    </Link>
  )
}

export function PopularArticles({ articles }) {
  const popular = articles.slice(0, 5)
  return (
    <section className="mt-16">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="h-5 w-5 text-brand-primary" />
        <h2 className="text-xl font-semibold">Popular articles</h2>
      </div>
      <Card>
        <CardContent className="pt-2 pb-2">
          {popular.map((a) => (
            <ArticleRow key={a.id} article={a} />
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

export function SearchResults({ articles, query }) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="h-10 w-10 text-brand-text-muted mx-auto mb-4" />
        <p className="text-lg font-medium">No results for "{query}"</p>
        <p className="text-sm text-brand-text-muted mt-2">
          Try different keywords or{' '}
          <a href={`mailto:${info.supportEmail}`} className="text-brand-primary underline underline-offset-4">
            contact support
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <section className="mt-10">
      <p className="text-sm text-brand-text-muted mb-4">
        {articles.length} result{articles.length !== 1 ? 's' : ''} for "{query}"
      </p>
      <Card>
        <CardContent className="pt-2 pb-2">
          {articles.map((a) => (
            <ArticleRow key={a.id} article={a} />
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

export function CategoryArticleList({
  categoryId,
  onBack }) {
  const category = HELP_CATEGORIES.find((c) => c.id === categoryId)
  const articles = HELP_ARTICLES.filter((a) => a.categoryId === categoryId)

  if (!category) return null

  const Icon = category.icon

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-brand-text-muted hover:text-brand-text mb-6 transition-colors"
      >
        ← All categories
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
          <Icon className="h-5 w-5 text-brand-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{category.title}</h2>
          <p className="text-sm text-brand-text-muted">{category.description}</p>
        </div>
      </div>

      {articles.length === 0 ? (
        <p className="text-sm text-brand-text-muted">No articles in this category yet.</p>
      ) : (
        <Card>
          <CardContent className="pt-2 pb-2">
            {articles.map((a) => (
              <ArticleRow key={a.id} article={a} />
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
