// @system — Data Processing Agreement (DPA) — GDPR-compliant boilerplate
// @custom — update LAST_UPDATED, EFFECTIVE_DATE, and SUB_PROCESSORS per product
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { info } from '@/config'

const LAST_UPDATED = 'July 20, 2026'
const EFFECTIVE_DATE = 'July 20, 2026'
const VERSION = '1.0'

// Standard sub-processors — customise per product deployment
const SUB_PROCESSORS = [
  { name: 'AWS (Amazon Web Services)', purpose: 'Cloud infrastructure hosting', location: 'EU (eu-west-1)' },
  { name: 'Stripe',                    purpose: 'Payment processing',           location: 'US / EU' },
  { name: 'SendGrid',                  purpose: 'Transactional email delivery', location: 'US / EU' },
  { name: 'Sentry',                    purpose: 'Error monitoring',             location: 'US / EU' },
]

// Categories of personal data processed
const DATA_CATEGORIES = [
  'Account identifiers — email address, hashed password, display name',
  'Profile data — avatar, team affiliations, preferences',
  'Game / match data — scores, participation, timestamps, associated players',
  'Technical data — IP address, device / browser type, session tokens',
  'Communications — support requests, notification preferences',
]

// Categories of data subjects
const SUBJECT_CATEGORIES = [
  'End users of the Service (registered account holders)',
  'Team members and players added to the Controller\'s account',
  'Prospective users who initiate but do not complete registration',
]

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

export function DPAPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main className="container mx-auto px-4 py-16 max-w-3xl">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-7 w-7 text-brand-primary" />
          <h1 className="text-3xl font-bold text-brand-text">Data Processing Agreement</h1>
        </div>
        <p className="text-sm text-brand-text-muted mb-2">
          Version {VERSION} · Effective {EFFECTIVE_DATE} · Last updated {LAST_UPDATED}
        </p>
        <p className="text-sm text-brand-text-muted mb-10">
          This Data Processing Agreement ("DPA") is entered into between{' '}
          <strong>{info.name}</strong> (the "Processor") and the Customer (the "Controller")
          and forms part of the Terms of Service.
        </p>

        {/* ── 1. Introduction ─────────────────────────────────────────────── */}
        <Section title="1. Introduction">
          <Prose>
            <p>
              This DPA reflects the parties' agreement on the processing of personal data
              by <strong>{info.name}</strong> in connection with the Service, in accordance
              with Regulation (EU) 2016/679 (the "GDPR") and other applicable data protection
              laws (including, where relevant, the UK GDPR and the California Consumer Privacy
              Act).
            </p>
            <p>
              If there is any conflict between this DPA and the Terms of Service, this DPA
              prevails with respect to the processing of personal data.
            </p>
          </Prose>
        </Section>

        {/* ── 2. Definitions ──────────────────────────────────────────────── */}
        <Section title="2. Definitions">
          <Prose>
            <p>Unless otherwise defined here, capitalised terms have the meaning given in the GDPR.</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>Personal Data</strong> — information relating to an identified or identifiable natural person that the Controller submits to, or has processed through, the Service.</li>
              <li><strong>Data Subject</strong> — the natural person to whom Personal Data relates (e.g. an end user, player, or team member).</li>
              <li><strong>Processing</strong> — any operation performed on Personal Data.</li>
              <li><strong>Sub-processor</strong> — any third party engaged by the Processor to process Personal Data on behalf of the Controller.</li>
              <li><strong>Personal Data Breach</strong> — a breach of security leading to accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, Personal Data.</li>
            </ul>
          </Prose>
        </Section>

        {/* ── 3. Subject matter and duration ──────────────────────────────── */}
        <Section title="3. Subject Matter, Duration, Nature and Purpose">
          <Prose>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li><strong>Subject matter:</strong> provision of the {info.name} Service (user account management, authentication, game / match data, team management, leaderboards, notifications, and related features).</li>
              <li><strong>Duration:</strong> for the term of the Terms of Service and until all Personal Data has been returned or deleted in accordance with section 11.</li>
              <li><strong>Nature and purpose:</strong> storage, retrieval, transmission, analysis, and display of Personal Data to enable the Controller's use of the Service.</li>
            </ul>
          </Prose>
        </Section>

        {/* ── 4. Categories of data ───────────────────────────────────────── */}
        <Section title="4. Categories of Personal Data and Data Subjects">
          <Prose>
            <p><strong>Categories of Personal Data processed:</strong></p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              {DATA_CATEGORIES.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p><strong>Categories of Data Subjects:</strong></p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              {SUBJECT_CATEGORIES.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Prose>
        </Section>

        {/* ── 5. Roles and responsibilities ───────────────────────────────── */}
        <Section title="5. Roles and Responsibilities">
          <Prose>
            <p>
              The Controller determines the purposes and means of processing. The Processor
              processes Personal Data solely on documented instructions from the Controller,
              including with respect to transfers of Personal Data to a third country, unless
              required to do so by applicable law.
            </p>
            <p>
              The Processor shall inform the Controller if, in its opinion, an instruction
              infringes the GDPR or other applicable data protection provisions.
            </p>
          </Prose>
        </Section>

        {/* ── 6. Security measures ────────────────────────────────────────── */}
        <Section title="6. Security of Processing">
          <Prose>
            <p>
              The Processor implements appropriate technical and organisational measures to
              ensure a level of security appropriate to the risk, including, as appropriate:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Encryption of Personal Data in transit (TLS 1.2+) and at rest.</li>
              <li>Passwords stored using industry-standard one-way hashing (bcrypt / argon2).</li>
              <li>Role-based access controls and the principle of least privilege.</li>
              <li>Regular back-ups and tested restoration procedures.</li>
              <li>Audit logging of access to production systems.</li>
              <li>Security review of code changes and dependency vulnerabilities.</li>
              <li>Personnel training on data protection and confidentiality obligations.</li>
            </ul>
          </Prose>
        </Section>

        {/* ── 7. Sub-processors ───────────────────────────────────────────── */}
        <Section title="7. Sub-processors">
          <Prose>
            <p>
              The Controller provides general authorisation for the Processor to engage the
              sub-processors listed below. The Processor will notify the Controller of any
              intended addition or replacement of sub-processors, giving the Controller the
              opportunity to object.
            </p>
          </Prose>
          <div className="mt-4 overflow-x-auto rounded-lg border border-brand-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface">
                  <th className="px-4 py-3 text-left font-medium text-brand-text">Sub-processor</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-text">Purpose</th>
                  <th className="px-4 py-3 text-left font-medium text-brand-text">Location</th>
                </tr>
              </thead>
              <tbody>
                {SUB_PROCESSORS.map((sp, i) => (
                  <tr key={sp.name} className={i % 2 === 0 ? 'bg-brand-bg' : 'bg-brand-surface/20'}>
                    <td className="px-4 py-3 font-medium text-brand-text">{sp.name}</td>
                    <td className="px-4 py-3 text-brand-text-muted">{sp.purpose}</td>
                    <td className="px-4 py-3 text-brand-text-muted whitespace-nowrap">{sp.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 8. Data subject rights ──────────────────────────────────────── */}
        <Section title="8. Assistance with Data Subject Rights">
          <Prose>
            <p>
              Taking into account the nature of the processing, the Processor shall assist
              the Controller, by appropriate technical and organisational measures, in
              fulfilling its obligation to respond to requests from Data Subjects exercising
              their rights under the GDPR (including rights of access, rectification, erasure,
              restriction, portability, and objection).
            </p>
            <p>
              Where the Processor receives a request directly from a Data Subject, it will
              forward the request to the Controller without undue delay and will not respond
              to the request itself, except as instructed by the Controller or as required by law.
            </p>
          </Prose>
        </Section>

        {/* ── 9. Personal data breach ─────────────────────────────────────── */}
        <Section title="9. Personal Data Breach">
          <Prose>
            <p>
              The Processor shall notify the Controller without undue delay, and in any event
              within 72 hours, after becoming aware of a Personal Data Breach. The notification
              will include, to the extent known:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Nature of the breach, categories and approximate number of affected Data Subjects and records.</li>
              <li>Likely consequences of the breach.</li>
              <li>Measures taken or proposed to address the breach and mitigate adverse effects.</li>
              <li>Contact point for further information.</li>
            </ul>
          </Prose>
        </Section>

        {/* ── 10. International transfers ─────────────────────────────────── */}
        <Section title="10. International Data Transfers">
          <Prose>
            <p>
              Where Personal Data is transferred outside the European Economic Area (EEA) or
              the United Kingdom, the Processor will ensure that such transfers are subject
              to appropriate safeguards under Chapter V of the GDPR, including Standard
              Contractual Clauses adopted by the European Commission.
            </p>
          </Prose>
        </Section>

        {/* ── 11. Return / deletion ───────────────────────────────────────── */}
        <Section title="11. Return or Deletion of Personal Data">
          <Prose>
            <p>
              On termination of the Terms of Service, the Processor shall, at the Controller's
              choice, return all Personal Data or delete it (including existing copies) unless
              retention is required by law. Deletion will be completed within 30 days of the
              request, subject to backup rotation cycles which shall not exceed 90 days.
            </p>
          </Prose>
        </Section>

        {/* ── 12. Audits ──────────────────────────────────────────────────── */}
        <Section title="12. Audits and Inspections">
          <Prose>
            <p>
              The Processor shall make available to the Controller all information necessary
              to demonstrate compliance with this DPA and shall allow for and contribute to
              audits, including inspections, conducted by the Controller or another auditor
              mandated by the Controller. Audits shall be conducted no more than once per
              year (except where required by a supervisory authority) on reasonable prior
              notice and during normal business hours.
            </p>
          </Prose>
        </Section>

        {/* ── 13. Governing terms ─────────────────────────────────────────── */}
        <Section title="13. Governing Terms and Changes">
          <Prose>
            <p>
              This DPA is governed by the laws stated in the Terms of Service. The Processor
              may update this DPA from time to time to reflect changes in applicable law or
              in the Service. Material changes will be communicated to the Controller with at
              least 30 days' prior notice.
            </p>
          </Prose>
        </Section>

        {/* ── 14. Contact ─────────────────────────────────────────────────── */}
        <Section title="14. Contact">
          <Prose>
            <p>
              For questions about this DPA, to request a signed copy, or to notify us of a
              data protection concern, please contact us at{' '}
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
          <Link to="/cookies" className="hover:text-brand-text transition-colors">
            Cookie Policy
          </Link>
        </div>
      </main>
    </div>
  )
}
