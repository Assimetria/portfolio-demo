# Runbook

> Purpose: what to do when a customer app misbehaves: diagnose in order, fix, verify. Sections 12-15 are the operations procedures (rollback, backup/restore drill, contact-submission export, RPO/RTO). Commands assume the AWS CLI is configured for `eu-west-1` and you know the App Runner service ARN and ECR repository name (GitHub Actions secrets `APP_RUNNER_SERVICE_ARN`, `ECR_REPO_NAME`).
> Last verified: 2026-09-20 (`start.sh`, `.github/workflows/deploy.yml`, `scripts/backup-db.sh`, `scripts/restore-db.sh`, `server/src/db/migrations/@system/030_contact_submissions.js`).

## 0. First 60 seconds

```bash
APP=https://<app-url>
curl -s $APP/api/health | jq .            # liveness: status, db, db_source, auth, version (always 200)
curl -s -o /dev/null -w '%{http_code}\n' $APP/api/ready   # readiness: 200 = DB reachable, 503 = not
curl -s -o /dev/null -w '%{http_code}\n' $APP/            # SPA shell should be 200
aws apprunner describe-service --service-arn <ARN> --query 'Service.[Status,ServiceUrl]' --output text
aws apprunner list-operations --service-arn <ARN> --max-results 3
```

`/api/ready` 503 or `status: degraded` with `db: disconnected` -> section 2. `auth: misconfigured` -> section 3. Service `OPERATION_IN_PROGRESS` for > 15 min or `CREATE_FAILED` -> section 1. 502/503 from the shell -> section 1 then 2.

Logs: App Runner -> service -> Logs (application logs are pino JSON in production). Filter on `"level":50` (error) or the request path.

## 1. Deploy failed or app not starting

1. Check the GitHub Actions run (`Deploy` workflow) for the failing step: ECR login (IAM), `docker build` (usually `npm run build`), or `start-deployment` (fails with "operation in progress" if a previous deploy is still rolling; wait and re-run).
2. Reproduce the image locally: `docker build --no-cache -t pt-local .` then run it with `NODE_ENV=production DATABASE_URL=... APP_URL=...` and hit `/api/health` (full recipe in `docs/DEPLOYMENT.md` section 3).
3. Boot order to check in logs (`[start]` lines come from `start.sh`): built client present -> ephemeral CSRF/JWT warnings -> `Database reachable — running pre-migration checks` or `database unreachable — migrations not attempted` -> `Migrations complete.` or `FATAL: database migrations failed` -> `[Env:@custom] Startup aborted` (missing `DATABASE_URL`/`APP_URL` in production) -> `server started`.
4. Roll back if needed: section 12.

## 2. Database degraded

- `db_source` in `/api/health` tells you where the connection string came from (`database_url`, `pg_vars_fallback`, `localhost_default`, `railway_pg_vars`). `localhost_default` in production means `DATABASE_URL` is not set on the service.
- `db_error` gives the driver code (`ECONNREFUSED`, `28P01` bad password, `ETIMEDOUT` security group / VPC connector, `self signed certificate` -> set `DB_SSL_REJECT_UNAUTHORIZED=false` or provide `DB_SSL_CA`).
- Pool exhaustion (`connection timeout` -> 503 from the error handler): raise `DB_POOL_MAX` (default 10) or find the leaking query in logs; `DB_POOL_CONNECTION_TIMEOUT` defaults to 2000 ms via Env and 10000 ms via the pool file, so set it explicitly.
- Migrations: `cd server && npm run migrate:status` against the prod URL from a trusted machine; if `schema_migrations` is inconsistent, never run `drop-schema-migrations.js` on production; fix the row by hand.
- **Container exits with `[start] FATAL: database migrations failed (database was reachable)`**: this is deliberate. The database answered but `run.js` failed, so the schema does not match the build and the contact form would fail silently. App Runner keeps the previous healthy instances serving. Procedure: (1) read the migration error in the failed deployment's logs; (2) take a backup (section 13); (3) fix the cause — usually a hand-edited table or a `@custom` migration that assumed a dropped column — and run `cd server && DATABASE_URL=<prod> npm run migrate` from a trusted machine, then `start-deployment` again; (4) only if the site must be up before the schema can be fixed, set `ALLOW_MIGRATION_FAILURE=1` on the service, redeploy, and **remove the variable as soon as migrations pass** — while it is set, a broken schema serves traffic with `/api/health` reporting `db: connected`.

## 3. Auth / login problems

- `auth: misconfigured`: `JWT_PRIVATE_KEY[_FILE]` or `JWT_PUBLIC_KEY[_FILE]` missing or mismatched. Set both on the App Runner service; both must come from the same key pair. If `start.sh` generated ephemeral keys, every restart logs everyone out and multi-instance services reject each other's tokens.
- Users logged out on every deploy: same cause, or `CSRF_SECRET` missing (also auto-generated per process).
- 403 `CSRF_VALIDATION_FAILED` on POST: client did not send `X-CSRF-Token`, or the `__Host-` cookie was rejected because the request is not HTTPS end to end (`trust proxy` is set to 1; App Runner terminates TLS). Confirm `NODE_ENV=production` and that the client uses `lib/@system/api.js`.
- 401 loops between `/app` and `/auth`: `POST /api/sessions/refresh` failing; check the `refresh_token` cookie path (`/api/sessions`) and that `APP_URL` matches the origin the browser uses (cookies are `SameSite=Lax`).
- Locked out after failed logins: `AccountLockout` keys `auth:lockout:<id>` in Redis expire after 15 min; delete the key to unlock early.
- OAuth redirect mismatch: `APP_URL`/`SERVER_URL` must equal the callback registered with Google/GitHub.

## 4. CORS errors in the browser

Add the exact origin (scheme + host, no path) to `CORS_ORIGINS` on the service, or fix `APP_URL`. Rejections return `403 CORS: origin '...' not allowed` in the network tab. Remove stale `RAILWAY_PUBLIC_DOMAIN` variables; they add origins silently.

## 5. Rate limiting complaints

Limits are enforced only in production (`NODE_ENV`). Headers `RateLimit-*`/`X-RateLimit-*` show the window. For CI or load tests set `TEST_API_KEY` on the service and send `X-Test-Key`. Redis-backed counters live under `rl:<prefix>:`; deleting the key resets one client.

## 6. Brand not applied / wrong colours or name

- The site shows "Product Template" or grey colours: `brand.json` was not committed or `scripts/prebuild.js` did not run. Check the build log for `apply-brand` output; run `npm run apply-brand` locally, commit `brand.json` and the regenerated `client/src/app/styles/@custom/brand.css` and `client/src/config/@custom/info.js`.
- Colours right, `<title>` wrong: `client/index.html` gets `BRAND_NAME` from `brand.json` `companyName` (legacy `name`); rebuild.
- Dark/light wrong by default: `defaultTheme` in `brand.json`; users with an existing `app-theme` in localStorage keep their choice.
- Fonts not loading: CSP `style-src`/`font-src` allow Google Fonts; check the console for blocked requests and `brandFonts` family names.
- Logo 404: files must exist in `assets/logos/` (served at `/assets/logos/*`); `info.logo` defaults to `/assets/logos/logo-mark.svg`.

## 7. CSP blocked a script or API call

Console shows `Refused to load the script ... violates Content Security Policy`. Add the origin to `brand.json` `securityHeaders.contentSecurityPolicy.scriptSrc` (scripts) or `connectSrc` (fetch/XHR/websocket), redeploy. Inline scripts are not allowed except the hashed cookie-consent snippet.

## 8. Emails not sent

`EMAIL_PROVIDER` unset means auto-detect: Resend if `RESEND_API_KEY`, SMTP if `SMTP_HOST`, SES if AWS keys, otherwise console (logged only). Check `email_logs` (if the product enables `EmailLogRepo`) and the provider dashboard. The BullMQ email queue needs `REDIS_URL`; without Redis sends are synchronous.

## 9. Stripe webhooks failing

Signature errors: `STRIPE_WEBHOOK_SECRET` must match the endpoint in the Stripe dashboard for this URL (`/api/stripe/webhook`), and the route must receive the raw body (handled by `express.json` `verify` for URLs ending in `/webhook`; do not add another body parser). Local testing: `stripe listen --forward-to localhost:3001/api/stripe/webhook`.

## 10. Local development issues

- `npm run first-setup` finished but the API fails: run `npm install` in `server/` and `client/`, then `cd server && npm run migrate`.
- `bootstrap` says files exist: intended; `npm run bootstrap:force` regenerates envs and keys.
- Webpack does not reload `@system`/`@custom` edits: the config watches them explicitly; restart `npm run dev:client` if the watcher was started before the directory existed.
- Build fails after a template sync: `npm run generate-barrels` then `npm run build`.
- Playwright: `npx playwright install --with-deps`; app must be running on `BASE_URL`.
- Port clash: API `PORT` in `server/.env` (3001) and dev server 3000 (`client/webpack.config.mjs` `devServer.port`); the proxy target is hardcoded to 3001.

## 11. Template sync went wrong (product repos)

`scripts/@system/check-system-sync.sh` lists drifted `@system` files. Re-run `scripts/@system/sync-upstream.sh <product-dir>` from a template checkout; local patches inside `@sync-guard` regions survive, others are three-way merged. Resolve conflicts by moving product changes to `@custom`.

## 12. Rollback (App Runner, previous ECR tag)

Every deploy pushes `<registry>/<ECR_REPO_NAME>:<full-sha>` and `:latest`; the App Runner service tracks `:latest` with auto-deploy off, so rolling back means making `:latest` point at the previous SHA and starting a deployment. Nothing is rebuilt.

```bash
REPO=<ECR_REPO_NAME>; ARN=<APP_RUNNER_SERVICE_ARN>; REGION=eu-west-1

# 1. what is running and what is available (newest last)
curl -s https://<app-url>/api/health | jq -r .version            # 2.0.0+<short-sha>
aws ecr describe-images --repository-name "$REPO" --region $REGION \
  --query 'sort_by(imageDetails,&imagePushedAt)[-6:].[imageTags,imagePushedAt]' --output table

# 2. retag the last good SHA as latest (manifest copy, no pull/push)
GOOD=<previous-full-sha>
MANIFEST=$(aws ecr batch-get-image --repository-name "$REPO" --region $REGION \
  --image-ids imageTag="$GOOD" --query 'images[0].imageManifest' --output text)
aws ecr put-image --repository-name "$REPO" --region $REGION --image-tag latest --image-manifest "$MANIFEST"

# 3. roll the service and wait
OP=$(aws apprunner start-deployment --service-arn "$ARN" --region $REGION --query OperationId --output text)
aws apprunner list-operations --service-arn "$ARN" --region $REGION --max-results 5 \
  --query "OperationSummaryList[?Id=='$OP'].[Type,Status]" --output text   # repeat until SUCCEEDED
curl -s https://<app-url>/api/health | jq -r '.version,.status'   # short sha of $GOOD, status ok
```

Alternative when `:latest` must not be touched (for example during a forensic investigation): pin the service to the tag directly with `aws apprunner update-service --service-arn "$ARN" --source-configuration '{"ImageRepository":{"ImageIdentifier":"<registry>/'"$REPO"':'"$GOOD"'","ImageRepositoryType":"ECR","ImageConfiguration":{"Port":"3000"}}}'`. `update-service` replaces the whole `ImageRepository` block, so include `Port` (and `RuntimeEnvironmentVariables`/`RuntimeEnvironmentSecrets` if the service defines them there — check `describe-service` first). Point the service back at `:latest` the same way once the incident is over, otherwise the next `deploy.yml` run pushes an image nobody deploys.

Then fix forward: `git revert` the bad commit on `main` (customer repos: on `dev`, then PR to `main`). Never force-push. Migrations from the bad release stay applied — template migrations are additive, so the previous image keeps working; a release that dropped or renamed a column needs a data plan before rollback (section 13).

## 13. Database backup and restore drill

Production data is the RDS instance behind `DATABASE_URL`. Two layers:

1. **RDS automated backups** (owned by provisioning): daily snapshot + point-in-time recovery when enabled on the instance. Restore = new instance from snapshot/time -> new endpoint -> update `DATABASE_URL` on the App Runner service -> `start-deployment`.
2. **Logical dumps** with the repo scripts, for pre-migration safety copies, exports to staging and the drill below. Run them from a trusted machine with network access to the database (bastion or VPC), never from the App Runner container.

```bash
# backup (pg_dump custom format, gzipped, rotates to --keep)
DATABASE_URL='postgresql://…' ./scripts/backup-db.sh --output ./backups --label pre-migration --keep 14

# restore into a database: --confirm must equal the database name in the target URL
DATABASE_URL='postgresql://…/target_db' ./scripts/restore-db.sh \
  --input backups/<db>_<timestamp>_pre-migration.dump.gz --confirm target_db
```

`restore-db.sh` refuses to run without `--confirm <dbname>`, takes a `pre-restore` safety backup of the target first (`--no-pre-backup` to skip), and runs `pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error`. Finish with `cd server && DATABASE_URL=<target> npm run migrate:status` — pending migrations are applied by `start.sh` on the next deploy, or run `npm run migrate` by hand.

**Drill (quarterly, and before any release that changes the schema):**

1. Backup production with `--label drill`.
2. Restore it into a scratch database (`createdb <slug>_drill` on the same instance, or a local Postgres from `npm run db-local`).
3. Point a local checkout at it: `cd server && DATABASE_URL=<scratch> npm run migrate:status` must show every migration applied; `SELECT count(*) FROM contact_submissions;` must match production.
4. Boot the app against the scratch database and open `/app/contact`.
5. Record the elapsed time in the incident log — that is the measured RTO for a restore (section 15). Drop the scratch database.

## 14. Export contact submissions

Until an export endpoint exists, export straight from the database (the admin inbox at `/app/contact` and `GET /api/contact` paginate but do not export). Columns come from migration `030_contact_submissions`.

```bash
DATABASE_URL='postgresql://…'
psql "$DATABASE_URL" -c "\copy (SELECT id, created_at, name, email, phone, subject, message, source_path, read_at FROM contact_submissions ORDER BY created_at) TO 'contact-submissions-$(date +%Y%m%d).csv' WITH (FORMAT csv, HEADER)"
```

`ip` and `user_agent` are excluded on purpose: they are operational data, not something to hand to the customer; add them only when the request is a security investigation. The CSV contains personal data — deliver it over the customer's agreed channel, delete the local copy, and note the export in the task. Retention: `CONTACT_RETENTION_DAYS` purges older rows when set; an export before enabling it is the last copy.

## 15. RPO / RTO

Template defaults; a customer's contract can tighten them, in which case provisioning enables RDS PITR and shortens the backup interval.

| Metric | Target | How it is met | How to verify |
|---|---|---|---|
| RPO (data loss) | 24 h with RDS automated backups; 5 min with PITR enabled | RDS daily snapshot; `backup-db.sh` before every schema-changing release | `aws rds describe-db-instances --query '...[BackupRetentionPeriod,LatestRestorableTime]'` |
| RTO application (bad release, container crash) | < 15 min | Rollback to the previous ECR tag (section 12); App Runner keeps the last healthy instances serving during a failed deploy | Deploy summary in Actions; `/api/health` version |
| RTO database (restore from dump) | < 60 min for databases under 5 GB | Section 13 drill; time recorded per drill | Drill log |
| Stateless everything else | 0 | The image is rebuilt from git; uploads are on S3/R2 (`STORAGE_PROVIDER=local` is refused in production without `ALLOW_EPHEMERAL_STORAGE=1`) | `docker build` from the tagged SHA |

An informational site has one stateful asset: `contact_submissions`. If a restore is imminent and recent submissions matter, export them first (section 14) and re-import after.

## 16. Escalation

Template bugs: open an issue in `Assimetria/product-template-informational` with the `/api/health` output, the failing workflow URL and the short SHA from `version`. Security issues: see `docs/SECURITY.md`.
