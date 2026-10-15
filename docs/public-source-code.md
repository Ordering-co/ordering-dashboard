# Open Source Code — public GitHub distribution

Open Source Code (`/open-source-code`) helps administrators connect a coding agent and open an Ordering product locally. Dev Quick Start is the first action block, followed by seven product entries and the optional MCP plugin. Public source availability does not establish production deployment, compatibility, or permission to use Ordering APIs and data.

## Page flow

Dev Quick Start displays its connection prompt immediately, with copy, README, and setup links. After verifying the connection, its setup instructions offer to download all seven products. Accepting the download configures all seven by default for the confirmed project; franchise products require an explicitly selected franchise. The agent then asks which products to start locally, recommending Website Marketplace and Dashboard together. Dependencies and startup apply only to the selected products. Connection, download, configuration, and startup are separate results.

The canonical connection prompt is:

```text
Connect me to Ordering.co: get or safely update https://github.com/Ordering-co/ordering-dev-quickstart in ~/ordering-dev-quickstart, preserving my existing changes. Read SETUP.md and follow it step by step.
```

An existing connection can continue directly to a product. A connection is optional for manual setup with a confirmed project slug; it does not replace the normal login inside an app.

Each product offers **Copy setup prompt** as its primary action and README as a secondary link. **View setup prompt** exposes selectable text without showing seven long prompts on initial load. Each prompt matches the corresponding public README, uses its public repository URL, and points to the actual runbook below. Update the catalog and its contract tests when a published README prompt changes; the browser never retrieves README contents at runtime.

**Developer options** keeps repository, fork, runbook, and clone actions available as secondary choices. Public repositories can be cloned without GitHub organization membership. Fork creation requires the customer's own GitHub account; a fork is optional. The MCP plugin adds platform knowledge to an existing connection and does not configure products or replace login.

## Public repositories and runbooks

| Product | Public repository | Runbook |
| --- | --- | --- |
| Dashboard | [ordering-dashboard](https://github.com/Ordering-co/ordering-dashboard) | [setup.md](https://github.com/Ordering-co/ordering-dashboard/blob/main/setup.md) |
| Website Marketplace | [website-marketplace](https://github.com/Ordering-co/website-marketplace) | [setup.md](https://github.com/Ordering-co/website-marketplace/blob/main/setup.md) |
| Customer App Marketplace | [ordering-app-marketplace](https://github.com/Ordering-co/ordering-app-marketplace) | [setup.md](https://github.com/Ordering-co/ordering-app-marketplace/blob/main/setup.md) |
| Business App | [ordering-app-business](https://github.com/Ordering-co/ordering-app-business) | [docs/onboarding.md](https://github.com/Ordering-co/ordering-app-business/blob/main/docs/onboarding.md) |
| Driver App | [ordering-app-driver](https://github.com/Ordering-co/ordering-app-driver) | [docs/onboarding.md](https://github.com/Ordering-co/ordering-app-driver/blob/main/docs/onboarding.md) |
| Franchise Website | [ordering-website-franchises](https://github.com/Ordering-co/ordering-website-franchises) | [setup.md](https://github.com/Ordering-co/ordering-website-franchises/blob/main/setup.md) |
| Franchise App | [ordering-app-franchises](https://github.com/Ordering-co/ordering-app-franchises) | [setup.md](https://github.com/Ordering-co/ordering-app-franchises/blob/main/setup.md) |

Dev Quick Start uses [SETUP.md](https://github.com/Ordering-co/ordering-dev-quickstart/blob/main/SETUP.md). The optional [MCP plugin and skill](https://github.com/Ordering-co/ordering-mcp-plugin) uses its README. Filename case is significant. Read each repository's requirements, license, and third-party notices; visibility or another product's license does not establish applicable terms. Mobile products also require their own provider configuration, signing and build tools. Downloading source does not provision an Ordering backend.

The six products with `src/@/components` use `--recurse-submodules` in clone commands, preserving the recorded gitlink rather than updating to the latest SDK revision. Dashboard and the two developer tools have no submodules.

## Runtime, access, and interaction

The page uses the local `public-source-repositories.js` catalog. It does not call `/api/source-catalog`, `/api/source-downloads/*`, or the GitHub API, and needs no GitHub token or tenant metadata. It remains available when ZIP/R2 services are absent. Links open in a separate tab with `noopener noreferrer`.

The existing `ProtectedRoute`, sidebar, and command palette allow administrators (level 0) only. The controller preserves session loading, signed-out, disabled-user, and forbidden-role behavior, including role changes during a session. No new connection, authentication, or API flow is implemented by the page.

Copy buttons announce success through a live status message. If clipboard access is missing or denied, product prompt text opens automatically for manual selection; the button keeps keyboard focus and can retry. The Quick Start prompt is always visible. Pending copy buttons are disabled to prevent duplicate operations. Text remains left-to-right inside the translated interface, including RTL layouts.

Feature labels use the canonical i18n catalog and its generated source-code subset. Existing nonempty API labels retain priority; bundled labels supply the selected locale when the API has no feature labels. New copy uses distinct keys to avoid retaining obsolete ZIP or setup instructions through an older API translation.

## Legacy ZIP boundary

GitHub links replace ZIP/R2 distribution in this page. The legacy Worker endpoints (`worker/sourceDownloads.js`, `worker/index.js`), local Vite adapter (`scripts/source-downloads-fixture-adapter.js`), binding in `wrangler.toml`, schema, and backend tests remain outside this page's runtime. [The old backend contract](SOURCE_CODE_DOWNLOADS.md) is historical.

Removing a former page consumer does not prove that no external clients or deployed dependencies remain. Retiring legacy endpoints, bindings, producer workflows, buckets, objects, releases, or credentials requires a separate consumer audit and authorization. This page does not dispatch or alter a source-distribution workflow, change publication gates, or perform external cleanup.

## Verification procedure

Use Node 24 and pnpm 9.15.0 with the frozen lockfile. Verify the catalog's exact public prompts and runbook paths, Quick Start ordering, eight prompt-copy actions, all nine clone actions, clipboard denial and retry, translation parity, and session/role regression cases. Run the required Quality Gate, build, lint, i18n verification/generated checks, and command palette coverage.

Review desktop, narrow mobile, keyboard focus, and RTL with the actual controller/UI and theme. A synthetic session fixture must be identified as such and kept outside the product tree; it does not verify live login, a customer tenant, product startup, fork creation, or production deployment. Store captures, logs, and run results in the private task evidence location rather than this document.
