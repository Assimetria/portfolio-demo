// @system — hooks for blog data fetching
// Provides useBlogPosts (index) and useBlogPost (single post by slug)
// Both use the api module; static BLOG_POSTS fallback lives in the page components.
import { useState, useEffect } from 'react'
import { api } from '../../lib/@system/api.js'

function apiPostToBlogPost(p) {
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
  }
}

/**
 * Fetch all blog posts from the API.
 * Returns { posts, loading } where posts is null until loaded (enables static fallback).
 */
export function useBlogPosts() {
  const [posts, setPosts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/blog')
      .then((data) => {
        if (data.posts?.length > 0) setPosts(data.posts.map(apiPostToBlogPost))
      })
      .catch(() => {
        // API unavailable — caller uses static fallback (posts stays null)
      })
      .finally(() => setLoading(false))
  }, [])

  return { posts, loading }
}

/**
 * Fetch a single blog post by slug from the API.
 * Returns { post, notFound, loading }:
 *   - post: mapped post object if found, null otherwise
 *   - notFound: true if the API confirmed the slug does not exist (show 404)
 *   - loading: true while the request is in flight
 * When post is null and notFound is false, caller may use static fallback.
 */
export function useBlogPost(slug) {
  const [post, setPost] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) { setLoading(false); return }
    api.get(`/blog/${slug}`)
      .then((data) => { if (data?.post) setPost(apiPostToBlogPost(data.post)) })
      .catch((err) => {
        const msg = (err.message ?? '').toLowerCase()
        if (msg.includes('not found') || msg.includes('404')) setNotFound(true)
        // Other errors: fall back to static (post stays null, notFound stays false)
      })
      .finally(() => setLoading(false))
  }, [slug])

  return { post, notFound, loading }
}
