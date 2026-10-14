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

The coordinated browser check below verified HTTP, login loading, and a visible local heading edit through Vite automatic refresh. Authenticated administration and a real cross-tenant sign-in remain unmeasured. Screenshots document the first presentation edit, which was restored byte-for-byte. The later clean-clone browser check below confirms the selected-project label in addition to its rendered-UI regression.

## Preservation

`pnpm-lock.yaml` is unchanged. `src/config.json` was temporarily configured with a selected project for coordinated QA. The coordinating session restored the original worktree public template; a subsequent byte comparison confirmed it matches HEAD with both project fields set to the public placeholder. The separate temporary clean clone retains the synthetic preservation settings used for QA; those settings are not publication source. `.ordering-setup/`, dependencies, dist, and coverage are ignored. Helper backups contain previous configuration and are not attached. No routes or Settings editor were added; only Plugins' tenant selection was corrected. Backend endpoints, project data, and the Open Source Code downloads screen were not changed.

## Coordinated browser check — 2026-10-14

The private HTTP preview returned 200. Public configure/doctor confirmed the existing MCP-selected project `orderingv1`; the browser loaded its login route with no JavaScript errors. A temporary local presentation edit changed the visible h1 to `My first Dashboard edit`; the browser updated automatically through Vite without a manual reload. This does not establish state-preserving React Fast Refresh. The original source was restored byte-for-byte. Screenshots: [before](onboarding-evidence/dashboard-before.png), [after](onboarding-evidence/dashboard-after.png). Authenticated administration and data reads in the app are not measured by this login-screen check; no MCP credential was copied to the app.

## Final common helper contract

The final SDK-compatible numeric franchise contract is shared without adding franchise fields to Dashboard. Node 24 ran 30 common tests and 2 Dashboard manifest tests successfully (32 total). The shipped `src/config.json` was restored exactly before commit; local QA configuration remains recoverable through ignored backups.


## Fresh-clone server check — 2026-10-14

A separate temporary clone of commit `7c14b92cf94b56c23d3ea11e68a8fc122c3e9652` was used for the startup check. The coordinating session completed the frozen install and configure/doctor sequence before this check. Independently observed runtime: Node `v24.21.0`, pnpm `9.15.0`, installed dependencies present. The persisted configuration had matching `project` and `configurations.subdomain`; the synthetic `Dashboard preservation check` app name and `customer_custom_setting` field were retained.

The selected private Tailscale interface was online, with one online macOS peer. Port `3015` was checked free before launch. Only this clone's server was started, with `--host` set to the current private IP and `--port 3015 --strictPort`; other servers were not changed. The launcher PID, listener PID, current private URL, working directory, and server log were recorded in temporary session artifacts rather than embedding machine details in this public document.

Observed outputs:

```text
VITE v7.3.6 ready in 532 ms
HTTP 200
Vite HTML shell: True
```

The listener was verified on the selected private IP and port, and the returned login HTML contained the root element and Vite entry module. This check did not modify source files in the clean clone or submit authentication/backend operations. The coordinating session then observed the login heading and selected-project label as documented below. HTTP 200 alone did not establish those visual results. Authenticated operations, console completeness, and access from a separate laptop are not established by this check. The process remains active and requires the server machine and Tailscale connection to remain available.


### Fresh-clone browser and visible edit

The browser showed `Sign in to your dashboard` with `Project: orderingv1` on the clean clone's login screen. [Clean-clone login screenshot](onboarding-evidence/dashboard-clean-clone.png). No authentication form was submitted.

The coordinating session observed `My clean Dashboard edit` after a temporary change to the login h1. [Visible-edit screenshot](onboarding-evidence/dashboard-clean-hmr.png). The server log recorded `(client) page reload` for the LoginForm module: this is an automatic Vite development reload, not evidence of state-preserving React Fast Refresh.

The original LoginForm source was saved outside the clone before the edit and restored byte-for-byte afterward. Its restored SHA-256 matches the original: `034ca6de721562fd5062e4d1b7f7944df096cbb32bd8e212a8b7816387afd100`. A subsequent GET of the restored served module returned HTTP 200, contained the original heading, and no longer contained the temporary heading. The screenshots were copied from the actual browser captures without modification.


## Prepared upstream merge validation — 2026-10-14

The prepared merge tree was validated before the coordinating session created its merge commit. Observed references were session HEAD `2a03e366be469601e399fc0c73d5b85ab1107e43` and incoming merge parent `a44d0e25cdf9943f59a583cafb730306e939b68e`. The index had no unresolved entries. README retained the initial checkout-preserving prompt and license text alongside the incoming Open Source Code section and `docs/public-source-code.md` link. The tenant-aware query-login guard remained present in `src/App.js`.

The incoming lockfile was installed without modification under Node 24.21.0 / pnpm 9.15.0. Its SHA-256 before and after validation was `04ed2fb122c4d8c26124161e447a6e15bd1637de06ac17ffae9867b4fdef3477`. This installation used incoming Vite 7.3.7 and Wrangler 4.149.0; earlier browser evidence above belongs to its explicitly identified pre-merge clone.

| Prepared-tree check | Actual result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0; incoming lockfile preserved. |
| Common helper and Dashboard manifest tests | 32 passed, 0 failed. |
| `pnpm lint:check` | Exit 0. |
| `pnpm build` | Exit 0; Vite 7.3.7, 19.28 s. Bundle-size warning remains; no deployment. |
| `node i18n/check-generated.cjs` | Exit 0; generated catalog matches the combined source. |
| `node i18n/verify.cjs` | Exit 0; 4627 code keys, 442 preserved orphan entries. |
| Full Vitest coverage run | 361 files and 2494 tests passed; 0 failed; exit 0. |
| Strict coverage summary | Exit 0; average 93.05% against the 70% gate. Statements 96.37%, branches 87.29%, functions 92.15%, lines 96.37%. |

No source fixes, staging, commit, merge, or QA configuration changes were made by this validation pass. `src/config.json` retained the public placeholder and the incoming lockfile had no unstaged modification. The full suite produced no failures requiring an upstream-baseline exception. These automated checks verify the prepared source tree; they do not retroactively claim browser coverage, authenticated operations, or deployment of the incoming main changes.
