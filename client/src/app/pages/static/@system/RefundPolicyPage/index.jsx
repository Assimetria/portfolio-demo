// @system — Refund Policy page template
// @custom — update the LAST_UPDATED date and customize the policy sections below
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Header } from '../../../../components/@system/Header'
import { info } from '@/config'

const LAST_UPDATED = 'February 26, 2026'

const SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    content: `We want you to be completely satisfied with your purchase. If you're not happy with ${info.name} for any reason, we offer a straightforward refund process outlined in this policy.` },
  {
    id: 'eligibility',
    title: 'Refund Eligibility',
    items: [
      'Refund requests must be submitted within 30 days of the original purchase date.',
      'Refunds apply to subscription charges only — one-time setup fees are non-refundable.',
      'Annual plan purchases are eligible for a pro-rated refund based on unused months.',
      'Accounts that have violated our Terms of Service are not eligible for refunds.',
      'Refunds are processed to the original payment method used at the time of purchase.',
    ] },
  {
    id: 'process',
    title: 'How to Request a Refund',
    content: `To request a refund, contact our support team at ${info.supportEmail} with your account email and the reason for your refund request. Our team will review your request within 2 business days and respond with next steps.`,
    steps: [
      'Email us at ' + info.supportEmail + ' with subject line "Refund Request"',
      'Include your account email address and order/subscription ID',
      'Briefly describe the reason for your refund request',
      'Our team will review and respond within 2 business days',
      'Approved refunds are processed within 5–10 business days',
    ] },
  {
    id: 'non-refundable',
    title: 'Non-Refundable Items',
    items: [
      'One-time onboarding or setup fees',
      'Add-on purchases or one-time credits consumed',
      'Charges for usage beyond the included plan limits',
      'Subscription months already elapsed on annual plans',
    ] },
  {
    id: 'cancellation',
    title: 'Cancellations',
    content: `You may cancel your subscription at any time from your account settings. Cancellation stops future billing but does not automatically trigger a refund for the current billing period. If you cancel within the 30-day refund window, you may still request a refund by contacting support.` },
  {
    id: 'disputes',
    title: 'Chargebacks & Disputes',
    content: `We encourage you to contact us before initiating a chargeback with your bank or card issuer. Chargebacks create additional processing costs that may result in account suspension. If you believe a charge is fraudulent, reach out to us immediately at ${info.supportEmail} and we will resolve it promptly.` },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    content: `We reserve the right to update this Refund Policy at any time. Changes will be posted on this page with an updated effective date. Continued use of ${info.name} after policy changes constitutes acceptance of the revised terms.` },
  {
    id: 'contact',
    title: 'Contact Us',
    content: `If you have questions about this Refund Policy, please reach out to our support team at ${info.supportEmail}. We're here to help.` },
]

export function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content" className="container mx-auto px-4 py-16 max-w-3xl">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-brand-text-muted hover:text-brand-text mb-10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Page header */}
        <div className="flex items-start gap-4 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 flex-shrink-0">
            <RefreshCw className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Refund Policy</h1>
            <p className="mt-1 text-sm text-brand-text-muted">
              Last updated {LAST_UPDATED}
            </p>
          </div>
        </div>

        {/* Policy sections */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-xl font-semibold mb-3">{section.title}</h2>

              {section.content && (
                <p className="text-brand-text-muted leading-relaxed">
                  {section.content}
                </p>
              )}

              {section.items && (
                <ul className="mt-3 space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-brand-text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {section.steps && (
                <ol className="mt-3 space-y-2 list-none">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-brand-text-muted">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold flex-shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-14 rounded-lg border bg-brand-surface p-6 text-sm text-brand-text-muted">
          <p>
            This Refund Policy is part of and incorporated into our{' '}
            <Link to="/terms" className="underline hover:text-brand-text transition-colors">
              Terms of Service
            </Link>
            . By using {info.name}, you agree to the terms of this policy.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-text-muted">
          <p>© {new Date().getFullYear()} {info.name}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-brand-text">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-text">Terms</Link>
            <Link to="/refund-policy" className="hover:text-brand-text">Refund Policy</Link>
            <a href={`mailto:${info.supportEmail}`} className="hover:text-brand-text">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
