// @system — Blog helpers: API shape mapping, date formatting, filtering

// ── API shape (mirrors DB) ────────────────────────────────────────────────────

export function apiPostToBlogPost(p){
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
    tags: p.tags ?? [] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatDate(iso){
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric' })
}

export function filterPosts(posts, category, query){
  let filtered = posts
  if (category !== 'All') {
    filtered = filtered.filter((p) => p.category === category)
  }
  if (query.trim()) {
    const q = query.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    )
  }
  return filtered
}
