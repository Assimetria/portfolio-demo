# Deployment

> Purpose: how a commit becomes a running container: GitHub Actions -> ECR -> AWS App Runner, the Dockerfile stages, every secret and env var, health checks, previews, rollback. CodeBuild equivalents are noted where they exist.
> Last verified: 2026-09-20 (`.github/workflows/{ci,deploy,preview,preview-cleanup}.yml`, `Dockerfile`, `start.sh`, `buildspec-ci.yml`, `buildspec-cd.yml`, `server/src/lib/@system/Env`, `server/src/lib/@custom/Env`, `server/.env.example`).

## 1. Pipeline

```
push / PR to main
   |
   v
ci.yml  (Node 22, 10 min)     lint -> client tests -> server tests -> npm run build -> docker build + /api/health smoke
   |  success on main
   v
deploy.yml (20 min)           configure-aws-credentials (eu-west-1) -> ECR login
                              docker build --no-cache --build-arg BUILD_SHA=<sha> -t <registry>/<ECR_REPO_NAME>:<sha> -t ...:latest .
                              docker push (both tags)
                              aws apprunner start-deployment --service-arn $APP_RUNNER_SERVICE_ARN
   |
   v
App Runner pulls :latest, runs the container on port 3000, health-checks it, shifts traffic
```

Pull requests additionally get `preview.yml`: builds `pr-<n>` image, creates or updates an App Runner service named `pr-<n>-<slug>` (slug from `brand.json`) and comments the URL; `preview-cleanup.yml` deletes it when the PR closes.

CodeBuild: `buildspec-ci.yml` mirrors `ci.yml`; `buildspec-cd.yml` builds, pushes to `ECR_REPOSITORY`, calls `aws apprunner update-service` with the new image and polls until `RUNNING`, then smoke-tests `APP_HEALTH_URL`. Use one or the other per repo, not both.

Every CI job is blocking (no `|| echo`), `deploy.yml` runs on `workflow_run` of CI and only when it succeeded on `main`, and `buildspec-cd.yml` uses `start-deployment` against a service already configured with port 3000 by Orkosi provisioning.

## 2. Repository secrets (GitHub Actions)

| Secret | Used by | Set by |
|---|---|---|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | deploy.yml, preview.yml | Orkosi provisioning (IAM user limited to ECR push + App Runner deploy) |
| `ECR_REPO_NAME` | image tag | Orkosi provisioning (repository created in `eu-west-1`) |
| `APP_RUNNER_SERVICE_ARN` | `start-deployment` | Orkosi provisioning |

Region is hardcoded to `eu-west-1` in the workflows.

## 3. Dockerfile (root)

| Stage | Base | Does |
|---|---|---|
| `client-deps` | `node:${NODE_VERSION}-alpine` | `cd client && npm ci --ignore-scripts` (cached layer) |
| `builder` | from `client-deps` | copies `brand.json`, `assets/`, `scripts/`, `client/`; **`node scripts/prebuild.js`**; `NODE_ENV=production npm run build --prefix client` |
| `production` | `node:${NODE_VERSION}-alpine` + tini, non-root `nodeapp` | `cd server && npm ci --omit=dev --ignore-scripts`; copies `server/src`, `server/scripts/drop-schema-migrations.js`, `.config/`, `brand.json`, `VERSION` (suffixed with the short SHA), the route manifest and `client/dist`; `EXPOSE 3000`; `HEALTHCHECK wget http://127.0.0.1:${PORT:-3000}/api/health`; `ENTRYPOINT tini -- /start.sh` |

`start.sh`: `PORT=${PORT:-3000}`, `SPA_HTML_DIR=/app/client/dist`, exports `VERSION` from `/app/VERSION`, generates an ephemeral `CSRF_SECRET` and RSA JWT key pair **only if none are provided** (set real ones in App Runner or every restart logs everyone out), clears `APP_URL` when `brand.json` has `customDomainConfigured: false`, injects `APP_URL` / Plausible / Sentry / brand placeholders into `index.html`, runs migrations **once** (then `SKIP_STARTUP_MIGRATIONS=1` so `server/src/index.js` does not repeat them) and `exec`s `node server/src/index.js`.

Migration policy in `start.sh`: database unreachable -> migrations are not attempted and the server boots degraded (`db: disconnected`); database reachable but a migration fails -> the container exits 1 (a brochure site with a half-migrated `contact_submissions` table must not accept traffic silently). `ALLOW_MIGRATION_FAILURE=1` is a deliberate, temporary operator override for schema repair (`docs/RUNBOOK.md` section 2).

Node version: the single source is the root `.nvmrc` (`22`). `ci.yml` reads it via `setup-node` `node-version-file`; the Dockerfile's `ARG NODE_VERSION` must equal it (pass `--build-arg NODE_VERSION=$(cat .nvmrc)` to pin explicitly). `buildspec-*.yml` and `e2e.yml` still spell out `22`; bump them together with `.nvmrc`.

Local reproduction of what CI builds:

```bash
docker build --no-cache --build-arg BUILD_SHA=$(git rev-parse --short HEAD) -t pt-local .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production -e DATABASE_URL='postgresql://postgres:postgres@host.docker.internal:5432/product_template_dev' \
  -e APP_URL=http://localhost:3000 -e CSRF_SECRET=$(openssl rand -hex 32) pt-local
curl -s http://localhost:3000/api/health
```

## 4. Runtime environment variables

Validation: `server/src/lib/@system/Env` (types, defaults, allowed values; in production `DATABASE_URL` and one source per JWT key are **required** — the process exits with a clear list instead of booting degraded) then `server/src/lib/@custom/Env` (`REQUIRED_VARS`: `DATABASE_URL`, `APP_URL` in production; warns on missing `REDIS_URL`, `ERROR_TRACKING_DSN`, `CSRF_SECRET`). `ALLOW_DEGRADED_BOOT=1` is the explicit, temporary override that lets production start without them for troubleshooting. The complete commented reference is the root `.env.example` (guarded by `server/test/unit/@system/env-example-drift.test.js`); `server/.env.example` is the minimal local starter `npm run bootstrap` copies; `client/.env.example` holds build-time `VITE_*` values.

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | yes (`production`) | Enables HSTS, secure cookies, pino JSON logs, static serving of `client/dist` |
| `PORT` | App Runner sets it (3000) | Listen port; the Env default is also 3000 (Dockerfile / App Runner contract), local dev uses 3001 from `server/.env` |
| `DATABASE_URL` | yes (enforced in production) | Postgres connection string; `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT`, `DB_POOL_CONNECTION_TIMEOUT`, `DB_POOL_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_SSL_CA` tune it; `DB_CONNECT_ATTEMPTS`, `DB_CONNECT_BASE_DELAY_MS`, `DB_CONNECT_MAX_DELAY_MS` tune the startup retry |
| `APP_URL` | yes | Public origin; CORS allow-list, email links, OAuth callbacks (`SERVER_URL` if the API origin differs) |
| `CORS_ORIGINS` | if extra origins | Comma-separated additional allowed origins |
| `JWT_PRIVATE_KEY` or `JWT_PRIVATE_KEY_FILE`, `JWT_PUBLIC_KEY` or `JWT_PUBLIC_KEY_FILE` | yes (enforced in production) | RS256 signing; inline PEM with `\n` escapes is fine. `start.sh` generates an ephemeral pair if none is set, so the container still boots — but every restart logs everyone out |
| `ALLOW_DEGRADED_BOOT` | never in steady state | `1` lets production start without `DATABASE_URL` / JWT keys (degraded). Incident use only |
| `CSRF_SECRET` | yes (32+ chars) | CSRF token signing |
| `ENCRYPT_KEY`, `ENCRYPT_IV` | yes if storing API keys / OAuth tokens | AES-256-CBC at rest |
| `REDIS_URL` | recommended | Rate-limit store, logout blacklist, cache, BullMQ |
| `SENTRY_DSN` / `ERROR_TRACKING_DSN` | recommended | Error tracking (server); `VITE_ERROR_TRACKING_DSN` at build for the client |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`; `PAYMENT_PROVIDER=stripe|polar`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET` | if billing | Payments |
| `EMAIL_PROVIDER=ses|smtp|resend`, `EMAIL_FROM`, `RESEND_API_KEY`, `SMTP_*`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL` | if email | Email adapter (auto-detected from the keys present; console adapter otherwise) |
| `STORAGE_PROVIDER=s3|r2` (default `s3`), `S3_BUCKET`, `S3_ENDPOINT`, `CDN_URL`, `R2_*`, `MAX_FILE_SIZE_MB` | if uploads | Storage adapter. `local` is **refused in production** (container disk is ephemeral on App Runner — uploads vanish on deploy); `ALLOW_EPHEMERAL_STORAGE=1` overrides for throwaway demos only. `LOCAL_STORAGE_DIR` is dev-only |
| `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` | if OAuth | OAuth providers |
| `APP_NAME`, `PRODUCT_NAME`, `API_VERSION`, `SUPPORT_EMAIL` | optional | Emails, TOTP issuer, OpenAPI title |
| `VERSION`, `GIT_SHA` | set by start.sh / Dockerfile (`ENV GIT_SHA=$BUILD_SHA`) | Shown by `/api/health`; `GIT_SHA` is also the Sentry release |
| `LOG_LEVEL`, `SERVICE_NAME` | optional | Logging |
| `TEST_API_KEY` | optional | `X-Test-Key` bypasses rate limits (CI smoke) |
| `SKIP_CSRF`, `GRAPHQL_INTROSPECTION` | never in production | Dev toggles |

Client build-time (`client/.env`, read by Webpack `DefinePlugin` as `import.meta.env.VITE_*`): `VITE_APP_URL`, `VITE_API_URL` (leave empty to use same-origin `/api`), `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_ERROR_TRACKING_DSN`, `VITE_GA_MEASUREMENT_ID`, `VITE_GTM_ID`, `VITE_INTERCOM_APP_ID`, `VITE_FACEBOOK_PIXEL`. The `VITE_` prefix is historical; Webpack is the bundler.

Remove leftover `RAILWAY_*` variables from any environment: `PostgreSQL/index.js` (`RAILWAY_ENVIRONMENT`) and `Middleware/cors.js` (`RAILWAY_PUBLIC_DOMAIN`) still honour them for compatibility and they can override `DATABASE_URL` and CORS. The health endpoint no longer reads `RAILWAY_GIT_COMMIT_SHA`; use `GIT_SHA`.

## 5. Health and verification

Two endpoints with two jobs (`server/src/api/@system/health/index.js`):

| Endpoint | Semantics | Who uses it |
|---|---|---|
| `GET /api/health` (and `/health`) | **Liveness.** Always HTTP 200 while the process answers; body `{ status: ok\|degraded, db, db_source, auth, version, uptime, timestamp, checks, db_error? }`. | **App Runner service health check** (configured by Orkosi provisioning outside this repo: protocol HTTP, path `/api/health`). Keep it here so a transient DB blip (credential rotation, RDS maintenance) never rolls a deployment back or restarts a healthy process. Monitoring alerts on `status != ok`. |
| `GET /api/ready` (and `/ready`) | **Readiness.** HTTP 200 with `ready: true` only when `SELECT 1` succeeds; HTTP 503 with `ready: false` otherwise (same body fields plus `ready`). | `deploy.yml` / `buildspec-cd.yml` post-rollout verification (`APP_HEALTH_URL` defaults to `https://<service-url>/api/ready`), Docker `HEALTHCHECK`, `docker-compose.yml` `service_healthy`, `scripts/@system/ci/deploy-healthcheck.sh`. Point a load balancer here when it must stop routing to an instance without a database. |
| `GET /healthz` | Shallow `{status:"ok"}` | Kubernetes-style probes |

Do **not** point the App Runner health check at `/api/ready`: the first deploy of a customer often happens before RDS credentials are final, and a 503 there makes App Runner roll back to the previous image forever (the Railway-era #18857 loop). The pipeline gate on `/api/ready` is what fails loudly instead.

- After deploy: `BASE_URL=https://<app-url> npx jest test/smoke --forceExit` from `server/` (covers `/api/health` and `/api/ready`), or `scripts/@system/ci/deploy-healthcheck.sh https://<app-url>` (polls `/api/ready` up to 10 times; `REQUIRE_DB=false` polls `/api/health` and accepts `degraded`).
- CI smoke (`scripts/ci/docker-smoke.sh`) boots the image with an unreachable database and asserts `/api/health` → 200 `degraded` **and** `/api/ready` → 503, so the readiness endpoint can never silently start lying.
- Version check: `curl -s https://<app-url>/api/health | jq .version` should end with the deployed short SHA.

## 6. Rollback

App Runner keeps previous images in ECR. The full operator procedure (verification, the `update-service` alternative that pins a tag, migration caveats) is `docs/RUNBOOK.md` section 12; the short version:

```bash
# 1. find the previous good tag (commit SHA)
aws ecr describe-images --repository-name <ECR_REPO_NAME> --region eu-west-1 \
  --query 'sort_by(imageDetails,&imagePushedAt)[-5:].[imageTags,imagePushedAt]' --output table

# 2. retag it as latest and redeploy
MANIFEST=$(aws ecr batch-get-image --repository-name <ECR_REPO_NAME> --image-ids imageTag=<good-sha> --region eu-west-1 --query 'images[0].imageManifest' --output text)
aws ecr put-image --repository-name <ECR_REPO_NAME> --image-tag latest --image-manifest "$MANIFEST" --region eu-west-1
aws apprunner start-deployment --service-arn <APP_RUNNER_SERVICE_ARN> --region eu-west-1
```

Or `git revert` the bad commit on `main` and let the pipeline redeploy. Migrations are forward-only in practice (`npm run migrate:rollback` exists but rolling back code that dropped columns needs a data plan); prefer additive migrations so old and new images can both run.

## 7. First deploy of a new customer repo (what Orkosi does)

1. Create `Assimetria/customer-<slug>` from the template; default branch `dev`.
2. Write `brand.json`, `@custom` identity/text/content, initials logo.
3. Create the ECR repository and App Runner service (port 3000, health check protocol HTTP, path `/api/health` — liveness, see section 5), set the four Actions secrets (optionally `APP_HEALTH_URL=https://<domain>/api/ready`).
4. Set runtime env vars on the App Runner service (section 4), at minimum `NODE_ENV`, `DATABASE_URL`, `APP_URL`, `CSRF_SECRET`, `JWT_*`, `ENCRYPT_*`.
5. Merge `dev` into `main`; CI then Deploy run; verify `/api/health`.

## 8. Cost and hygiene

- Preview services are deleted by `preview-cleanup.yml`; check App Runner for orphans named `pr-*` after force-closed PRs.
- ECR: add a lifecycle policy that keeps `latest` and the last 10 SHA tags.
- Logs: App Runner application logs go to CloudWatch; set a retention period.
