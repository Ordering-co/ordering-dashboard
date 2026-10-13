# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`src/@/components-dashboard` — the **admin dashboard component library** living in-tree inside `ordering-dashboard`. It provides:

- **Controllers** — stateless-ish functional components with hooks that talk to the Ordering API
- **UI components** — styled-components presentation for every admin screen
- **Contexts & hooks** — session, config, language, orders, websockets, toasts, etc.
- **SDK** — typed API client (`src/sdk/`)

The dashboard shell imports via path aliases `~components` (this folder's `src/`) and `~ui` (this folder's `src/ui/`). Edit and commit here directly in `ordering-dashboard` — there is no separate submodule pointer.

Package manager is the parent repo's **pnpm**. Lint/build from the dashboard root.

## Commands

```bash
# from ordering-dashboard root
pnpm install
pnpm lint               # eslint . --fix (covers this tree)
pnpm run dev            # http://localhost:3001
pnpm run build          # full production bundle (8GB heap)
```

There is no separate build step for this folder — Vite bundles it as source with the parent app.

## Architecture: Controller + UIComponent

This is the **single most important pattern**. Every feature is split into two layers:

### 1. Controllers (`src/components/<Name>/index.js`)

- Import hooks from `src/contexts/` (`useApi`, `useSession`, `useLanguage`, `useToast`, …).
- Fetch/mutate data, hold `useState`/`useEffect` logic.
- **Render no UI markup** — return `<UIComponent {...computedProps} />` (or use `BaseComponent`).
- Exported from `src/index.js` (barrel) and re-exported through `~components` in the parent.

```js
// src/components/AdBannersList/index.js  (simplified)
export const AdBannersList = (props) => {
  const { UIComponent, defaultPosition } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [bannersListState, setBannersListState] = useState({ loading: true, banners: [] })

  const getAdBanners = async () => { /* fetch ${ordering.root}/banners */ }
  const handleUpdateBanner = async (payload, bannerId) => { /* PUT */ }

  useEffect(() => { getAdBanners() }, [])

  return (
    <UIComponent
      {...props}
      bannersListState={bannersListState}
      handleUpdateBanner={handleUpdateBanner}
      handleSuccessUpdate={getAdBanners}
    />
  )
}
```

~290 controllers live under `src/components/`. Naming: controller file exports `AdBannersList`, `OrdersManage`, `BusinessList`, etc.

### 2. UI layer (`src/ui/src/components/<Domain>/<Name>/`)

- Contains the actual JSX and `styles.js` (styled-components).
- Defines a local `XUI` function component that receives props from the controller.
- Exports a **wired** component that injects `UIComponent`:

```js
// src/ui/src/components/Marketing/PageBanner/index.js  (simplified)
import { AdBannersList as AdBannersListController } from '../../../../../index'

const PageBannersUI = (props) => {
  const { bannersListState, handleUpdateBanner, title } = props
  return (/* JSX using bannersListState, SideBar, BannerDetails, … */)
}

export const PageBanners = (props) => {
  const bannersProps = { ...props, UIComponent: PageBannersUI }
  return <AdBannersListController {...bannersProps} />
}
```

Another canonical example — `OrdersManager`:

```js
// src/ui/src/components/Orders/OrdersManager/index.js
export const OrdersManager = (props) => {
  const ordersListControlProps = {
    ...props,
    UIComponent: OrdersManagerUI,
    driversPropsToFetch: ['id', 'name', 'lastname', /* … */]
  }
  return <OrdersManageController {...ordersListControlProps} />
}
```

### 3. Presentation-only components

Not every `~ui` export has a matching `src/components/` controller. Some screens are UI-only (layout, static config, composition of other wired components). Example: `AdBannersListing` renders position cards and opens `PageBanners` (which *does* use the `AdBannersList` controller).

**Before changing a feature, trace the import chain** from the parent page → `~ui` export → controller (if any) → API endpoints.

## Directory map

```
src/
├── components/          # ~290 controllers (API + state) — NO JSX styling
├── contexts/            # Shared React contexts (18 providers)
│   ├── ApiContext        # Ordering SDK instance
│   ├── SessionContext    # auth token, user
│   ├── LanguageContext   # i18n / translations
│   ├── OrderContext      # cart/order state
│   ├── ConfigContext     # project configs from API
│   ├── WebsocketContext  # socket.io real-time
│   └── …
├── sdk/                 # API client (lib/, lib-esm/, models)
├── webStrategy.js       # platform-specific behavior hooks for contexts
├── index.js             # barrel: exports all controllers + contexts + hooks
└── ui/
    ├── index.js         # barrel: exports all wired UI components + UI-only contexts/hooks
    └── src/
        ├── components/  # ~1400 files, grouped by domain:
        │   ├── Orders/           # orders manager, details, logistics, custom orders
        │   ├── Stores/           # businesses, products, menus, zones, payments
        │   ├── Delivery/         # drivers, groups, companies, schedules
        │   ├── Users/            # customers, managers, professionals
        │   ├── Marketing/        # campaigns, banners, promotions
        │   ├── BusinessIntelligence/  # analytics, reports, invoices
        │   ├── Settings/         # Settings hub (`/settings`). See docs/SETTINGS.md
        │   ├── Connect/          # POS, delivery services, sales channels
        │   ├── CartRecovery/     # open carts, recovery actions
        │   ├── Loyalty/          # gift cards, rewards
        │   ├── Billing/          # subscription payment UI
        │   ├── MyProducts/       # marketplace app builder
        │   ├── Shared/           # Modal, SideBar, Alert, SearchBar, inputs, …
        │   ├── Layout/           # shell layout, sidebar
        │   └── …
        ├── contexts/    # UI-scoped contexts (Theme, InfoShare, FilterValues, Project, ConfigFile)
        ├── hooks/       # UI hooks (useWindowSize, useOnlineStatus, useProjectState, …)
        ├── styles/      # shared styled primitives (Button, Input, Select, Tabs, …)
        ├── utils/       # URL query helpers, formatting, feature-flag helpers
        ├── config/      # currency, constants
        └── themes/origin/   # legacy/alternate theme fragments — prefer `src/components/` for dashboard work
```

### Typical component folder layout

```
src/ui/src/components/Stores/BusinessDetails/
├── index.js      # BusinessDetailsUI + wired export → BusinessDetailsController
└── styles.js     # styled-components
```

## Contexts & data access

Boot sequence (initiated by parent `src/index.js`):

1. Parent passes `settings` (from `config.json` + `window.__CONFIG__`) into `<OrderingProvider settings={settings}>`.
2. `OrderingProvider` (`src/contexts/OrderingContext`) nests all core providers: Api → Language → Session → Config → Websocket → Order → Business → …
3. UI-specific providers (`ThemeProvider`, `ProjectProvider`, `InfoShareProvider`, `FilterValuesProvider`) wrap inside the parent around `OrderingProvider`.

**In controllers**, use:

- `useApi()` → `[ordering]` SDK with `ordering.root`, `.get()`, etc.
- `useSession()` → `[{ token, user, auth }]`
- `useLanguage()` → `[, t]` translation function
- `useToast()` → `[, { showToast }]`
- `useConfig()` → `[{ configs }]`
- `useEvent()` → pub/sub between components

**In UI components**, prefer the same hooks when needed for display-only concerns; receive data/handlers via props from the controller when the controller already owns that state.

## API & SDK

- HTTP calls typically use `fetch` with `Authorization: Bearer ${token}` against `${ordering.root}/<endpoint>`.
- Complex domains use SDK classes under `src/sdk/lib/` / `src/sdk/lib-esm/`.
- List endpoints often accept `where` JSON query params built from filter conditions.

## Styling conventions

- styled-components v5 in co-located `styles.js` files.
- Read theme tokens via `useTheme()` from `src/ui/src/contexts/ThemeContext` (populated by parent `theme.json`).
- Bootstrap 4 grid/classes (`row`, `col-md-*`) mixed with styled-components wrappers.
- Shared UI primitives: import from `../../../styles` or `../../Shared` relative to the component.
- Icons: `react-bootstrap-icons`, `@meronex/icons`.

## How the dashboard shell consumes this folder

Parent `src/pages/<Screen>/index.js` imports the wired export from `~ui`:

```js
import { AdBannersListing as AdBannersListController } from '~ui'
// renders <AdBannersListController /> with optional page-level props
```

Parent `src/App.js` imports layout, auth, and shell components from `~ui` (`SidebarMenu`, `Layout`, `ProtectedRoute`, `SpinnerLoader`, …).

**Changes here are committed in `ordering-dashboard`** — no separate repo or submodule SHA bump.

## EDIT BOUNDARY — where to make changes

| Task | Location |
|------|----------|
| New API integration, state, validation | `src/components/<Feature>/` controller |
| JSX, layout, styled-components | `src/ui/src/components/<Domain>/<Feature>/` |
| New shared hook for API/session | `src/contexts/` |
| New shared UI hook | `src/ui/src/hooks/` |
| Reusable button/input/modal | `src/ui/src/styles/` or `src/ui/src/components/Shared/` |
| New export for parent pages | Add to `src/ui/index.js` barrel |
| SDK model / API class | `src/sdk/` |
| Settings hub IA, unlock, redirects, copy | `src/utils/settingsIa.js`, `settingsAccess.js`, `settingsRedirects.js`, `settingsCategoryTree.js`, `settingsI18nSeed.js` + `src/ui/src/components/Settings/`. Read repo `docs/SETTINGS.md` first |

**Do not** add dashboard routes here — routing lives in the parent's `src/App.js`. The only Settings page is parent `src/pages/Settings`.

**Do not** edit `src/themes/origin/` for new dashboard features unless explicitly porting legacy theme code.

## Settings hub

Project configs are edited only at `/settings`. Every project sees every parent category. Plan locks are gone. Addon sections are visible for every project. Module and sidebar visibility rules remain separate.

`AllSettings` loads `config_categories` in one request and builds trees in `src/utils/settingsCategoryTree.js`. Do not walk the tree with one request per folder.

Hub UI: `src/ui/src/components/Settings/SettingsHub/`. Fetch wrapper: `AllSettings`. Custom blocks: `SettingsCustomBlocks/`. Loyalty stores: `SettingsLoyaltyStores/`. `FilterSettings` is only for My Products dashboard theme.

Do not recreate Basic / Pro / Plugin / Enterprise pages. Do not add a second config editor on Loyalty, Payments, Maps, SLA, or similar tabs. Link to the hub (`src/utils/settingsExternalEditors.js`).

Full playbook (groups, hidden keys, exceptions, i18n): `docs/SETTINGS.md` at the repo root.

## Adding or modifying a feature — checklist

1. **Find the controller** in `src/components/` (or confirm the screen is UI-only).
2. **Find the UI wrapper** in `src/ui/src/components/<Domain>/`.
3. If adding API behavior: extend the controller props/handlers; pass them through to `UIComponent`.
4. If adding UI: modify `XUI` and `styles.js`; keep API calls in the controller.
5. Export the wired component from the folder's `index.js`; ensure it is re-exported in `src/ui/index.js` if new.
6. Run `pnpm lint:check` from the dashboard root.
7. Test via `pnpm run dev` from the `ordering-dashboard` root.
8. Commit in `ordering-dashboard` (this folder is in-tree source).

## Conventions

- Functional components + hooks only.
- PropTypes still used in many controllers (optional for new code; parent ESLint has `react/prop-types` off).
- ESLint: `standard` + `plugin:react/recommended` + `plugin:cypress/recommended` (Cypress present but not actively CI-gated).
- Translations: always provide a default English string as the second `t()` argument: `t('KEY', 'Human readable default')`.
- URL state: use `addQueryToUrl` / `removeQueryToUrl` from `src/ui/src/utils` for lateral panels and deep links.
- Feature flags: `getFeatureFlags('flagName')` from UI utils — sidebar/module visibility (Connect, billing). **Do not use plan flags to hide Settings.** Settings unlock and IA live in `src/utils/settingsAccess.js` and `src/utils/settingsIa.js`. Full rules: `docs/SETTINGS.md` at the repo root.
- User roles: `getUserType('admin')`, `getUserType('businessOwner')`, etc. Settings routes are admin (`allowedLevels={[0]}`).

## Common mistakes to avoid

1. **Putting `fetch` calls inside UI components** that already have a controller — duplicates logic and breaks testability.
2. **Creating a new controller without a `UIComponent` prop** — breaks the established pattern; use `BaseComponent` if you need a minimal pass-through.
3. **Importing from the `~ui` or `~components` barrels inside this repo** — use relative imports to `src/index.js` or direct paths; barrels are for the parent bundler aliases.
4. **Treating this folder as a separate git submodule** — it is normal source in `ordering-dashboard`.
5. **Mixing marketplace and dashboard components** — this tree is admin-only; customer marketplace UI is outside this admin component tree.
6. **Editing Settings without reading `docs/SETTINGS.md`** — the hub at `/settings` is the only project-config editor. Do not recreate old Settings pages, do not re-add `plan_pro` / `plan_enterprise` gates, and do not put a second config form on another tab.
