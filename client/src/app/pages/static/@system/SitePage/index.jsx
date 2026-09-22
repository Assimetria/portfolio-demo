// @system — Informational website home page.
// Composes the site sections in order, each gated by site.features flags:
//   Hero → About → Services → Team → Testimonials → Contact (+Map) → Footer
// Content lives in content/@system/site.js (override in content/@custom/site.js).
// Products that need a different composition edit pages/static/@custom/SitePage.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { OgMeta } from '../../../../components/@system/OgMeta'
import { SiteNavbar } from '../../../../components/@system/site/SiteNavbar'
import { Hero } from '../../../../components/@system/site/Hero'
import { About } from '../../../../components/@system/site/About'
import { Services } from '../../../../components/@system/site/Services'
import { Team } from '../../../../components/@system/site/Team'
import { Testimonials } from '../../../../components/@system/site/Testimonials'
import { ContactSection } from '../../../../components/@system/site/ContactSection'
import { SiteFooter } from '../../../../components/@system/site/SiteFooter'
import { info, site } from '@/config'

export function SitePage() {
  const features = site.features ?? {}
  const { hash } = useLocation()

  // Deep links like /#contact (from other pages or external) land on the section.
  useEffect(() => {
    if (!hash) return
    const el = document.querySelector(hash)
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [hash])

  const hasAbout = Boolean(site.about?.title)
  const hasServices = (site.services?.items ?? []).length > 0
  const hasTeam = features.showTeam !== false && (site.team?.members ?? []).length > 0
  const hasTestimonials = features.showTestimonials !== false && (site.testimonials?.items ?? []).length > 0
  const hasContact = Boolean(site.contact?.title) || features.showContactForm || features.showMap

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg text-brand-text" data-testid="site-page">
      <OgMeta title={`${info.name} — ${info.tagline}`} description={site.hero?.subtitle || info.description} />
      <SiteNavbar />
      <main id="main-content" className="flex-1">
        <Hero />
        {hasAbout && <About />}
        {hasServices && <Services />}
        {hasTeam && <Team />}
        {hasTestimonials && <Testimonials />}
        {hasContact && <ContactSection />}
      </main>
      <SiteFooter />
    </div>
  )
}

export default SitePage
