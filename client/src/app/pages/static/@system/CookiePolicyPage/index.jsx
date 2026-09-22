// @system — Cookie Policy page (GDPR/CCPA compliant boilerplate)
// @custom — update lastUpdated, companyName, and cookie table entries per product
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { info } from '@/config'

const LAST_UPDATED = 'February 26, 2026'


const COOKIES = [
  {
    name: 'session_token',
    type: 'Essential',
    duration: '7 days',
    purpose: 'Keeps you logged in securely across browser sessions.' },
  {
    name: 'csrf_token',
    type: 'Essential',
    duration: 'Session',
    purpose: 'Prevents cross-site request forgery attacks.' },
  {
    name: 'cookie_consent',
    type: 'Functional',
    duration: '1 year',
    purpose: 'Stores your cookie consent preference so we do not ask again.' },
  {
    name: 'theme_preference',
    type: 'Functional',
    duration: '1 year',
    purpose: 'Remembers your light/dark mode preference.' },
  {
    name: '_ga',
    type: 'Analytics',
    duration: '2 years',
    purpose: 'Google Analytics — distinguishes unique users.' },
  {
    name: '_ga_*',
    type: 'Analytics',
    duration: '2 years',
    purpose: 'Google Analytics — maintains session state.' },
]

const TYPE_COLORS = {
  Essential: 'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]/30 dark:text-[var(--color-info)]',
  Functional: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Analytics: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]/30 dark:text-[var(--color-warning)]',
  Marketing: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' }

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-brand-text mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Prose({ children }) {
  return <div className="text-brand-text-muted leading-7 space-y-3">{children}</div>
}

export function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-2">
          <Cookie className="h-7 w-7 text-brand-primary" />
          <h1 className="text-3xl font-bold text-brand-text">Cookie Policy</h1>
        </div>
        <p className="text-sm text-brand-text-muted mb-10">
          Last updated {LAST_UPDATED}
        </p>

        {/* ── 1. What are cookies ─────────────────────────────────────────── */}
        <Section title="1. What Are Cookies?">
          <Prose>
            <p>
              Cookies are small text files placed on your device when you visit a website. They
              help websites remember information about your visit, making your next visit easier
              and the site more useful to you.
            </p>
            <p>
              We use cookies and similar technologies (such storage and session storage)
              to operate and improve <strong>{info.name}</strong>.
            </p>
          </Prose>
        </Section>

        {/* ── 2. Types of cookies ─────────────────────────────────────────── */}
        <Section title="2. Types of Cookies We Use">
          <Prose>
            <p>We categorise the cookies we use:</p>
          </Prose>
          <ul className="mt-4 space-y-3">
            {[
              {
                type: 'Essential',
                desc: 'Required for the website to function. They cannot be disabled without breaking core features such and security.' },
              {
                type: 'Functional',
                desc: 'Remember your preferences (e.g. language, theme) to personalise your experience.' },
              {
                type: 'Analytics',
                desc: 'Help us understand how visitors interact with the site so we can improve it. Data is aggregated and anonymised where possible.' },
              {
                type: 'Marketing',
                desc: 'Track you across sites to display relevant advertisements. We do not currently use marketing cookies.' },
            ].map(({ type, desc }) => (
              <li key={type} className="flex gap-3">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}
                >
                  {type}
                </span>
                <span className="text-brand-text-muted text-sm leading-6">{desc}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── 3. Cookie table ─────────────────────────────────────────────── */}
        <Section title="3. Cookies We Set">
          <div className="overflow-x-auto rounded-lg border border-brand-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface">
                  <th className="px-4 py-3 text-left font-medium text-brand-text">Cookie</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-text">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-text">Duration</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-text">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {COOKIES.map((cookie, i) => (
                  <tr
                    key={cookie.name}
                    className={i % 2 === 0 ? 'bg-brand-bg' : 'bg-brand-surface/20'}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-brand-text whitespace-nowrap">
                      {cookie.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[cookie.type]}`}
                      >
                        {cookie.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-text-muted whitespace-nowrap">
                      {cookie.duration}
                    </td>
                    <td className="px-4 py-3 text-brand-text-muted">{cookie.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 4. Third-party cookies ──────────────────────────────────────── */}
        <Section title="4. Third-Party Cookies">
          <Prose>
            <p>
              Some cookies are placed by third-party services that appear on our pages. We do
              not control these cookies. Third parties that may set cookies include:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>
                <strong>Google Analytics</strong> — website analytics. See{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary underline underline-offset-2 hover:opacity-80"
                >
                  Google's Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Stripe</strong> — payment processing. See{' '}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary underline underline-offset-2 hover:opacity-80"
                >
                  Stripe's Privacy Policy
                </a>
                .
              </li>
            </ul>
          </Prose>
        </Section>

        {/* ── 5. Managing cookies ─────────────────────────────────────────── */}
        <Section title="5. Managing Your Cookie Preferences">
          <Prose>
            <p>
              You can control and delete cookies through your browser settings. Note that
              disabling essential cookies will affect the functionality of the site.
            </p>
            <p>Browser cookie management guides:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              {[
                ['Chrome', 'https://support.google.com/chrome/answer/95647'],
                ['Firefox', 'https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences'],
                ['Safari', 'https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac'],
                ['Edge', 'https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09'],
              ].map(([name, url]) => (
                <li key={name}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary underline underline-offset-2 hover:opacity-80"
                  >
                    {name}
                  </a>
                </li>
              ))}
            </ul>
            <p>
              You can also opt out of Google Analytics across all websites by installing the{' '}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary underline underline-offset-2 hover:opacity-80"
              >
                Google Analytics Opt-out Browser Add-on
              </a>
              .
            </p>
          </Prose>
        </Section>

        {/* ── 6. Changes ──────────────────────────────────────────────────── */}
        <Section title="6. Changes to This Policy">
          <Prose>
            <p>
              We may update this Cookie Policy from time to time. When we do, we will revise the
              "Last updated" date at the top of this page. We encourage you to review this page
              periodically.
            </p>
          </Prose>
        </Section>

        {/* ── 7. Contact ──────────────────────────────────────────────────── */}
        <Section title="7. Contact Us">
          <Prose>
            <p>
              If you have questions about our use of cookies, please contact us at{' '}
              <a
                href={`mailto:${info.supportEmail}`}
                className="text-brand-primary underline underline-offset-2 hover:opacity-80"
              >
                {info.supportEmail}
              </a>
              .
            </p>
          </Prose>
        </Section>

        {/* ── Footer nav ──────────────────────────────────────────────────── */}
        <div className="mt-12 pt-6 border-t border-brand-border flex flex-wrap gap-4 text-sm text-brand-text-muted">
          <Link to="/" className="hover:text-brand-text transition-colors">
            Home
          </Link>
          <Link to="/privacy" className="hover:text-brand-text transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-brand-text transition-colors">
            Terms of Service
          </Link>
        </div>
      </main>
    </div>
  )
}
