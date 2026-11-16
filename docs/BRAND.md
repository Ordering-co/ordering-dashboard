# Ordering.co brand in the dashboard

The dashboard consumes the released Ordering.co brand system (https://brand.ordering.co) through the product tokens and adapters described below.

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

Use semantic tokens so the same component supports both color modes and project branding. Icons use Lucide; follow the treatment of the surrounding surface.

## Product UI boundary

Use the governed wrappers in `Shared/Product` where they fit. Keep network calls,
authorization and domain state in the feature that owns them; pass data and
callbacks to the wrapper. Use a direct component import for a heavy optional
surface when loading it through the barrel would make other routes heavier.

Two Tailwind pipelines coexist. The registry button adapter uses the existing
Tailwind 4 integration; the Product utilities use scoped Tailwind 3 with
`od-` classes and no Preflight. Do not add a global reset or broaden scanning
into Bootstrap and styled-components surfaces. Preserve the existing browser
targets when changing either pipeline.

`brand/ordering-ui.lock.json` pins the vendored button registry JSON.
`pnpm ui:check` verifies the adapter and `pnpm ui:sync` regenerates it.
`pnpm brand:check` also validates the vendored release and generated Product
outputs under `src/brand/`. Keep the [upstream notice](third-party/shadcn-ui/upstream/LICENSE.md)
and [provenance](third-party/shadcn-ui/provenance.json) with the adapted primitives.

Preserve a visible focus indicator, keyboard operation and accessible labels.
Project overrides such as `dashboard_logo` and `dashboard_login_background`
remain effective. Avoid using a tenant action color for neutral surfaces or
status meanings; use the semantic roles for those.

## Feature styling

Quick Offers lives inside `src/@/components-dashboard`, reuses the tenant theme and shared components, and uses compact product proportions as fallbacks. Keep its styles scoped to the feature.

The first-store flow follows the active dashboard theme, logo, font and shared Button/Input primitives. It reuses `InputPhoneNumber`, the `BusinessAdd`/`BusinessDetails` address components (`GoogleAutocompleteInput` and `GoogleMapsMap`), and the Schedule editor. Address-only mode and managed native widget lifecycle are opt-in; existing callers keep their layout and behavior. Inline menu drafts remain local until publication, and the API-backed menu editor remains available after setup.
