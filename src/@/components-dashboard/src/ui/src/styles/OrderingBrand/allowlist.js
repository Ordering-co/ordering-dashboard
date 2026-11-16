/**
 * Names of the `--od-*` variables the dashboard scopes on a surface. The
 * values are not here: they come from the single token module
 * `src/brand/ordering.tokens.generated.js`. Anything else stays out until a
 * surface needs it; `pnpm brand:check` verifies this list against the
 * canonical tokens. Keep this file free of imports (the check reads it standalone).
 */
export const ORDERING_BRAND_ALLOWLIST = {
  root: [
    '--od-font-sans',
    '--od-font-weight-regular',
    '--od-font-weight-medium',
    '--od-font-weight-semibold',
    '--od-font-size-1',
    '--od-font-size-2',
    '--od-font-size-3',
    '--od-font-size-6',
    '--od-line-heading',
    '--od-line-body',
    '--od-tracking-heading',
    '--od-radius-control',
    '--od-radius-component',
    '--od-radius-panel',
    '--od-stroke',
    '--od-shadow-1',
    '--od-shadow-2',
    '--od-duration-fast',
    '--od-duration-base',
    '--od-space-2',
    '--od-space-3',
    '--od-space-4',
    '--od-space-5',
    '--od-space-6',
    '--od-space-7'
  ],
  mode: [
    '--od-bg',
    '--od-surface',
    '--od-surface-subtle',
    '--od-surface-strong',
    '--od-text',
    '--od-text-muted',
    '--od-text-inverse',
    '--od-border',
    '--od-border-strong',
    '--od-action',
    '--od-action-foreground',
    '--od-action-content',
    '--od-action-hover',
    '--od-action-soft',
    '--od-focus',
    '--od-danger-functional',
    '--od-danger-soft'
  ]
}
