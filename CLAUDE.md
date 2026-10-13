# Dashboard development

Read AGENTS.md and setup.md. React 18, Vite 7, styled-components; Node 24 / pnpm 9.15.0. Shell/routes live under src; both controllers and UI are in src/@/components-dashboard (not a submodule). Use the existing Controller + UIComponent pattern. Features belong in the controllers/UI, with pages kept thin.

Settings use one editor at /settings; consult docs/SETTINGS.md and docs/SETTINGS_DISTRIBUTION.md. Preserve addon flags, palette coverage, authentication guards and existing business behavior. Public configuration uses your own authorized project; optional telemetry is disabled by default. CI uses hosted read-only runners and never deploys or synchronizes live translations.

Quality commands are listed in setup.md. Keep the license scope and source provenance explicit and preserve all third-party notices. Do not infer access to Ordering.co production from this public source.
