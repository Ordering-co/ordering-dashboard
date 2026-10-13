# Source Code Downloads — backend contract

This document defines the optional Dashboard Worker and local Vite adapter contract. The versioned [JSON Schema](./source-code-contract.schema.json) defines the shared interface for the artifact producer and Dashboard client. See [setup.md](../setup.md) for application configuration.

## HTTP API

Both endpoints are same-origin `GET` requests and require `Authorization: Bearer <Ordering dashboard session token>`. Tokens in query parameters are rejected. On the exact shared Dashboard hosts (`dashboard.orderingplus.com`, `dashboard.tryordering.com`, `dashboard.ordering.co`, and `dashboardcf.orderingplus.com`), the browser also sends its current `session.project` in `X-Ordering-Project`. This header is a tenant selection signal, not an authorization claim. The Worker rejects a missing or malformed selection with `400`, then validates the Bearer token against that selected tenant's Ordering API:

```text
GET {apiBase}/{apiVersion}/{language}/{serverResolvedProject}/users/me?params=id,level,enabled
Authorization: Bearer <token>
```

The result must be a successful JSON response with `error: false`, a nonempty user `id`, integer `level`, and boolean `enabled`. Only enabled levels `0` (Administrator) and `2` (Business Owner) proceed. API `401` maps to `401`; other API failures, timeouts, malformed or incomplete responses map to `503`; disabled or other levels map to `403`. An anonymous request receives `401` before any tenant or identity lookup. No JWT decoding or browser-supplied role is trusted. A project selection never bypasses the API identity check.

Custom domains cannot set `X-Ordering-Project`. When `USE_PROJECT_DOMAIN` is enabled, the Worker resolves their request host through the Ordering API `/current` endpoint with a 16 KiB streaming byte limit; it cancels the body as soon as the limit is exceeded and does not rely on `Content-Length`. It fails closed if resolution fails. Auth and catalogue lookup then use that same server-resolved project. This keeps custom-domain sessions isolated from the base project. Existing SEO/page fallback behavior remains unchanged.

### `GET /api/source-catalog`

Success body is exactly `{ "schemaVersion": 1, "products": [...] }`. Each product is whitelisted to the shared contract fields only:

```json
{
  "id": "website-marketplace",
  "name": "Website Marketplace",
  "descriptionByLocale": { "en": "...", "es": "..." },
  "version": "vYYYY.MM.DD.HHmmss",
  "publishedAt": "ISO-8601 instant",
  "timezone": "UTC-06:00",
  "sourceSha": "full commit SHA",
  "submodules": [{ "path": "...", "sha": "full commit SHA" }],
  "license": { "id": "...", "text": "..." },
  "instructionsByLocale": { "en": "Markdown string", "es": "Markdown string" },
  "artifact": {
    "filename": "website-marketplace-vYYYY.MM.DD.HHmmss.zip",
    "sizeBytes": 123,
    "sha256": "64 lowercase hex characters"
  }
}
```

No R2 key, origin URL, signed URL, extra producer fields, or environment values are returned. In particular, `instructionsByLocale` values are Markdown strings as in the common schema; producer-only structured step objects must be rendered into Markdown by the artifact producer before publication.

### `GET /api/source-downloads/{id}/{version}`

The Worker revalidates the session and role, reads the catalogue, resolves the published artifact by exact id/version, checks its size and SHA-256, then streams the private R2 body. Success is `application/zip`, `Content-Disposition: attachment`, `Content-Length`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`. No permanent public R2 URL is issued.

The Dashboard client should fetch the endpoint with the current Bearer token, keep the response as a `Blob`, verify its byte length against `artifact.sizeBytes` and `crypto.subtle.digest('SHA-256', bytes)` against `artifact.sha256`, and only then initiate the browser save. It must revoke any temporary object URL, avoid logging the authorization header or artifact URL, and render `401`, `403`, `404`, and `503` distinctly.

Both endpoints return errors in `{ "error": { "code": "...", "message": "..." } }` using statuses `400`, `401`, `403`, `404`, and `503`. Missing bucket/catalogue, malformed catalogue, missing object named by the catalogue, size mismatch, absent native checksum, or checksum mismatch return `503` so infrastructure/data failure cannot look like a valid empty catalogue. An unpublished product/version returns `404`.

## R2 binding and private key mapping

The Worker reads through the `SOURCE_DOWNLOADS` R2 binding. Binding name and private object keys stay server-side. The storage key mapping is:

```text
Catalogue: source-distributions/catalog.json
ZIP:       source-distributions/{id}/{version}/{id}-{version}.zip
```

For the initial product, the archive key is `source-distributions/website-marketplace/{version}/website-marketplace-{version}.zip`. It follows the separate producer contract and is intentionally omitted from the catalogue API. The uploader must write the R2-native SHA-256 checksum and the `sha256` custom metadata equal to `artifact.sha256`; the Worker requires the native checksum and rejects disagreement. R2 streams directly to the response; archive bytes are not buffered in Worker memory.

Configure your own bucket as the `SOURCE_DOWNLOADS` R2 binding in each Worker environment that serves these endpoints. Keep R2 public access disabled and do not serve the catalogue or ZIPs as SPA assets. The application configuration does not supply this optional binding. Without a compatible binding and valid catalogue, authenticated requests fail closed with `503`.

## Local Vite producer fixture

The Vite middleware uses the same auth, validation, and response code as the Worker, but its storage adapter only reads a directory named by `SOURCE_DOWNLOADS_FIXTURE_DIR`; it has no Cloudflare credentials and never uses public SPA assets as a fallback. The configured fixture root must be outside Vite's root, public directory, output directory, workspace root, and every configured `server.fs.allow` root. Vite's `configResolved` hook canonicalizes those roots and the fixture root with `realpath`; a configured path that overlaps a served root or resolves there through a symlink aborts server startup before middleware is installed. Each fixture file is canonicalized again before access; a symlink that escapes its fixture root fails closed with `503 unsafe_fixture_config`. The fixture directory must contain the real ZIP and matching catalogue produced by the artifact producer:

```text
$SOURCE_DOWNLOADS_FIXTURE_DIR/catalog.json
$SOURCE_DOWNLOADS_FIXTURE_DIR/website-marketplace/{version}/website-marketplace-{version}.zip
```

The local adapter calculates SHA-256 from the fixture file on each read, then streams the file to the response. It does not synthesize a catalogue, package, version, or production identity. If `SOURCE_DOWNLOADS_FIXTURE_DIR` is unset, the endpoint returns `503`; if a configured directory is missing or unsafe, Vite startup aborts. Never relax `server.fs.allow` to include the fixture directory.

Start Vite with `pnpm dev`. Optional process-local settings are `SOURCE_DOWNLOADS_FIXTURE_DIR`, `SOURCE_DOWNLOADS_API_URL`, `SOURCE_DOWNLOADS_API_VERSION`, `SOURCE_DOWNLOADS_API_LANGUAGE`, and `SOURCE_DOWNLOADS_PROJECT`. The server uses these values and `src/config.json`; none are read from request parameters. The browser still has to send its current session as the Bearer header.


## Tests

`worker/sourceDownloads.test.js` covers levels 0/2 and denied roles, missing/invalid sessions, disabled/incomplete identities, tenant-to-API selection, bounded `/current` streams with absent/lying Content-Length, catalogue whitelisting/corruption, missing bucket/object, version misses, stream headers, byte/size/checksum mismatch, Vite-served-root and symlink containment, and the file-backed local fixture adapter. Its Node-only integration case starts an isolated Vite middleware server, verifies an anonymous `/@fs/` request returns `403` without fixture bytes, and verifies Vite startup aborts for a fixture symlink into an allowed root. Tests use temporary directories and a random loopback port; they do not contact the live API or Cloudflare.
