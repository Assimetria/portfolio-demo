# Data Processing Agreement (DPA) template

> Purpose: a generic GDPR Data Processing Agreement for products built on this template. Replace every `{{PLACEHOLDER}}` and have counsel review before publishing. The `/dpa` page (`client/src/app/pages/static/@system/DPAPage`) should render the completed text.
> Last verified: 2026-09-20. Not legal advice.

**Product:** {{PRODUCT_NAME}}
**Provider (Processor):** {{COMPANY_NAME}}, {{COMPANY_ADDRESS}}, {{COMPANY_REGISTRATION}}
**Version:** {{DPA_VERSION}}  **Effective date:** {{EFFECTIVE_DATE}}  **Last reviewed:** {{REVIEW_DATE}}
**Published at:** `{{APP_URL}}/dpa`

---

## 1. Introduction

This Data Processing Agreement ("DPA") forms part of the Terms of Service between {{COMPANY_NAME}} ("Processor", "we", "us") and the customer ("Controller", "you") and governs the processing of personal data by {{COMPANY_NAME}} in connection with the {{PRODUCT_NAME}} service (the "Service").

It reflects the parties' agreement on the processing of personal data under Regulation (EU) 2016/679 (GDPR), the UK GDPR where applicable, and other applicable data protection laws. If this DPA conflicts with the Terms of Service, this DPA prevails for the processing of personal data.

## 2. Definitions

"Personal Data", "Controller", "Processor", "Data Subject", "Processing", "Personal Data Breach", "Sub-processor" and "Supervisory Authority" have the meanings given in the GDPR. "Customer Data" means personal data you or your users submit to the Service.

## 3. Subject matter, duration, nature and purpose

- **Subject matter:** provision of the Service (user accounts, {{CORE_FEATURES}}, billing, support).
- **Duration:** the term of the Terms of Service plus the deletion period in section 11.
- **Nature and purpose:** hosting, storage, transmission and display of Customer Data as needed to operate the Service, provide support, and meet legal obligations.
- **Categories of Data Subjects:** your users, team members and end customers.
- **Categories of Personal Data:** identifiers (name, email), account and authentication data, usage and log data, billing data (handled by the payment processor), content you submit. No special categories unless you choose to submit them.

## 4. Roles and responsibilities

You are the Controller of Customer Data and are responsible for its lawfulness, for the instructions you give us, and for informing Data Subjects. We are the Processor and process Customer Data only on your documented instructions, which are the Terms of Service, this DPA and your use of the Service's features.

## 5. Processor obligations

We will:

1. process Customer Data only on your instructions, unless required by law (in which case we inform you unless prohibited);
2. ensure persons authorised to process Customer Data are bound by confidentiality;
3. implement the technical and organisational measures in Annex II;
4. respect the conditions in section 6 for engaging Sub-processors;
5. assist you, taking into account the nature of processing, in responding to Data Subject requests and in meeting your obligations under Articles 32 to 36 GDPR;
6. delete or return Customer Data at the end of the Service as set out in section 11;
7. make available the information necessary to demonstrate compliance and allow audits under section 12;
8. inform you immediately if an instruction infringes data protection law in our opinion.

## 6. Sub-processors

You authorise the Sub-processors in Annex III. We will notify you at least {{SUBPROCESSOR_NOTICE_DAYS}} days before adding or replacing a Sub-processor (by email to the account owner or by updating `{{APP_URL}}/dpa`). You may object on reasonable data protection grounds within that period; if we cannot address the objection, you may terminate the affected Service. We impose data protection obligations on Sub-processors that are no less protective than this DPA and remain liable for their performance.

## 7. International transfers

Customer Data is hosted in {{HOSTING_REGION}}. Where Customer Data is transferred outside the EEA/UK, we rely on an adequacy decision or on the European Commission Standard Contractual Clauses (and the UK Addendum where applicable), which are incorporated by reference.

## 8. Data Subject rights

We will, within {{DSR_FORWARD_DAYS}} business days, forward to you any Data Subject request we receive that identifies your account, and will not respond except to acknowledge receipt or as required by law. The Service provides self-service export (`GET /api/gdpr/my-data`) and deletion (`DELETE /api/gdpr/my-data`) for user accounts to help you meet Articles 15 to 22.

## 9. Personal Data Breach notification

We will notify you without undue delay, and no later than {{BREACH_NOTICE_HOURS}} hours after becoming aware of a Personal Data Breach affecting Customer Data, with the information reasonably available to us (nature, categories and approximate numbers, likely consequences, measures taken), and will update the notification as information becomes available. Notification is sent to the account owner's email and to {{CUSTOMER_SECURITY_CONTACT_FIELD}} if configured.

## 10. Security of processing

We maintain the measures in Annex II, review them at least annually, and update them as technology and risk evolve without reducing the overall level of protection.

## 11. Return and deletion

On termination or on your request, we delete Customer Data within {{DELETION_DAYS}} days, except where retention is required by law (for example invoicing records) or where data remains in encrypted backups, which are overwritten within {{BACKUP_RETENTION_DAYS}} days. Before deletion you may export your data through the Service.

## 12. Audits

Once per year, or after a Personal Data Breach, you may audit our compliance with this DPA by requesting our most recent security documentation and certifications, and, where those are insufficient, by an on-site or remote audit conducted by you or an independent auditor bound by confidentiality, on {{AUDIT_NOTICE_DAYS}} days' notice, during business hours, at your cost, and without unreasonable disruption.

## 13. Liability

Each party's liability under this DPA is subject to the limitations and exclusions in the Terms of Service. Nothing limits liability that cannot be limited by law.

## 14. Term and termination

This DPA is effective for as long as we process Customer Data on your behalf. Sections 11 to 13 survive termination.

## 15. Governing law

This DPA is governed by the law of {{GOVERNING_LAW_JURISDICTION}}, without prejudice to the mandatory application of data protection law and the Standard Contractual Clauses.

## 16. Contact

Data protection contact: {{PRIVACY_EMAIL}}. Postal: {{COMPANY_ADDRESS}}. {{DPO_LINE}}

---

## Annex I: Details of processing

| Item | Detail |
|---|---|
| Data Subjects | Users and team members of the Controller; the Controller's end customers where the Controller submits their data |
| Personal Data | Name, email, hashed password or OAuth identifier, TOTP secret (encrypted), IP address and user agent in logs, usage events, billing identifiers (customer and subscription ids; card data is held by {{PAYMENT_PROCESSOR}} only), content submitted to the Service |
| Frequency | Continuous during the term |
| Retention | Term plus the periods in section 11; audit logs {{AUDIT_LOG_RETENTION_DAYS}} days |

## Annex II: Technical and organisational measures

Implemented by the template and its hosting:

- Encryption in transit (TLS 1.2+, HSTS) and at rest (managed database encryption; application-level AES-256 for API keys and OAuth tokens).
- Authentication: bcrypt-hashed passwords with a 12-character policy, RS256 access tokens (15 min) and rotating refresh tokens in httpOnly cookies, optional TOTP two-factor, account lockout after repeated failures, session revocation.
- Authorisation: role-based access (user/admin), team roles, tenant scoping on every tenant-owned query.
- Application security: CSP and security headers, CSRF double-submit tokens, strict CORS allow-list, request validation, parameterised SQL, rate limiting, dependency audits in CI.
- Logging and monitoring: structured logs without request bodies, error tracking, audit log of sensitive actions, health monitoring.
- Availability: managed container platform with health checks and automatic restarts, daily database backups with {{BACKUP_RETENTION_DAYS}}-day retention, tested restore procedure.
- Organisational: least-privilege access to production, secrets in a managed secrets store, onboarding/offboarding checklist, incident response procedure, annual review.

## Annex III: Approved Sub-processors

| Sub-processor | Purpose | Location |
|---|---|---|
| Amazon Web Services (App Runner, ECR, {{DB_SERVICE}}) | Application hosting, container registry, database | {{HOSTING_REGION}} |
| {{PAYMENT_PROCESSOR}} (Stripe or Polar) | Payments and invoicing | EU/US |
| {{EMAIL_PROVIDER}} (Resend, Amazon SES or SMTP provider) | Transactional email | {{EMAIL_PROVIDER_REGION}} |
| {{STORAGE_PROVIDER}} (Amazon S3 or Cloudflare R2) | File storage | {{STORAGE_REGION}} |
| Sentry | Error tracking | EU or US per configuration |
| GitHub | Source code hosting and CI | US |
| {{OTHER_SUBPROCESSORS}} | | |

Remove rows for services the product does not use.

## Change log

| Version | Date | Change |
|---|---|---|
| {{DPA_VERSION}} | {{EFFECTIVE_DATE}} | Initial version for {{PRODUCT_NAME}} |
