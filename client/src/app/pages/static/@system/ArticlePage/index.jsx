// @system — Individual help article page with markdown-style rendering
// @custom — wire up to a real CMS or API by replacing the HELP_ARTICLES import
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Clock,
  ChevronRight,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Header } from '../../../../components/@system/Header'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'
import {
  HELP_ARTICLES,
  HELP_CATEGORIES } from '../HelpCenterPage'

// ── Markdown-style renderer ──────────────────────────────────────────────────
// Renders a minimal subset: headings, paragraphs, code blocks, inline code,
// bold, and unordered lists. For full markdown support, swap this for
// react-markdown or similar.

function renderContent(raw) {
  const blocks = raw.split(/\n\n+/)

  return (
    <div className="prose prose-sm sm:prose max-w-none dark:prose-invert">
      {blocks.map((block, i) => {
        // Fenced code block
        if (block.startsWith('```')) {
          const lines = block.split('\n')
          const lang = lines[0].replace('```', '').trim()
          const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n')
          return (
            <pre key={i} className="rounded-lg bg-brand-surface p-4 overflow-x-auto text-sm font-mono border my-4">
              {lang && <span className="block text-xs text-brand-text-muted mb-2">{lang}</span>}
              <code>{code}</code>
            </pre>
          )
        }

        // H2
        if (block.startsWith('## ')) {
          return (
            <h2 key={i} className="text-xl font-bold mt-8 mb-3">
              {block.replace('## ', '')}
            </h2>
          )
        }

        // H3
        if (block.startsWith('### ')) {
          return (
            <h3 key={i} className="text-base font-semibold mt-6 mb-2">
              {block.replace('### ', '')}
            </h3>
          )
        }

        // Unordered list
        if (block.includes('\n-') || block.startsWith('- ')) {
          const items = block.split('\n').filter((l) => l.startsWith('- '))
          return (
            <ul key={i} className="list-disc pl-5 space-y-1 my-3">
              {items.map((item, j) => (
                <li key={j} className="text-sm text-brand-text">
                  <InlineContent text={item.replace(/^- /, '')} />
                </li>
              ))}
            </ul>
          )
        }

        // Numbered list
        if (/^\d+\./.test(block)) {
          const items = block.split('\n').filter((l) => /^\d+\./.test(l))
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1 my-3">
              {items.map((item, j) => (
                <li key={j} className="text-sm text-brand-text">
                  <InlineContent text={item.replace(/^\d+\.\s*/, '')} />
                </li>
              ))}
            </ol>
          )
        }

        // Regular paragraph
        return (
          <p key={i} className="text-sm text-brand-text leading-relaxed my-3">
            <InlineContent text={block} />
          </p>
        )
      })}
    </div>
  )
}

/** Renders inline formatting: **bold**, `inline code`, [link](href) */
function InlineContent({ text }) {
  // Tokenise the line into segments
  const tokens = []
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) tokens.push(text.slice(last, match.index))

    if (match[1].startsWith('**')) {
      tokens.push(<strong key={match.index}>{match[2]}</strong>)
    } else if (match[1].startsWith('`')) {
      tokens.push(
        <code key={match.index} className="rounded bg-brand-surface px-1 py-0.5 font-mono text-xs">
          {match[3]}
        </code>,
      )
    } else {
      // Link
      tokens.push(
        <a key={match.index} href={match[5]} className="text-brand-primary underline underline-offset-4 hover:opacity-80">
          {match[4]}
        </a>,
      )
    }

    last = match.index + match[0].length
  }

  if (last < text.length) tokens.push(text.slice(last))

  return <>{tokens}</>
}

// ── Related articles sidebar ──────────────────────────────────────────────────

function RelatedArticles({ current }) {
  const related = HELP_ARTICLES.filter(
    (a) => a.categoryId === current.categoryId && a.id !== current.id,
  ).slice(0, 4)

  if (related.length === 0) return null

  return (
    <aside className="space-y-3">
      <h3 className="text-sm font-semibold text-brand-text-muted uppercase tracking-wider">
        More in this category
      </h3>
      <ul className="space-y-1">
        {related.map((a) => (
          <li key={a.id}>
            <Link
              to={`/help/${a.slug}`}
              className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-brand-surface-hover transition-colors group"
            >
              <ChevronRight className="h-3.5 w-3.5 text-brand-text-muted group-hover:text-brand-primary flex-shrink-0" />
              <span className="group-hover:text-brand-primary">{a.title}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/help"
        className="flex items-center gap-1 text-xs text-brand-text-muted hover:text-brand-primary transition-colors mt-3"
      >
        ← All articles
      </Link>
    </aside>
  )
}

// ── Helpfulness feedback ──────────────────────────────────────────────────────

function ArticleFeedback({ articleId }) {
  const [voted, setVoted] = useState(null)

  return (
    <div className="border-t pt-8 mt-10">
      <p className="text-sm font-medium text-center mb-4">Was this article helpful?</p>
      <div className="flex items-center justify-center gap-3">
        <Button
          variant={voted === 'up' ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => setVoted('up')}
          disabled={voted !== null}
          aria-label="Yes, this was helpful"
        >
          <ThumbsUp className="h-4 w-4" />
          Yes
        </Button>
        <Button
          variant={voted === 'down' ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => setVoted('down')}
          disabled={voted !== null}
          aria-label="No, this was not helpful"
        >
          <ThumbsDown className="h-4 w-4" />
          No
        </Button>
      </div>

      {voted && (
        <p className="text-xs text-brand-text-muted text-center mt-4">
          {voted === 'up'
            ? 'Thanks for the feedback!'
            : `Sorry to hear that. `}
          {voted === 'down' && (
            <a href={`mailto:${info.supportEmail}`} className="text-brand-primary underline underline-offset-4">
              Contact support
            </a>
          )}
        </p>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function ArticlePage() {
  const { slug } = useParams()

  const article = useMemo(() => HELP_ARTICLES.find((a) => a.slug === slug), [slug])
  const category = useMemo(
    () => (article ? HELP_CATEGORIES.find((c) => c.id === article.categoryId) : null),
    [article],
  )

  // 404 state
  if (!article) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <p className="text-5xl font-bold mb-4">404</p>
          <p className="text-brand-text-muted mb-8">Article not found.</p>
          <Link to="/help">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Help Center
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content" className="container mx-auto px-4 py-10 max-w-5xl">
        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-brand-text-muted mb-8">
          <Link to="/help" className="hover:text-brand-text transition-colors">
            Help Center
          </Link>
          {category && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link to="/help" className="hover:text-brand-text transition-colors">
                {category.title}
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-brand-text truncate max-w-[200px]">{article.title}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* ── Article body ─────────────────────────────────────────────── */}
          <article className="flex-1 min-w-0">
            {/* Header */}
            <header className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold leading-snug">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-brand-text-muted">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {article.readingTime} min read
                </span>
                {category && <span>{category.title}</span>}
                {(article.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            {/* Content */}
            <Card>
              <CardContent className="pt-6 pb-8">
                {renderContent(article.content)}
                <ArticleFeedback articleId={article.id} />
              </CardContent>
            </Card>

            {/* Back link */}
            <div className="mt-6">
              <Link
                to="/help"
                className="flex items-center gap-2 text-sm text-brand-text-muted hover:text-brand-text transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Help Center
              </Link>
            </div>
          </article>

          {/* ── Sidebar ────────────────────────────────────────────────────── */}
          <aside className="lg:w-64 flex-shrink-0 space-y-8">
            <RelatedArticles current={article} />

            {/* Contact CTA */}
            <Card>
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-brand-primary" />
                  <span className="text-sm font-semibold">Need more help?</span>
                </div>
                <p className="text-xs text-brand-text-muted leading-relaxed">
                  Our team is here for you. Reach out anytime.
                </p>
                <a href={`mailto:${info.supportEmail}`} className="block">
                  <Button size="sm" className="w-full gap-2">
                    Contact Support <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-text-muted">
          <p>© {new Date().getFullYear()} {info.name}. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/" className="hover:text-brand-text">Home</a>
            <a href="/help" className="hover:text-brand-text">Help Center</a>
            <a href={`mailto:${info.supportEmail}`} className="hover:text-brand-text">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
