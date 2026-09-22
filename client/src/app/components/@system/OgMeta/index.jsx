// @system — OG / social meta tags injector for the document <head>
// @custom — Pass your own props per page; falls back to info config values
//
// Usage:
//   <OgMeta title="My Page" description="..." image="https://..." />
//
// Props all optional — omit to use the product defaults from info.ts
import { useEffect } from 'react'
import { info } from '@/config'


function setMeta(property, content, attr = 'property') {
  let el = document.querySelector(`meta[${attr}="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeMeta(property, attr = 'property') {
  const el = document.querySelector(`meta[${attr}="${property}"]`)
  if (el) el.remove()
}

export function OgMeta({
  title,
  description,
  image,
  url,
  type = 'website',
  twitterCard = 'summary_large_image' }) {
  useEffect(() => {
    const resolvedTitle = title ?? info.name
    const resolvedUrl = url ?? (window.location.origin + window.location.pathname)
    const resolvedDescription = description ?? ''

    // <title>
    document.title = resolvedTitle

    // standard meta
    if (resolvedDescription) setMeta('description', resolvedDescription, 'name')

    // Open Graph
    setMeta('og:type', type)
    setMeta('og:title', resolvedTitle)
    setMeta('og:url', resolvedUrl)
    if (resolvedDescription) setMeta('og:description', resolvedDescription)
    if (image) setMeta('og:image', image)

    // Twitter / X
    setMeta('twitter:card', twitterCard, 'name')
    setMeta('twitter:title', resolvedTitle, 'name')
    setMeta('twitter:url', resolvedUrl, 'name')
    if (resolvedDescription) setMeta('twitter:description', resolvedDescription, 'name')
    if (image) setMeta('twitter:image', image, 'name')

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', resolvedUrl)

    return () => {
      // Restore title on unmount
      document.title = info.name
      // Remove tags that may bleed across pages
      removeMeta('og:type')
      removeMeta('og:title')
      removeMeta('og:url')
      removeMeta('og:description')
      removeMeta('og:image')
      removeMeta('twitter:card', 'name')
      removeMeta('twitter:title', 'name')
      removeMeta('twitter:url', 'name')
      removeMeta('twitter:description', 'name')
      removeMeta('twitter:image', 'name')
    }
  }, [title, description, image, url, type, twitterCard])

  return null
}
