// @system — Site hero: eyebrow, title, subtitle, two CTAs, optional image.
// When hero.image.src is empty a decorative brand panel is rendered instead
// so the template looks complete before a product supplies a photo.
import { ArrowRight } from 'lucide-react'
import { Button } from '../ui/button'
import { site } from '@/config'
import { SmartCta } from './SmartLink'

export function Hero() {
  const hero = site.hero ?? {}
  const hasImage = Boolean(hero.image?.src)

  return (
    <section id="hero" aria-labelledby="hero-title" className="relative overflow-hidden bg-brand-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_color-mix(in_srgb,var(--brand-primary)_14%,transparent),transparent_55%)]"
      />
      <div className="container relative grid gap-10 py-16 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-28">
        <div className="lg:col-span-6 xl:col-span-6">
          {hero.eyebrow && (
            <p className="mb-4 inline-flex items-center rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-primary">
              {hero.eyebrow}
            </p>
          )}
          <h1
            id="hero-title"
            className="text-4xl font-bold leading-[1.1] tracking-tight text-brand-text sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {hero.title}
          </h1>
          {hero.subtitle && (
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-text-secondary sm:text-xl">{hero.subtitle}</p>
          )}
          {(hero.primaryCta?.label || hero.secondaryCta?.label) && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {hero.primaryCta?.label && (
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <SmartCta href={hero.primaryCta.href}>
                    {hero.primaryCta.label}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </SmartCta>
                </Button>
              )}
              {hero.secondaryCta?.label && (
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <SmartCta href={hero.secondaryCta.href}>{hero.secondaryCta.label}</SmartCta>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-6">
          {hasImage ? (
            <img
              src={hero.image.src}
              alt={hero.image.alt || ''}
              className="aspect-[4/3] w-full rounded-2xl border border-brand-border object-cover shadow-lg"
              loading="eager"
              fetchPriority="high"
            />
          ) : (
            <div
              role="img"
              aria-label={hero.image?.alt || ''}
              className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-lg"
            >
              <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-primary)_35%,transparent),color-mix(in_srgb,var(--brand-accent)_25%,transparent))]" />
              <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-brand-primary/30 blur-3xl" />
              <div className="absolute -bottom-16 -left-8 h-64 w-64 rounded-full bg-brand-accent/30 blur-3xl" />
              <div className="absolute inset-x-8 bottom-8 grid grid-cols-3 gap-3">
                {[0.9, 0.6, 0.75].map((h, i) => (
                  <div key={i} className="flex h-28 items-end rounded-lg bg-brand-bg/70 p-3 backdrop-blur">
                    <div className="w-full rounded bg-brand-primary/70" style={{ height: `${h * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default Hero
