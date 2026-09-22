// @system — Team grid. members[]: { name, role, bio, photo, links{linkedin,twitter,email} }.
// Missing photos render an initials avatar in brand colours.
import { Linkedin, Twitter, Mail } from 'lucide-react'
import { site } from '@/config'

const LINKS = {
  linkedin: { label: 'LinkedIn', icon: Linkedin, href: (v) => v },
  twitter: { label: 'Twitter / X', icon: Twitter, href: (v) => v },
  email: { label: 'Email', icon: Mail, href: (v) => (v.startsWith('mailto:') ? v : `mailto:${v}`) },
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function Team() {
  const team = site.team ?? {}
  const members = team.members ?? []

  return (
    <section id="team" aria-labelledby="team-title" className="scroll-mt-20 border-t border-brand-border bg-brand-surface py-16 sm:py-20 lg:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">Team</p>
          <h2 id="team-title" className="mt-3 text-3xl font-bold tracking-tight text-brand-text sm:text-4xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {team.title}
          </h2>
          {team.subtitle && <p className="mt-4 text-lg text-brand-text-secondary">{team.subtitle}</p>}
        </div>

        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4" role="list">
          {members.map((m) => {
            const links = Object.entries(m.links ?? {}).filter(([k, v]) => v && LINKS[k])
            return (
              <li key={m.name} className="flex flex-col items-start">
                {m.photo ? (
                  <img
                    src={m.photo}
                    alt={`Portrait of ${m.name}`}
                    loading="lazy"
                    className="aspect-square w-full rounded-xl border border-brand-border object-cover"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={`${m.name} (no photo)`}
                    className="flex aspect-square w-full items-center justify-center rounded-xl border border-brand-border bg-[linear-gradient(135deg,color-mix(in_srgb,var(--brand-primary)_30%,var(--brand-bg)),color-mix(in_srgb,var(--brand-accent)_30%,var(--brand-bg)))] text-4xl font-bold text-brand-primary"
                  >
                    {initials(m.name)}
                  </div>
                )}
                <h3 className="mt-4 text-lg font-semibold text-brand-text">{m.name}</h3>
                <p className="text-sm font-medium text-brand-primary">{m.role}</p>
                {m.bio && <p className="mt-2 text-sm leading-relaxed text-brand-text-secondary">{m.bio}</p>}
                {links.length > 0 && (
                  <ul className="mt-3 flex items-center gap-1" aria-label={`${m.name} links`}>
                    {links.map(([key, value]) => {
                      const { label, icon: Icon, href } = LINKS[key]
                      const url = href(value)
                      const ext = url.startsWith('http')
                      return (
                        <li key={key}>
                          <a
                            href={url}
                            aria-label={`${m.name} on ${label}`}
                            target={ext ? '_blank' : undefined}
                            rel={ext ? 'noopener noreferrer' : undefined}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-text-muted hover:bg-brand-surface-hover hover:text-brand-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default Team
