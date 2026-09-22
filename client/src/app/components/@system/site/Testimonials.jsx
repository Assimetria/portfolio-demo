// @system — Testimonials. items[]: { quote, author, role, company, avatar, rating (0-5) }.
import { Star, Quote } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { site } from '@/config'

function Stars({ rating }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  if (!n) return null
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={i < n ? 'h-4 w-4 fill-[var(--color-warning)] text-[var(--color-warning)]' : 'h-4 w-4 text-brand-border'}
        />
      ))}
    </div>
  )
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

export function Testimonials() {
  const t = site.testimonials ?? {}
  const items = t.items ?? []

  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="scroll-mt-20 border-t border-brand-border bg-brand-bg py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">Testimonials</p>
          <h2 id="testimonials-title" className="mt-3 text-3xl font-bold tracking-tight text-brand-text sm:text-4xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {t.title}
          </h2>
          {t.subtitle && <p className="mt-4 text-lg text-brand-text-secondary">{t.subtitle}</p>}
        </div>

        <ul className="mt-12 grid gap-5 md:grid-cols-3" role="list">
          {items.map((item, i) => (
            <li key={`${item.author}-${i}`}>
              <Card className="h-full border-brand-border bg-brand-surface">
                <CardContent className="flex h-full flex-col p-6">
                  <Quote className="h-6 w-6 text-brand-primary/60" aria-hidden="true" />
                  <blockquote className="mt-4 flex-1 text-base leading-relaxed text-brand-text">
                    <p>“{item.quote}”</p>
                  </blockquote>
                  <Stars rating={item.rating} />
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-brand-border pt-5">
                    {item.avatar ? (
                      <img src={item.avatar} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/15 text-sm font-semibold text-brand-primary">
                        {initials(item.author)}
                      </span>
                    )}
                    <div className="text-sm">
                      <p className="font-semibold text-brand-text">{item.author}</p>
                      <p className="text-brand-text-muted">
                        {[item.role, item.company].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </figcaption>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default Testimonials
