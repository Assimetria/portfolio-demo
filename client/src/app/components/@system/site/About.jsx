// @system — About section: title, paragraphs, highlight stats, optional image.
import { site } from '@/config'

export function About() {
  const about = site.about ?? {}
  const body = about.body ?? []
  const highlights = about.highlights ?? []
  const hasImage = Boolean(about.image?.src)

  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-20 border-t border-brand-border bg-brand-surface py-16 sm:py-20 lg:py-24">
      <div className="container grid gap-12 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">About</p>
          <h2 id="about-title" className="mt-3 text-3xl font-bold tracking-tight text-brand-text sm:text-4xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {about.title}
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-brand-text-secondary sm:text-lg">
            {body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {highlights.length > 0 && (
            <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {highlights.map((h) => (
                <div key={h.label} className="rounded-lg border border-brand-border bg-brand-bg p-4">
                  <dt className="order-2 text-xs font-medium text-brand-text-muted">{h.label}</dt>
                  <dd className="order-1 text-2xl font-bold tracking-tight text-brand-text sm:text-3xl">{h.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="lg:col-span-5">
          {hasImage ? (
            <img
              src={about.image.src}
              alt={about.image.alt || ''}
              loading="lazy"
              className="aspect-[4/5] w-full rounded-2xl border border-brand-border object-cover shadow-md"
            />
          ) : (
            <div
              role="img"
              aria-label={about.image?.alt || ''}
              className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-brand-border bg-brand-bg shadow-md"
            >
              <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent_0_14px,color-mix(in_srgb,var(--brand-primary)_10%,transparent)_14px_16px)]" />
              <div className="absolute inset-x-6 top-6 h-2 w-1/2 rounded bg-brand-primary/50" />
              <div className="absolute inset-x-6 top-12 h-2 w-3/4 rounded bg-brand-primary/30" />
              <div className="absolute inset-x-6 top-18 h-2 w-2/3 rounded bg-brand-primary/20" style={{ top: '4.5rem' }} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default About
