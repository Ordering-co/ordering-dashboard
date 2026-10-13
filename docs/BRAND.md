# Ordering.co brand in the dashboard

The dashboard consumes the released Ordering.co brand system (https://brand.ordering.co) through a small adapter. First surface: the sign-in flow (login, forgot password, reset password).

## What is pinned

`brand/ordering-brand.lock.json` pins the release, the canonical tokens file and the Inter font by sha256.

| File | Role |
|------|------|
| `brand/ordering.tokens.json` | Vendored copy of the canonical DTCG tokens (verified) |
| `src/assets/fonts/ordering/InterVariable.woff2` | Self-hosted Inter, `'Ordering Inter Local'` (verified) |
| `src/@/components-dashboard/src/ui/src/styles/OrderingBrand/tokens.generated.js` | Allowlisted `--od-*` variables for light and dark. Generated, do not edit |
| `src/@/components-dashboard/src/ui/src/styles/OrderingBrand/index.js` | styled-components adapter: `orderingBrandScope`, `OrderingBrandFonts`, `orderingFocusRing` |

## Commands

```bash
pnpm brand:check       # offline: vendored files match the lock, generated module is current (also a Vitest test)
pnpm brand:freshness   # remote: the published release still matches the lock
pnpm brand:sync        # remote: download, verify against the lock, regenerate
pnpm brand:sync --accept   # take a new release; review the diff before committing
```

To use another token, add its path to `ALLOWLIST` in `scripts/brand-tokens.mjs` and run `pnpm brand:sync`.

## How to use it

Scope the variables on the surface container and read them with `var(--od-*)`:

```js
import { orderingBrandScope, orderingFocusRing } from '../../../styles/OrderingBrand'

const Shell = styled.div`
  ${orderingBrandScope}
  background: var(--od-bg);
  color: var(--od-text);
  font-family: var(--od-font-sans);
`
```

Light mode is the default; dark follows `prefers-color-scheme`. Icons are Lucide (inlined in `Login/AuthLayout/icons.js`).

## Boundary

Mia navigation buttons use the governed `ordering-button` registry wrapper on Base UI,
with prefixed Tailwind utilities and the existing semantic Ordering.co token adapter.
`brand/ordering-ui.lock.json` pins the vendored registry JSON by checksum; `pnpm ui:check`
verifies provenance and generated JSX parity, and `pnpm ui:sync` regenerates it offline.
The adapter only removes TypeScript annotations, rewrites the utility import and prefixes
classes. It does not fork the button's states or appearance. Tailwind Preflight is not
imported, and utility scanning is restricted to these buttons and their consumer, so the
existing Bootstrap and styled-components surfaces are not reset or implicitly migrated.

The consumer explicitly sets `focus-visible:outline-solid` alongside the token-colored
2px outline and 2px offset; width/color alone inherit the registry's `outline-none` style.

The rest of the dashboard remains a legacy boundary:

The brand contract asks new React web UI to use shadcn/ui on Base UI with Tailwind. This dashboard is a legacy styled-components + Bootstrap 4 app, so it consumes the same tokens through this adapter instead. Moving to shadcn/Tailwind is a separate migration; until then, do not hard-code brand values, add a second token source or copy the generated file.

Project branding still wins where the project set it: `dashboard_logo` and `dashboard_login_background` replace the Ordering.co lockup and the brand panel.

## Feature styling

Quick Offers lives inside `src/@/components-dashboard`, reuses the tenant theme and shared components, and uses compact product proportions as fallbacks. Keep its styles scoped to the feature.

The first-store flow follows the active dashboard theme, logo, font and shared Button/Input primitives. It reuses `InputPhoneNumber`, the `BusinessAdd`/`BusinessDetails` address components (`GoogleAutocompleteInput` and `GoogleMapsMap`), and the Schedule editor. Address-only mode and managed native widget lifecycle are opt-in; existing callers keep their layout and behavior. Inline menu drafts remain local until publication, and the API-backed menu editor remains available after setup.
