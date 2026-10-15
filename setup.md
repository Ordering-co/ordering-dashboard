# Dashboard setup

Use Node 24 (`.nvmrc`) and pnpm 9.15.0 (`packageManager`). Preserve the lockfile and the current checkout's configuration. For repository conventions, follow [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md). The [README](README.md) provides the short agent-assisted path; this guide covers manual setup, Docker, quality checks, and deployment context. Registry packages and the exact GitLab archive in pnpm-lock.yaml must be accessible over HTTPS.

## Configuration and startup

If you do not already have a checkout, clone the repository:

```sh
git clone https://github.com/Ordering-co/ordering-dashboard.git
cd ordering-dashboard
```

Enable the pinned pnpm version through Corepack:

```sh
corepack enable && corepack prepare pnpm@9.15.0 --activate
```

Install, configure your project, and start the development server (port 3001):

```sh
pnpm install --frozen-lockfile
node scripts/onboarding/cli.mjs detect
node scripts/onboarding/cli.mjs configure --project my-project
node scripts/onboarding/cli.mjs doctor
pnpm dev --host 127.0.0.1
```

Replace `my-project` with a slug you own or are authorized to use. Confirm the project before reusing an existing native connection or prepared local helper. Without a connection, provide the explicit slug and use public validation for manual client setup. No new browser login or connection registration is required; use your normal account when you need authenticated app data.

`configure` validates public `/current` without Authorization, then atomically updates `project`, existing `configurations.subdomain`, the explicit `localProjectConfigured: true` setup marker, and any supplied API URL/version/language options. It preserves other fields, flags, IDs, billing, socket, and integrations. An already configured different project requires `--confirm-project-change`. Keep credentials out of frontend configuration and preserve your existing customization.

Backups are private under ignored `.ordering-setup/`. Pass the exact `backup` filename to `restore --backup`, without its directory prefix. `doctor` alone does not enable local mode: it checks configuration and public project resolution, not membership, permissions, HTTP serving, or browser rendering. See the [runbook](docs/onboarding-runbook.md) for diagnostics, project changes, a first visible edit, updates, and disconnecting.

During development, only a real project with `localProjectConfigured: true` in source `src/config.json` pins the tenant ahead of domain discovery, stale global sessions, injected runtime, and another tenant's autologin query. Identity and provider caches are scoped by API/version/tenant; language remains shared. The login shows the selected project. Reload after changing project or API. A historical project value or DEV mode alone does not opt in: without the source marker, existing Worker/domain/query/session behavior is unchanged. Worker or theme updates cannot enable the marker. For manual configuration, set the project fields and add the boolean marker only after explicitly selecting your local project; remove it or set it to false to restore the previous behavior. Hosted production retains the existing resolver, selection behavior, and authentication guards even when the marker is present.

## Optional services

Review API/socket URLs, business flags, and the integrations you need. Preserve existing configuration; copy `.env.example` to `.env` only if it does not exist and your optional Open Graph/imports/maps/assets require configuration. Supply your own Supabase/import settings. Every VITE variable is browser-visible; never put server or agent secrets in it.

Optional Stripe/PostHog/Sentry/GTM/Intercom destinations are blank by default. Supply your own public client identifiers and opt in explicitly to analytics. Intercom requires `intercom_app_id`. Local development skips push initialization. Authentication and data access require your normal project permissions; no administrative credentials are supplied. Local setup does not provision a backend, publish, or deploy.

## Docker alternative

With Docker installed, the existing image uses Node 22 and pnpm:

```sh
docker compose up
```

Open `http://localhost:3001`. The native local setup above uses Node 24.

## Architecture and Settings

This admin Dashboard uses functional components and Vite 7. Controllers, dashboard UI, and the SDK live in-tree at `src/@/components-dashboard`, with path aliases `~components` and `~ui`.

Project configs are unlocked for every customer and edited only on `/settings`. Read [the Settings guide](docs/SETTINGS.md) before changing Settings or any other config editor.

## Quality checks

```sh
node --test scripts/onboarding/core.test.mjs scripts/onboarding/product.test.mjs
pnpm lint:check
pnpm build
pnpm exec vitest --coverage --run --pool=forks --maxWorkers=2
node scripts/coverage-summary.js --no-run --strict
pnpm palette:coverage
node i18n/check-generated.cjs
node i18n/verify.cjs
```

Use `pnpm run lint` when you want ESLint to apply fixes; `lint:check` above leaves files unchanged. Production builds allocate 8GB Node heap (`NODE_OPTIONS`) due to bundle size.

The [public CI Quality Gate](.github/workflows/ci.yml) checks translations, lint, build, tests and scoped coverage. The coverage gate requires an average of at least 70% across statements, branches, functions and lines in the source-defined scope. It does not measure complete product/backend correctness. Local tests and build do not verify authenticated workflows, real orders/payments or a production deployment.

Keep execution-specific reports, screenshots, logs, and run manifests outside the product tree in the task evidence location. Maintain durable instructions and tests here without embedding results of a particular run.

## Optional Worker hosting

The app can be hosted with Cloudflare Workers and static assets from `dist/`. See [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md). Use your own account, worker names, tenant and bindings. No deployment or live translation sync runs in public CI. Enabling the optional source-downloads endpoints requires your own compatible R2 bucket and configuration; see [the backend contract](docs/SOURCE_CODE_DOWNLOADS.md). Local setup does not authorize publication or deployment.

## Open Source Code

See [public source code](docs/public-source-code.md) for repository links, setup guidance and access requirements.
