# Dashboard setup

Use **Node 24 and pnpm 9.15.0**, pinned in `packageManager`. Follow `.nvmrc` and preserve `pnpm-lock.yaml`. Registry packages and the exact GitLab archive in the lockfile require HTTPS access. Do not update dependencies or generate other lockfiles just to start the app.

## Configuration and startup

```sh
pnpm install --frozen-lockfile
node scripts/onboarding/cli.mjs detect
node scripts/onboarding/cli.mjs configure --project my-project
node scripts/onboarding/cli.mjs doctor
pnpm dev --host 127.0.0.1
```

Replace `my-project` with your authorized slug. Before writing `project` and `configurations.subdomain` in `src/config.json`, `configure` validates public `/current` without a token. It preserves other fields and creates a private backup in `.ordering-setup/`. To change an already configured project, use `--confirm-project-change`. The helper also accepts `--api-url`, `--api-version v400`, and `--language` for public API configuration. Do not put credentials in Git or browser variables.

During development, a configured slug pins the tenant ahead of the host and previous localStorage. Provider identity and caches are scoped by API/version/tenant; an autologin URL for another tenant is ignored and cleaned. Reload after changing project/API. The `your-project-slug` template and hosted runtime keep the existing resolver. The helper reports configuration and public API status, not whether your server is running or you have permissions. Check HTTP and the browser separately, and sign in manually for private data.

[README.md](README.md) contains the initial prompt. [docs/onboarding-runbook.md](docs/onboarding-runbook.md) covers diagnostics, your first edit, tenant changes, updates, and restore/disconnect.

## Optional integrations

Review API/socket URLs and business flags. Copy `.env.example` to `.env` only if your optional imports/maps/assets need configuration. Supply your own Supabase/import settings. Every VITE variable is browser-visible; never put server secrets in it.

Stripe/PostHog/Sentry/GTM/Intercom destinations are blank by default. Supply your own public client identifiers and opt in to analytics explicitly. Intercom requires `intercom_app_id`. Local development skips push initialization. Public source does not supply administrative credentials or access to production.

## Quality checks

```sh
node --test scripts/onboarding/core.test.mjs scripts/onboarding/product.test.mjs
pnpm lint:check
pnpm build
pnpm exec vitest --coverage --run --pool=forks --maxWorkers=2
node scripts/coverage-summary.js --no-run --strict
node i18n/check-generated.cjs
node i18n/verify.cjs
```

The coverage gate requires an average of at least 70% across statements, branches, functions, and lines in the source-defined scope. It does not measure complete product/backend correctness. Local tests and build do not verify authenticated workflows, real orders/payments, or a production deployment.

## Optional Worker hosting

See [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md). Use your own account, Worker names, tenant, and bindings. Public CI does not deploy or synchronize translations live. Optional source-downloads endpoints require your own compatible R2 bucket and configuration; see [the backend contract](docs/SOURCE_CODE_DOWNLOADS.md).
