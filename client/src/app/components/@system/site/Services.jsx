// @system — Services grid. Each item: { icon (lucide name), title, description, href }.
import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { site } from '@/config'
import { SiteIcon } from './icons'
import { SmartCta } from './SmartLink'

export function Services() {
  const services = site.services ?? {}
  const items = services.items ?? []

  return (
    <section id="services" aria-labelledby="services-title" className="scroll-mt-20 border-t border-brand-border bg-brand-bg py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">Services</p>
          <h2 id="services-title" className="mt-3 text-3xl font-bold tracking-tight text-brand-text sm:text-4xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {services.title}
          </h2>
          {services.subtitle && <p className="mt-4 text-lg text-brand-text-secondary">{services.subtitle}</p>}
        </div>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {items.map((item) => {
            const inner = (
              <CardContent className="flex h-full flex-col p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                  <SiteIcon name={item.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-brand-text">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-text-secondary">{item.description}</p>
                {item.href && (
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-brand-primary">
                    Learn more
                    <ArrowUpRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </CardContent>
            )
            return (
              <li key={item.title}>
                <Card className="h-full border-brand-border bg-brand-surface transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-brand-primary">
                  {item.href ? (
                    <SmartCta href={item.href} className="block h-full rounded-[inherit] focus-visible:outline-none" aria-label={`${item.title} — learn more`}>
                      {inner}
                    </SmartCta>
                  ) : (
                    inner
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default Services
