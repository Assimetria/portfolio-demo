# Runbook

> Purpose: pointer. The operations runbook lives in [docs/RUNBOOK.md](./docs/RUNBOOK.md); the brand-asset pipeline in [docs/brand-assets.md](./docs/brand-assets.md); the deploy pipeline in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
> Last verified: 2026-09-20.

Quick triage:

```bash
curl -s https://<app-url>/api/health | jq .
```

| Symptom | Go to |
|---|---|
| `status: degraded`, `db: disconnected` | docs/RUNBOOK.md section 2 |
| container exits with `FATAL: database migrations failed` | docs/RUNBOOK.md section 2 (`ALLOW_MIGRATION_FAILURE` is the temporary override) |
| `auth: misconfigured` | docs/RUNBOOK.md section 3 |
| deploy stuck or failed | docs/RUNBOOK.md section 1; roll back per section 12 |
| bad release is live | docs/RUNBOOK.md section 12 (previous ECR tag) |
| data loss / need a restore | docs/RUNBOOK.md section 13 (`scripts/backup-db.sh`, `scripts/restore-db.sh`) |
| customer wants their contact submissions | docs/RUNBOOK.md section 14 (CSV export) |
| wrong brand / colours | docs/RUNBOOK.md section 6 and docs/BRANDING.md |
| what we promise on data loss and downtime | docs/RUNBOOK.md section 15 (RPO / RTO) |
