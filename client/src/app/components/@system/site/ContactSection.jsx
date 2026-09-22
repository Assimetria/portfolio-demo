// @system — Contact section: intro + contact cards (email/phone/address/hours)
// + ContactForm + MapEmbed, each gated by site.features flags.
import { Mail, Phone, MapPin, Clock } from 'lucide-react'
import { site } from '@/config'
import { ContactForm } from './ContactForm'
import { MapEmbed } from './MapEmbed'

function InfoCard({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 rounded-lg border border-brand-border bg-brand-surface p-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-primary/10 text-brand-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-brand-text">{label}</p>
        <div className="mt-0.5 text-brand-text-secondary">{children}</div>
      </div>
    </div>
  )
}

export function ContactSection() {
  const contact = site.contact ?? {}
  const features = site.features ?? {}
  const lines = contact.address?.lines ?? []
  const hours = contact.hours ?? []
  const showForm = features.showContactForm !== false
  const showMap = features.showMap !== false

  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-20 border-t border-brand-border bg-brand-surface py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">Contact</p>
          <h2 id="contact-title" className="mt-3 text-3xl font-bold tracking-tight text-brand-text sm:text-4xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {contact.title}
          </h2>
          {contact.subtitle && <p className="mt-4 text-lg text-brand-text-secondary">{contact.subtitle}</p>}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            {contact.email && (
              <InfoCard icon={Mail} label="Email">
                <a href={`mailto:${contact.email}`} className="break-all hover:text-brand-primary hover:underline">
                  {contact.email}
                </a>
              </InfoCard>
            )}
            {contact.phone && (
              <InfoCard icon={Phone} label="Phone">
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="hover:text-brand-primary hover:underline">
                  {contact.phone}
                </a>
              </InfoCard>
            )}
            {lines.length > 0 && (
              <InfoCard icon={MapPin} label="Address">
                <address className="not-italic">
                  {lines.map((l, i) => (
                    <span key={i} className="block">
                      {l}
                    </span>
                  ))}
                </address>
              </InfoCard>
            )}
            {hours.length > 0 && (
              <InfoCard icon={Clock} label="Hours">
                <ul>
                  {hours.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </InfoCard>
            )}
          </div>

          <div className={showForm && showMap ? 'lg:col-span-8 grid gap-8 xl:grid-cols-2' : 'lg:col-span-8'}>
            {showForm && <ContactForm className="bg-brand-bg" />}
            {showMap && <MapEmbed className="bg-brand-bg" />}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ContactSection
