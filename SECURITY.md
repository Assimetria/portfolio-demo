# Security policy

> Purpose: how to report a vulnerability and where the security documentation lives.
> Last verified: 2026-09-20.

## Reporting

Email security@assimetria.com with a description, reproduction steps and the affected repository (`product-template` or a `customer-<slug>` fork). Do not open a public issue. We acknowledge within 2 business days and aim to ship a fix in the template, then sync it to products, within 14 days for high severity.

## Documentation

- [docs/SECURITY.md](./docs/SECURITY.md) — the controls: headers and CSP, CORS, CSRF, rate limiting, auth cookies and tokens, validation and SQL, tenant scoping, secrets, webhooks, GDPR.
- [docs/SECURITY_CHECKLIST.md](./docs/SECURITY_CHECKLIST.md) — pre-release checklist.
- [CLAUDE.md](./CLAUDE.md) — the rules agents must follow when adding code (zod on every mutation, `$1` placeholders, tenant scoping).

## Supported versions

Only the `main` branch of the template and the current `main` of each customer repo receive fixes; products stay current by running `scripts/@system/sync-upstream.sh`.
