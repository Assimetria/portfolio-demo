// @system — Terms of Service page
// @custom — update effective date, company name, and section content via info.ts overrides
import { Link } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'
import { Button } from '../../../../components/@system/ui/button'
import { Header } from '../../../../components/@system/Header'
import { info } from '@/config'

const EFFECTIVE_DATE = info.legalEffectiveDate

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using ${info.name} ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service. These Terms apply to all visitors, users, and others who access or use the Service.` },
  {
    id: 'description',
    title: '2. Description of Service',
    content: `${info.name} provides ${info.description || 'a software-as-a-service platform'}. We reserve the right to modify, suspend, or discontinue the Service at any time with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Service.` },
  {
    id: 'accounts',
    title: '3. Accounts',
    content: `When you create an account with us, you must provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately at ${info.supportEmail} of any unauthorized access or use of your account. We reserve the right to terminate accounts, remove or edit content at our sole discretion.` },
  {
    id: 'acceptable-use',
    title: '4. Acceptable Use',
    content: `You agree not to use the Service to: (a) violate any applicable laws or regulations; (b) infringe upon the rights of others; (c) transmit harmful, offensive, or disruptive content; (d) attempt to gain unauthorized access to any systems or networks; (e) engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Service; (f) use the Service for any fraudulent or unlawful purpose.` },
  {
    id: 'billing',
    title: '5. Billing and Payment',
    content: `Certain features of the Service may require payment. You agree to provide accurate and complete payment information. All fees are exclusive of taxes unless stated otherwise. Subscriptions automatically renew unless cancelled before the renewal date. Refunds are issued at our sole discretion in accordance with our refund policy. We reserve the right to change pricing with reasonable notice.` },
  {
    id: 'intellectual-property',
    title: '6. Intellectual Property',
    content: `The Service and its original content, features, and functionality are and will remain the exclusive property of ${info.name} and its licensors. Our trademarks may not be used in connection with any product or service without prior written consent. You retain ownership of any content you submit through the Service but grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and display such content in connection with operating the Service.` },
  {
    id: 'privacy',
    title: '7. Privacy',
    content: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand our practices regarding the collection and use of your personal information.` },
  {
    id: 'disclaimers',
    title: '8. Disclaimers',
    content: `THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.` },
  {
    id: 'limitation',
    title: '9. Limitation of Liability',
    content: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ${info.name.toUpperCase()} AND ITS OFFICERS, EMPLOYEES, AGENTS, AFFILIATES, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.` },
  {
    id: 'indemnification',
    title: '10. Indemnification',
    content: `You agree to defend, indemnify, and hold harmless ${info.name} and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorney's fees, arising out of or in any way connected with your access to or use of the Service, your violation of these Terms, or your infringement of any third-party rights.` },
  {
    id: 'termination',
    title: '11. Termination',
    content: `We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will cease immediately. All provisions of these Terms which by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.` },
  {
    id: 'governing-law',
    title: '12. Governing Law',
    content: `These Terms shall be governed by and construed in accordance with applicable law, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved through binding arbitration or in a court of competent jurisdiction, by us.` },
  {
    id: 'changes',
    title: '13. Changes to Terms',
    content: `We reserve the right to modify or replace these Terms at any time. We will provide notice of material changes by updating the effective date above and, where appropriate, notifying you by email. Your continued use of the Service after any changes constitutes acceptance of the new Terms. If you do not agree to the new Terms, please stop using the Service.` },
  {
    id: 'contact',
    title: '14. Contact Us',
    content: `If you have any questions about these Terms of Service, please contact us at ${info.supportEmail}. We will do our best to respond to your inquiry promptly.` },
]

export function TermsPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <main id="main-content" className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-brand-text mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Page header */}
        <div className="flex items-start gap-4 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-primary/10 shrink-0">
            <FileText className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
            <p className="mt-2 text-brand-text-muted">
              Effective {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        {/* Intro */}
        <p className="text-brand-text-muted mb-10 leading-relaxed">
          Please read these Terms of Service carefully before using {info.name}. By
          accessing or using the Service, you agree to be bound by these Terms. If you
          disagree with any part of the Terms, you may not access the Service.
        </p>

        {/* Table of contents */}
        <nav className="mb-10 rounded-lg border bg-brand-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-text-muted mb-4">
            Table of Contents
          </h2>
          <ol className="space-y-1.5 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-brand-primary hover:underline underline-offset-4"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
              <p className="text-brand-text-muted leading-relaxed">{section.content}</p>
            </section>
          ))}
        </div>

        {/* Divider */}
        <div className="my-12 border-t" />

        {/* Footer note */}
        <div className="rounded-lg border bg-brand-surface p-6 text-center">
          <p className="text-sm text-brand-text-muted mb-4">
            Have questions about our Terms of Service?
          </p>
          <a href={`mailto:${info.supportEmail}`}>
            <Button variant="outline" size="sm">
              Contact Us
            </Button>
          </a>
          <p className="mt-4 text-xs text-brand-text-muted">
            Also see our{' '}
            <Link to="/privacy" className="text-brand-primary hover:underline underline-offset-4">
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-brand-text-muted">
          <p>© {new Date().getFullYear()} {info.name}. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-brand-text">Privacy</a>
            <a href="/terms" className="hover:text-brand-text font-medium text-brand-text">Terms</a>
            <a href={`mailto:${info.supportEmail}`} className="hover:text-brand-text">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
