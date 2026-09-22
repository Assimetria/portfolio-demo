// @system — Contact page
// @custom — update form fields, contact details, and social links via info.ts overrides
import { useState } from 'react'
import { Mail, MessageSquare, MapPin, Clock, Send } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Button } from '../../../../components/@system/ui/button'
import { info } from '@/config'

// ── Contact info cards ────────────────────────────────────────────────────────

const CONTACT_ITEMS = [
  {
    icon: Mail,
    title: 'Email us',
    description: 'Send us an email and we\'ll get back to you within 1 business day.',
    value: info.supportEmail,
    href: `mailto:${info.supportEmail}` },
  {
    icon: MessageSquare,
    title: 'Live chat',
    description: 'Chat with our support team in real time during business hours.',
    value: 'Start a chat',
    href: '#chat' },
  {
    icon: Clock,
    title: 'Support hours',
    description: 'Our team is available to help you during these hours.',
    value: 'Mon–Fri, 9am–6pm UTC',
    href: null },
  {
    icon: MapPin,
    title: 'Location',
    description: 'We are a remote-first team, spread across multiple time zones.',
    value: 'Remote worldwide',
    href: null },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ContactCard({ icon: Icon, title, description, value, href }) {
  return (
    <Card>
      <CardContent className="pt-6 flex flex-col gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
          <Icon className="h-5 w-5 text-brand-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">{title}</h3>
          <p className="mt-1 text-sm text-brand-text-muted">{description}</p>
        </div>
        {href ? (
          <a
            href={href}
            className="text-sm font-medium text-brand-primary hover:underline underline-offset-4 mt-auto"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium mt-auto">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

function ContactForm() {
  const [formState, setFormState] = useState('idle')
  const [fields, setFields] = useState({ name: '', email: '', subject: '', message: '' })

  function handleChange(e) {
    setFields((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormState('submitting')
    // Simulate async submission — replace with real API call
    await new Promise((res) => setTimeout(res, 900))
    setFormState('success')
  }

  if (formState === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/10">
          <Send className="h-6 w-6 text-brand-primary" />
        </div>
        <h3 className="text-xl font-semibold">Message sent!</h3>
        <p className="text-sm text-brand-text-muted max-w-sm">
          Thanks for reaching out. We'll get back to you at <strong>{fields.email}</strong> within 1 business day.
        </p>
        <Button variant="outline" size="sm" onClick={() => { setFormState('idle'); setFields({ name: '', email: '', subject: '', message: '' }) }}>
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium">
            Name <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            placeholder="Your name"
            value={fields.name}
            onChange={handleChange}
            className="rounded-lg border bg-brand-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-brand-text-muted"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className="text-sm font-medium">
            Email <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            value={fields.email}
            onChange={handleChange}
            className="rounded-lg border bg-brand-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-brand-text-muted"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-subject" className="text-sm font-medium">
          Subject <span className="text-[var(--color-error)]">*</span>
        </label>
        <select
          id="contact-subject"
          name="subject"
          required
          value={fields.subject}
          onChange={handleChange}
          className="rounded-lg border bg-brand-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-brand-text"
        >
          <option value="" disabled>Select a topic…</option>
          <option value="general">General enquiry</option>
          <option value="support">Technical support</option>
          <option value="billing">Billing & plans</option>
          <option value="feature">Feature request</option>
          <option value="partnership">Partnership</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium">
          Message <span className="text-[var(--color-error)]">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          placeholder="Tell us how we can help…"
          value={fields.message}
          onChange={handleChange}
          className="rounded-lg border bg-brand-bg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-brand-text-muted resize-none"
        />
      </div>

      {formState === 'error' && (
        <p className="text-sm text-[var(--color-error)]">Something went wrong. Please try again or email us directly.</p>
      )}

      <Button type="submit" disabled={formState === 'submitting'} className="gap-2 self-start">
        {formState === 'submitting' ? 'Sending…' : (<>Send message <Send className="h-4 w-4" /></>)}
      </Button>
    </form>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function ContactPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-brand-surface/40 border-b">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-3">Get in touch</h1>
          <p className="text-brand-text-muted max-w-lg mx-auto">
            Have a question, idea, or issue? We'd love to hear from you. Choose the best way to reach us below.
          </p>
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main id="main-content" className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Contact info cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          {CONTACT_ITEMS.map((item) => (
            <ContactCard key={item.title} {...item} />
          ))}
        </section>

        {/* Contact form */}
        <section>
          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-semibold mb-2">Send us a message</h2>
              <p className="text-sm text-brand-text-muted mb-8">
                Fill in the form and our team will get back to you within 1 business day.
              </p>
              <ContactForm />
            </div>

            <aside className="lg:col-span-2 flex flex-col gap-6">
              <div>
                <h3 className="font-semibold mb-2">Frequently asked questions</h3>
                <p className="text-sm text-brand-text-muted">
                  Before sending a message, check our{' '}
                  <a href="/help" className="text-brand-primary underline underline-offset-4 hover:opacity-80">
                    Help Center
                  </a>{' '}
                  — you might find the answer there instantly.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Billing questions</h3>
                <p className="text-sm text-brand-text-muted">
                  For billing enquiries, please select "Billing & plans" in the subject dropdown so our billing team can assist you directly.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Response time</h3>
                <p className="text-sm text-brand-text-muted">
                  We typically reply within 1 business day. For urgent issues, use live chat during business hours (Mon–Fri, 9am–6pm UTC).
                </p>
              </div>

              <div className="rounded-xl border bg-brand-surface p-5">
                <p className="text-sm font-medium mb-1">Email us directly</p>
                <a
                  href={`mailto:${info.supportEmail}`}
                  className="text-sm text-brand-primary underline underline-offset-4 hover:opacity-80 break-all"
                >
                  {info.supportEmail}
                </a>
              </div>
            </aside>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-text-muted">
          <p>© {new Date().getFullYear()} {info.name}. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/" className="hover:text-brand-text">Home</a>
            <a href="/help" className="hover:text-brand-text">Help</a>
            <a href="/privacy" className="hover:text-brand-text">Privacy</a>
            <a href="/terms" className="hover:text-brand-text">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
