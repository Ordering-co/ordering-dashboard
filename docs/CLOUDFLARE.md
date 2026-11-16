# Optional Cloudflare Worker hosting

The Worker serves SPA assets and injects project configuration and SEO. The app can also run directly in Vite for local development. Public CI checks source quality only.

## Build and run locally

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm cf:dev
```

Use Node 24 and the pnpm version in `package.json`. Use the root asset base for a root deployment. If serving under a subpath, configure `ASSET_BASE_URL` or `VITE_ASSET_BASE_URL` before building and keep the Worker and asset URLs consistent.

## Configure your Worker

Start from `wrangler.toml` and configure your own account and authorized project before deploying. Keep the Worker entry point, the `dist` assets and the `ASSETS` binding. Use Worker variables for API, socket, project and cache settings. Keep credentials in local or provider secret storage.

Check that a real asset returns its original response and an unknown asset returns 404, while a page navigation can fall back to the SPA. Check `GET /version` for uncached JSON with `commit` and `built_at`. The commit is null when the build has no valid CI commit value; a local HTTP 200 alone does not identify a deployed build.

Source downloads are optional. Configure your own bucket with the `SOURCE_DOWNLOADS` binding and use the [backend contract](SOURCE_CODE_DOWNLOADS.md). Public source publication does not provision a Worker, API project or bucket.
