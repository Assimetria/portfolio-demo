// @system — Privacy Policy page template
// @custom — update effective date, company name/address, and section content per product
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { info } from '@/config'

const COMPANY_NAME = info.name
const CONTACT_EMAIL = info.supportEmail
const EFFECTIVE_DATE = info.legalEffectiveDate


function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-3 text-brand-text">{title}</h2>
      <div className="space-y-3 text-brand-text-muted leading-relaxed">{children}</div>
    </section>
  )
}

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-brand-primary/10 mb-4">
            <Shield className="h-7 w-7 text-brand-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-brand-text-muted">
            Effective {EFFECTIVE_DATE}
          </p>
        </div>

        {/* ── Intro ───────────────────────────────────────────────────────── */}
        <div className="mb-10 rounded-lg border bg-brand-surface p-6 text-sm text-brand-text-muted leading-relaxed">
          <p>
            {COMPANY_NAME} ("we", "our", or "us") is committed to protecting your
            personal information. This Privacy Policy explains how we collect, use,
            disclose, and safeguard your data when you use our service. Please read
            it carefully. By accessing or using {COMPANY_NAME} you agree to the
            practices described below.
          </p>
        </div>

        {/* ── 1. Information We Collect ────────────────────────────────────── */}
        <Section title="1. Information We Collect">
          <p>
            We collect information you provide directly, information collected
            automatically, and information from third parties.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-brand-text">Account data</strong> — name,
              email address, and password when you register.
            </li>
            <li>
              <strong className="text-brand-text">Profile data</strong> — optional
              information such picture, role, or preferences.
            </li>
            <li>
              <strong className="text-brand-text">Usage data</strong> — pages
              visited, features used, clicks, and session duration.
            </li>
            <li>
              <strong className="text-brand-text">Device &amp; log data</strong> —
              IP address, browser type, operating system, and timestamps.
            </li>
            <li>
              <strong className="text-brand-text">Payment data</strong> — billing
              address and last four digits of card (full card details are handled
              by our payment processor and never stored by us).
            </li>
            <li>
              <strong className="text-brand-text">Cookies &amp; similar technologies</strong> —
              session tokens, preference cookies, and analytics identifiers.
            </li>
          </ul>
        </Section>

        {/* ── 2. How We Use Your Information ──────────────────────────────── */}
        <Section title="2. How We Use Your Information">
          <p>We use the data we collect to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Provide, operate, and improve {COMPANY_NAME}.</li>
            <li>Authenticate your account and maintain session security.</li>
            <li>Process payments and send receipts.</li>
            <li>Send transactional emails (account verification, password resets).</li>
            <li>Send product updates and announcements (you may opt out at any time).</li>
            <li>Monitor for and prevent fraud, abuse, or security incidents.</li>
            <li>Comply with legal obligations.</li>
          </ul>
        </Section>

        {/* ── 3. Legal Bases for Processing (GDPR) ────────────────────────── */}
        <Section title="3. Legal Bases for Processing">
          <p>
            If you are located in the European Economic Area (EEA), we process
            your personal data on the following legal grounds:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-brand-text">Contract</strong> — processing
              necessary to perform the agreement with you.
            </li>
            <li>
              <strong className="text-brand-text">Legitimate interests</strong> —
              fraud prevention, security, and product analytics.
            </li>
            <li>
              <strong className="text-brand-text">Legal obligation</strong> —
              compliance with applicable laws.
            </li>
            <li>
              <strong className="text-brand-text">Consent</strong> — where we have
              asked for and received your explicit consent (e.g. marketing emails).
            </li>
          </ul>
        </Section>

        {/* ── 4. Sharing Your Information ─────────────────────────────────── */}
        <Section title="4. Sharing Your Information">
          <p>
            We do not sell your personal data. We may share it with:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-brand-text">Service providers</strong> — hosting,
              payment processing, email delivery, and analytics vendors who are
              contractually bound to protect your data.
            </li>
            <li>
              <strong className="text-brand-text">Business transfers</strong> — in
              the event of a merger, acquisition, or sale of assets, your data may
              be transferred of that transaction.
            </li>
            <li>
              <strong className="text-brand-text">Legal requirements</strong> — when
              required by law, court order, or to protect the rights and safety of
              our users or the public.
            </li>
          </ul>
        </Section>

        {/* ── 5. Data Retention ───────────────────────────────────────────── */}
        <Section title="5. Data Retention">
          <p>
            We retain your personal data for account is active or to provide services. After account deletion we retain certain
            data for up to 90 days to allow account recovery, then purge it from
            production systems. Anonymised aggregate data may be retained
            indefinitely for analytics.
          </p>
        </Section>

        {/* ── 6. Cookies ──────────────────────────────────────────────────── */}
        <Section title="6. Cookies">
          <p>
            We use cookies and similar tracking technologies to keep you signed in
            and understand how the service is used. You can instruct your browser
            to refuse all cookies, but some parts of the service may not function
            properly without them.
          </p>
          <p>Types of cookies we use:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-brand-text">Essential</strong> — required for
              authentication and security (session tokens).
            </li>
            <li>
              <strong className="text-brand-text">Analytics</strong> — help us
              understand usage patterns (e.g. page views, feature adoption).
            </li>
            <li>
              <strong className="text-brand-text">Preference</strong> — remember
              your settings such or language.
            </li>
          </ul>
        </Section>

        {/* ── 7. Security ─────────────────────────────────────────────────── */}
        <Section title="7. Security">
          <p>
            We implement industry-standard safeguards: encryption in transit
            (TLS), encrypted passwords (bcrypt), and access controls. No method
            of transmission over the Internet is 100% secure; we cannot guarantee
            absolute security. Please notify us immediately if you suspect
            unauthorised access to your account.
          </p>
        </Section>

        {/* ── 8. International Transfers ──────────────────────────────────── */}
        <Section title="8. International Data Transfers">
          <p>
            Your information may be transferred to and processed in countries
            other than your own. Where we transfer data outside the EEA, we
            ensure appropriate safeguards are in place (e.g. Standard Contractual
            Clauses or adequacy decisions).
          </p>
        </Section>

        {/* ── 9. Your Rights ──────────────────────────────────────────────── */}
        <Section title="9. Your Rights">
          <p>
            Depending on your location you may have the following rights regarding
            your personal data:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-brand-text">Access</strong> — request a copy
              of the data we hold about you.
            </li>
            <li>
              <strong className="text-brand-text">Rectification</strong> — correct
              inaccurate or incomplete data.
            </li>
            <li>
              <strong className="text-brand-text">Erasure</strong> — request
              deletion of your personal data ("right to be forgotten").
            </li>
            <li>
              <strong className="text-brand-text">Restriction</strong> — ask us to
              limit how we process your data.
            </li>
            <li>
              <strong className="text-brand-text">Portability</strong> — receive
              your data in a structured, machine-readable format.
            </li>
            <li>
              <strong className="text-brand-text">Objection</strong> — object to
              processing based on legitimate interests or for direct marketing.
            </li>
            <li>
              <strong className="text-brand-text">Withdraw consent</strong> — where
              processing is based on consent, withdraw it at any time.
            </li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-brand-primary underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        {/* ── 10. Children's Privacy ──────────────────────────────────────── */}
        <Section title="10. Children's Privacy">
          <p>
            {COMPANY_NAME} is not directed at children under 16. We do not
            knowingly collect personal data from children. If you believe we have
            inadvertently collected such data, please contact us and we will
            delete it promptly.
          </p>
        </Section>

        {/* ── 11. Changes to This Policy ──────────────────────────────────── */}
        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by email or by posting a prominent notice in
            the service. The "Effective date" at the top of this page indicates
            when the policy was last revised. Continued use of the service after
            changes take effect constitutes acceptance of the updated policy.
          </p>
        </Section>

        {/* ── 12. Contact ─────────────────────────────────────────────────── */}
        <Section title="12. Contact Us">
          <p>
            If you have questions or concerns about this Privacy Policy or how we
            handle your data, please contact us:
          </p>
          <address className="not-italic">
            <p className="font-medium text-brand-text">{COMPANY_NAME}</p>
            {info.companyAddress && <p>{info.companyAddress}</p>}
            <p>
              Email:{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-brand-primary underline-offset-4 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </address>
        </Section>

        {/* ── Footer nav ──────────────────────────────────────────────────── */}
        <div className="mt-12 border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-text-muted">
          <Link to="/" className="hover:text-brand-text transition-colors">
            ← Back to {COMPANY_NAME}
          </Link>
          <div className="flex gap-6">
            <Link to="/terms" className="hover:text-brand-text transition-colors">
              Terms of Service
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="hover:text-brand-text transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
