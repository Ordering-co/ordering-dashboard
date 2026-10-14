# Public Dashboard onboarding verification

Date: 2026-10-14. Scope: public documentation, helper v1, local configuration, and tenant isolation in development. The existing hosted resolver is preserved. This evidence does not establish customer permissions, authenticated administration, real-data correctness, or a deployment.

## Implemented

- README with one short initial prompt and three personal steps; setup and runbook cover diagnostics, first edit, tenant changes, updates, and restore/disconnect.
- Manifest for `src/config.json`: required `project` and existing `configurations.subdomain`. The helper validates public `/current`, preserves other fields, and writes atomically with an ignored private backup.
- Development tenant pin from a real source-config slug. Global sessions, the host, injected runtime, or another project's query cannot replace it. Production and the template preserve the existing resolver.
- Plugins and Delivery wrappers take `projectCode` from the active API tenant, preserving another tenant's global selection.
- WebStrategy identity and caches scoped by API/version/tenant, with shared language preference. Driver caches and checkout customer identity follow the same separation. Local logout preserves another tenant's global identity and caches.
- The pinned local login shows the selected project in place of instructions to enter a hidden project field. Hosted login behavior stays unchanged; it reuses the existing `PROJECT` translation key.

## Automated evidence

| Check | Result | Scope |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0 | Node 24.21.0 / pnpm 9.15.0; unchanged lockfile. Optional native `gl` warning did not prevent installation or build. |
| `node --test scripts/onboarding/core.test.mjs scripts/onboarding/product.test.mjs` | 26/26 | Isolated fixtures: public validation without Authorization, errors without writes, field preservation, confirmed changes, private permissions, safe paths, exact restore, real Dashboard manifest, and empty placeholder. |
| Latest focused login/tenant regression | 113/113 in 14 files | Includes rendered local-project label, hidden project selector, unchanged hosted instructions, brand/submit checks, runtime isolation, and wrapper tenant regressions. |
| Focused boot/config/autologin/storage/session regression | 102/102 | Local config priority, original resolver, foreign-tenant query rejection, API/tenant namespaces, matching session check, and logout preserving global caches. |
| Plugins/Delivery wrapper regression | 2/2 | API tenant A with global project B: both controllers receive A without modifying B. |
| Full suite `vitest --coverage --run --pool=forks --maxWorkers=2` | 338 files / 2357 tests, exit 0 | Covers isolation and logout. The two new wrapper cases ran separately after this suite started. The local-login label change is verified separately below. |
| `coverage-summary.js --no-run --strict` | 92.88% average, exit 0 | Statements 96.28%; branches 87.11%; functions 91.88%; lines 96.28%. Source-defined gate: 70%. |
| `pnpm lint:check` | Exit 0 | Rechecked after the local-login label change. |
| `pnpm build` | Exit 0 | Rechecked after the local-login label change; 22.65 s. Bundle-size warning; no publication. |
| `node i18n/check-generated.cjs` | Exit 0 | Generation matched real source files, without catalog changes. |
| `node i18n/verify.cjs` | Exit 0 | Code completeness: 4516 keys, 392 preserved orphans. The generator reported 176 empty slots in the wider catalog; no live sync or locale filling was performed. |
| Existing prepared helper `detect` | Connected | MCP handshake and whoami read; allowlisted output without user details or keys. No new connection or login was created. |

The full suite and later focused regressions are listed separately. The earlier focused run after filename normalization passed 104 tests in 11 files. The final local-login label run passed 113 tests in 14 files, followed by successful lint, build, and generated-catalog checks. The short README and English documentation changes do not alter runtime behavior.

## Browser evidence and limits

The coordinated browser check below verified HTTP, login loading, and a visible local heading edit through HMR. Authenticated administration and a real cross-tenant sign-in remain unmeasured. Screenshots document the first presentation edit, which was restored byte-for-byte. The selected-project label is a later local UI adjustment, covered by its rendered-UI regression.

## Preservation

`pnpm-lock.yaml` is unchanged. `src/config.json` was temporarily configured with a selected project for coordinated QA. The main session owns restoring and verifying its public template before publication. Do not commit the temporary selection. `.ordering-setup/`, dependencies, dist, and coverage are ignored. Helper backups contain previous configuration and are not attached. No routes or Settings editor were added; only Plugins' tenant selection was corrected. Backend endpoints, project data, and the Open Source Code downloads screen were not changed.

## Coordinated browser check — 2026-10-14

The private HTTP preview returned 200. Public configure/doctor confirmed the existing MCP-selected project `orderingv1`; the browser loaded its login route with no JavaScript errors. A temporary local presentation edit changed the visible h1 to `My first Dashboard edit`; the browser updated through Vite HMR without a manual reload. The original source was restored byte-for-byte. Screenshots: [before](onboarding-evidence/dashboard-before.png), [after](onboarding-evidence/dashboard-after.png). Authenticated administration and data reads in the app are not measured by this login-screen check; no MCP credential was copied to the app.

## Final common helper contract

The final SDK-compatible numeric franchise contract is shared without adding franchise fields to Dashboard. Node 24 ran 30 common tests and 2 Dashboard manifest tests successfully (32 total). The shipped `src/config.json` was restored exactly before commit; local QA configuration remains recoverable through ignored backups.
