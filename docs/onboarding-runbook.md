# Dashboard onboarding runbook

## Connection and scope

Local configuration is public and editable in `src/config.json`: `project`, `configurations.subdomain`, and `api.url/version/language`. It does not require `.env`, administrative keys, or tokens. The helper preserves existing flags, IDs, billing, socket, and integrations. It does not open a login or register a new MCP or REST connection.

`detect` checks the prepared helper at `~/ordering-dev-quickstart/ordering`, or the known path you supply with `--helper /known/path/ordering`. It requires the executable and `.clients/runtime-ready` marker. If present, it starts that helper's MCP and calls `whoami`, returning only status and project slug. It does not scan global client configuration or print tokens/user data. It cannot discover the agent's native MCP tools: the agent must inspect its current tools and verify the project with an authorized read. Confirm the slug before reusing it. Available tools alone do not prove a connection or access to every project.

Without an existing connection, use the project slug the customer explicitly provides. `configure` and `doctor` perform a public GET to `/{version}/{language}/{project}/current`, without Authorization. They require a valid envelope with no error and an exact matching `result.code`. This verifies public project resolution, not account membership or permission to sign in.

This setup uses an existing agent connection or prepared helper. It does not require a visual Dashboard connection selector or assume one is deployed. If you later want an agent connection and have none, follow the [official Ordering Quickstart](https://github.com/Ordering-co/ordering-dev-quickstart), return to `detect`, and confirm the project. That connection is optional for manual client setup.

## Diagnostics

```sh
node scripts/onboarding/cli.mjs detect
node scripts/onboarding/cli.mjs doctor
```

Prompt:

> Diagnose my local Dashboard. Read setup.md, run detect and doctor, and distinguish runtime requirements, configuration, public /current response, HTTP server, and browser loading. Keep tokens, emails, and full API responses out of the report. Use only a confirmed path for an existing helper. Fix reversible local problems without changing backend data, publishing, or deploying.

If the slug is still `your-project-slug`, configure your project. If `/current` fails, check the slug, URL/version/language, network, and response before saving. A login 401 requires the user's own account and permissions; copying another tenant's session is not a fix. If a port is occupied, identify its owner and choose a free port with `pnpm dev --host 127.0.0.1 --port 3002`.

## First visible edit

On the login screen, make one temporary presentation edit without signing in. Save the exact original source of `src/@/components-dashboard/src/ui/src/components/Login/LoginForm/index.js`, replace only the visible h1 with `<h1>My first Dashboard edit</h1>`, and open `/login`. Verify that the heading updates in the browser through Vite HMR. Restore the original source byte-for-byte when finished. This does not change project data or private configs.

Prompt:

> With my local Dashboard open, temporarily change only the login h1 to “My first Dashboard edit”. Save the exact original source first. Check that the browser shows the new heading and the login remains usable, then restore the source and verify the original heading returns. Keep the change local; do not edit Settings, backend, or project data.

Vite reloads file changes. If the edit does not appear, check the URL, console, and served module before reloading. A passing automated test does not verify a visible edit.

## Change project

```sh
node scripts/onboarding/cli.mjs configure --project another-project --confirm-project-change
node scripts/onboarding/cli.mjs doctor
```

Prompt:

> Switch this local Dashboard to the slug I confirm. Show the old and new projects before configure --confirm-project-change, validate /current, and preserve other fields. Verify project and configurations.subdomain match. Restart or reload and check that the browser uses the new tenant without reusing the previous identity. Preserve global localStorage and other sessions' caches.

During development, a real slug in `src/config.json` pins the tenant. The host and another project's autologin cannot replace it. Provider sessions and caches are separated by API, version, and tenant; language preference is shared. Returning to a tenant can restore its own local session, subject to the normal `/users/me` check. Reload after changing project or API so providers remount; do not assume an earlier tab's identity is valid for the new tenant.

## Update source

Prompt:

> Update my local Dashboard while preserving my changes and src/config.json. Inspect Git status, branch/base, and differences before fetching updates; save a private configuration backup outside Git. Preserve the lockfile, use merge rather than rebase, and do not discard files. Show me conflicting intentions before resolving them. Install with frozen-lockfile, run doctor and setup.md checks, and verify the login and my local edit. Do not publish or deploy.

Integrate updates into your working branch according to the repository rules. Keep Node 24, pinned pnpm, the license, and third-party notices.

## Restore and disconnect

Use the exact name in `configure`'s `backup` field, without a `.ordering-setup/` prefix. Replace `BACKUP_FIELD_NAME.json` below with that name:

```sh
node scripts/onboarding/cli.mjs restore --backup BACKUP_FIELD_NAME.json
node scripts/onboarding/cli.mjs detect
```

Prompt:

> Disconnect this local configuration by restoring the backup I select. Identify the backup and show the project it will restore before restore --backup. Preserve backups, global storage, and shared connections/tokens. Stop only the server you started for this copy and verify the restored file. If I want to sign out, use this Dashboard's logout while preserving other tenants' sessions.

Restore returns the exact saved file; it does not revoke an MCP connection or account. Backups may contain previous settings: `.ordering-setup/` is ignored and private. Do not attach or publish its contents. Local logout removes only the active tenant's identity. Stopping the server or restoring the template does not delete earlier local sessions.
