// @system — Blog post card sub-components (grid PostCard + FeaturedPost)
import { Link } from 'react-router-dom'
import { Calendar, Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '../../../../components/@system/Card'
import { formatDate } from './helpers'

export function PostCard({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md group-hover:border-primary/40">
        <CardContent className="pt-5 pb-6 flex flex-col gap-3 h-full">
          {/* Category + date */}
          <div className="flex items-center justify-between gap-2 text-xs text-brand-text-muted">
            <span className="rounded-full bg-brand-primary/10 text-brand-primary px-2.5 py-0.5 font-medium">
              {post.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(post.publishedAt)}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-base font-semibold leading-snug group-hover:text-brand-primary transition-colors line-clamp-2">
            {post.title}
          </h2>

          {/* Excerpt */}
          <p className="text-sm text-brand-text-muted leading-relaxed line-clamp-3 flex-1">
            {post.excerpt}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 mt-1 text-xs text-brand-text-muted">
            <span>{post.author}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readingTime} min read
            </span>
          </div>

          {/* Read more */}
          <div className="flex items-center gap-1 text-xs text-brand-primary font-medium mt-auto pt-1">
            Read more <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function FeaturedPost({ post }) {
  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <Card className="transition-shadow group-hover:shadow-md group-hover:border-primary/40">
        <CardContent className="pt-6 pb-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 text-xs text-brand-text-muted">
            <span className="rounded-full bg-brand-primary/10 text-brand-primary px-2.5 py-0.5 font-medium">
              {post.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(post.publishedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readingTime} min read
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold leading-snug group-hover:text-brand-primary transition-colors">
            {post.title}
          </h2>

          <p className="text-brand-text-muted leading-relaxed">{post.excerpt}</p>

          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-sm text-brand-text-muted">{post.author}</span>
            <div className="flex items-center gap-1 text-sm text-brand-primary font-medium">
              Read article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
