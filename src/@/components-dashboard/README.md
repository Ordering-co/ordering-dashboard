# Dashboard components (in-tree)

Controllers, contexts, SDK, and admin UI for `ordering-dashboard`.

This folder is in-tree application source. Controllers and UI share the repository configuration and dependencies.

## Layout

- `src/components/` — controllers (API + state; no styled markup)
- `src/contexts/` — session, config, language, websocket, etc.
- `src/sdk/` — API client
- `src/ui/` — wired UI components + styles (imported via `~ui`)

## Imports (from the dashboard shell)

Path aliases (see repo-root `vite.config.js` / `jsconfig.json`):

- `~components` → `src/@/components-dashboard/src`
- `~ui` → `src/@/components-dashboard/src/ui`

## Develop

From the **ordering-dashboard** repo root (pnpm):

```bash
pnpm install
pnpm run dev      # http://localhost:3001
pnpm lint:check
pnpm run build
```

Do not treat this folder as a separate package or git submodule. Dependencies live in the parent `package.json`.
