# Dashboard setup

Use Node 24 and pnpm 9.15.0 (the packageManager pin). Registry packages and the exact GitLab archive in pnpm-lock.yaml must be accessible over HTTPS.

1. Install with `pnpm install --frozen-lockfile`.
2. Set `project` and `configurations.subdomain` in `src/config.json` to your authorized Ordering project. Review API/socket URLs, business flags and the optional integrations you need.
3. Copy `.env.example` to `.env` only if your optional imports/maps/assets require configuration. Supply your own Supabase/import settings. Every VITE variable is browser-visible; never put server secrets in it.
4. Optional Stripe/PostHog/Sentry/GTM/Intercom destinations are blank by default. Supply your own public client identifiers and opt in explicitly to analytics. Intercom requires `intercom_app_id`. Local development skips push initialization.
5. Run `pnpm dev --host 127.0.0.1`. Authentication and data access require your normal project permissions. No administrative credentials are supplied.

## Quality checks

```sh
pnpm lint:check
pnpm build
pnpm exec vitest --coverage --run --pool=forks --maxWorkers=2
node scripts/coverage-summary.js --no-run --strict
node i18n/check-generated.cjs
node i18n/verify.cjs
```

The coverage gate requires an average of at least 70% across statements, branches, functions and lines in the source-defined scope. It does not measure complete product/backend correctness. Local tests and build do not verify authenticated workflows, real orders/payments or a production deployment.

## Optional Worker hosting

See [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md). Use your own account, worker names, tenant and bindings. No deployment or live translation sync runs in public CI. Enabling the optional source-downloads endpoints requires your own compatible R2 bucket and configuration; see [the backend contract](docs/SOURCE_CODE_DOWNLOADS.md).
