// @system — Individual blog post page with markdown-style rendering
// @custom — loads from /api/blog/:slug (DB-backed) with static fallback
import { useMemo, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Clock,
  Calendar,
  ArrowLeft,
  ChevronRight,
  Tag } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Footer } from '../../../../components/@system/Footer'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { OgMeta } from '../../../../components/@system/OgMeta'
import { BLOG_POSTS } from '../BlogPage'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso){
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric' })
}

// ── Minimal markdown renderer (same approach) ─────────────────

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

function InlineContent({ text }) {
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

// ── Related posts sidebar ─────────────────────────────────────────────────────

function RelatedPosts({ current }) {
  const related = BLOG_POSTS.filter(
    (p) => p.category === current.category && p.id !== current.id,
  ).slice(0, 4)

  if (related.length === 0) return null

  return (
    <aside className="space-y-3">
      <h3 className="text-sm font-semibold text-brand-text-muted uppercase tracking-wider">
        More in {current.category}
      </h3>
      <ul className="space-y-1">
        {related.map((p) => (
          <li key={p.id}>
            <Link
              to={`/blog/${p.slug}`}
              className="flex items-start gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-brand-surface-hover transition-colors group"
            >
              <ChevronRight className="h-3.5 w-3.5 text-brand-text-muted group-hover:text-brand-primary flex-shrink-0 mt-0.5" />
              <span className="group-hover:text-brand-primary line-clamp-2">{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/blog"
        className="flex items-center gap-1 text-xs text-brand-text-muted hover:text-brand-primary transition-colors mt-3"
      >
        ← All posts
      </Link>
    </aside>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────


function apiPostToBlogPost(p){
  return {
    id: String(p.id),
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? '',
    content: p.content,
    category: p.category,
    author: p.author,
    publishedAt: p.published_at ?? p.created_at,
    readingTime: p.reading_time,
    tags: p.tags ?? [],
    metaTitle: p.meta_title ?? null,
    metaDescription: p.meta_description ?? null,
  }
}

export function BlogPostPage() {
  const { slug } = useParams()

  const staticPost = useMemo(() => BLOG_POSTS.find((p) => p.slug === slug), [slug])
  const [apiPost, setApiPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) { setLoading(false); return }
    fetch(`/api/blog/${slug}`)
      .then((r) => {
        if (r.status === 404) { setApiPost('not-found'); return null }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data) => {
        if (data) setApiPost(apiPostToBlogPost(data.post))
      })
      .catch(() => {
        // Fall back to static data
      })
      .finally(() => setLoading(false))
  }, [slug])

  // Determine which post to display:
  // - If API returned 'not-found' and no static match → 404
  // - If API returned a post → use it
  // - If API unavailable (null after load) → fall back to static
  const post =
    apiPost === 'not-found'
      ? undefined
      : apiPost !== null
        ? apiPost
        : staticPost

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <Header />
        <div className="flex items-center justify-center py-32 text-brand-text-muted text-sm">
          Loading…
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <p className="text-5xl font-bold mb-4">404</p>
          <p className="text-brand-text-muted mb-8">Post not found.</p>
          <Link to="/blog">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <OgMeta
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        type="article"
        url={`${window.location.origin}/blog/${post.slug}`}
      />
      <Header />

      <main id="main-content" className="container mx-auto px-4 py-10 max-w-5xl">
        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-brand-text-muted mb-8">
          <Link to="/blog" className="hover:text-brand-text transition-colors">
            Blog
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="rounded-full bg-brand-primary/10 text-brand-primary px-2 py-0.5 font-medium">
            {post.category}
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-brand-text truncate max-w-[200px]">{post.title}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* ── Post body ─────────────────────────────────────────────────── */}
          <article className="flex-1 min-w-0">
            <header className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold leading-snug">{post.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-brand-text-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(post.publishedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {post.readingTime} min read
                </span>
                <span>{post.author}</span>
                {(post.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-brand-surface px-2 py-0.5 text-xs font-medium"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            <Card>
              <CardContent className="pt-6 pb-8">
                {renderContent(post.content)}
              </CardContent>
            </Card>

            <div className="mt-6">
              <Link
                to="/blog"
                className="flex items-center gap-2 text-sm text-brand-text-muted hover:text-brand-text transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Blog
              </Link>
            </div>
          </article>

          {/* ── Sidebar ─────────────────────────────────────────────────────── */}
          <aside className="lg:w-64 flex-shrink-0 space-y-8">
            <RelatedPosts current={post} />
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
