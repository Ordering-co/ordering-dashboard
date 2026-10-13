# Optional Cloudflare Worker hosting

The existing Worker serves SPA assets and injects project configuration and SEO. Build with `pnpm build`, then configure your own worker/account in wrangler.toml and your authorized PROJECT in each environment. Runtime variables may override asset paths, API/socket endpoints and caching settings.

If you enable source downloads, configure your own R2 bucket through the `SOURCE_DOWNLOADS` binding and follow [the backend contract](SOURCE_CODE_DOWNLOADS.md). Public CI performs quality checks only. Deploy only after reviewing your own configuration and authorization; none is triggered by publishing this source repository.
