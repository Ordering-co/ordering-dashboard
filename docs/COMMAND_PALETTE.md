# Command palette (⌘K / Ctrl+K)

Read this before adding a destination, changing a route guard that the palette mirrors, or adding a record search.

## What it does

- ⌘K on macOS, Ctrl+K on Windows and Linux, on every authenticated page. The **Search** button at the top of the sidebar opens the same palette.
- Results are grouped: **Navigation**, **Settings**, **Open** (panels, tabs and modals), **Stores**, **Orders** and **Users** (searched on the API), and **Search in** (hand-offs to the Orders, Users and Settings listings).
- Orders match the order number, the customer's name, last name, email or phone, or the store name. Users match an id, name, last name, email or phone (`+52 55 1234`, `551234`). On projects detected as large, orders match the number only (see Record search › Search modes). A result opens its existing detail panel (`/orders?id=`, `/users/customers?id=`, `/delivery/drivers-list?id=`…).
- Order of groups: a number puts Orders first; a phone or an email puts Users first; other text keeps pages and settings first.
- Empty query: **Recent** (last 5, per project and user) and **Suggestions**.
- Arrows move, Enter opens, Escape closes and gives focus back to where it was. In "choose a store" mode, Escape or Backspace on an empty input goes back.
- Nothing in the palette edits data. It only navigates.

## Architecture

```
App.js
└── CommandPaletteProvider (open state, shortcut, focus return, route remount key)
    ├── CommandPaletteRouteBoundary   wraps <Switch>; remounts the page on same-page opens
    ├── SidebarMenu → CommandPaletteTrigger
    └── CommandPalette (UI: Radix Dialog + cmdk)
        └── CommandPalette controller (~components)
            ├── local providers (pure, ranked on the client)
            │   ├── navigation      utils/commandPaletteCatalog.js  (from utils/dashboardNavigation.js)
            │   ├── settings        utils/commandPaletteCatalog.js  (+ useSettingsCatalog: config_categories once)
            │   ├── open actions    utils/commandPaletteActions.js
            │   └── hand-offs       utils/commandPaletteHandoff.js
            └── remote providers
                ├── businesses      components/CommandPalette/useBusinessSearch.js
                └── records         components/CommandPalette/useRecordSearch.js
```

`DashboardDestinationsProvider` is mounted outside the route boundary and
reuses the same catalog, remote search builders, authorization checks, and
navigation hook for Mia. `useDashboardDestinations()` exposes `search()` and
`open()`; it does not maintain a second destination inventory. New canonical
navigation, Settings, or integration entries are therefore available to both
consumers. Shared remote request builders preserve CommandK's safe/extended
record policies and slow-search marker. Settings and integration catalogs load
lazily for Mia, wait for readiness when searched, and report partial failures
without retrying continuously.

Mia search accepts `query`, `destination_id`, `business_query`, and
`business_id`, with limits of 200, 160, 120, and a positive 32-bit integer.
Responses contain at most 12 items; each title is at most 160 characters and
each subtitle at most 240. They contain canonical IDs and minimal display
metadata, never paths, raw rows, credentials, or project configuration values.
Remote requests time out after 8 seconds while retaining available local
results and marking the response partial. Store selection uses the same
authorized dashboard business listing as CommandK; a named store is applied
to a generic query on its first request, duplicate names remain separate by
business ID, and the cross-product is capped at 12 items. An empty
`business_query` with `destination_id` returns at most eight authorized stores
for an in-chat chooser. Ambiguous store names stay ambiguous, and a page store
ID is used only after a fresh authorized lookup when no store was named.

The Assistant opts into `dashboard_search_version: 1` only when the provider
has registered its callback and api-ai reports support. Callback results are
read-only navigation suggestions, not confirmed actions. `open()` rejects a
foreign scope, re-resolves the destination against current permissions and
catalog state, fetches fresh authorized business/order/user records, and
rebuilds the path in the browser. It ignores paths in callback data. Stale
static results are revalidated; dynamic Settings/integration results refresh
their catalogs on each click and only open if still available. Revisions change with
session, permissions, configuration, language, catalog, or navigation state.
Mia remains open on desktop; the shared navigation hook collapses the mobile
menu and preserves CommandK-only focus and close behavior.

| Role | Path (under `src/@/components-dashboard/src`) |
| --- | --- |
| Sidebar sections, role rules, route guards (shared with the sidebar) | `utils/dashboardNavigation.js` |
| Ranking (accents, aliases, prefixes, one typo) | `utils/commandPaletteSearch.js` |
| Navigation and Settings entries, ES/EN aliases | `utils/commandPaletteCatalog.js` |
| Open actions (panels, tabs, store sections) | `utils/commandPaletteActions.js` |
| Page tabs, views and filters (status, invoices, reviews, gift cards, inactive users, ecommerce reports, translations) | `utils/commandPalettePageActions.js` |
| Create forms (`?add=`, `?template=`, `?setup=`) | `utils/commandPaletteCreateActions.js` + `ui/src/hooks/useOneShotQuery.js` in each page |
| Store detail section and tab rules (shared with BusinessSummary), store targets (`buildPaletteStorePath`) | `utils/businessDetailSections.js` |
| Business search contract | `utils/commandPaletteBusinesses.js` |
| Shared API request and record policy helpers | `components/CommandPalette/dashboardSearchRequests.js` |
| Orders / Users hand-off and `?q=` contract | `utils/commandPaletteHandoff.js` |
| Recents, shortcut, i18n seeds | `utils/commandPaletteRecent.js`, `commandPaletteShortcut.js`, `commandPaletteI18nSeed.js` |
| Controller and hooks | `components/CommandPalette/` |
| UI, trigger, styles | `ui/src/components/CommandPalette/` |
| Provider, route boundary | `ui/src/contexts/CommandPaletteContext/` |
| Shared Mia destination provider and navigation hook | `ui/src/contexts/DashboardDestinationsContext/`, `ui/src/hooks/useDashboardNavigation.js` |
| `?q=` reader for listings | `ui/src/hooks/useListingSearchSeed.js` |

Library: [`cmdk`](https://github.com/pacocoursey/cmdk) for the listbox and keyboard model, `@radix-ui/react-dialog` for the modal (focus trap, Escape, portal). Filtering is ours (`shouldFilter={false}`).

## Rules

1. **One source of permissions.** Navigation comes from `getDashboardNavSections` (the sidebar renders the same data) and every path is checked with `canOpenDashboardRoute`. Unknown routes are denied.
2. **Route guards are mirrored.** `DASHBOARD_ROUTE_LEVELS` copies the `allowedLevels` of each `ProtectedRoute` in `src/App.js`. `dashboardNavigation.test.js` reads App.js and fails on drift. When you add or change a guarded route, update the map in the same change.
3. **Settings has one editor.** Settings results link to `/settings?group=&category=&focus=` (built with `buildSettingsPath`). The palette never renders a config form. Fields come from the same `config_categories` request and `buildSettingsHub`, so hidden keys apply. Addon sections are listed for every project. Settings results are only built for editing admins (level 0, not read-only).
4. **No incomplete forms.** An action that needs a store carries `requires: 'business'`. The palette switches to "choose a store" and only then navigates to `/stores/list?id=&section=`. Create actions open an empty form through `?add=`, `?template=` or `?setup=` with the same permissions as the page button. Data is saved only when the person submits the form.
5. **Same-page opens remount the page.** Most panels read their query (`?id=`, `?section=`, `?position=`) only on mount. When the destination is on the current page, the shared navigation hook bumps the route key so the page mounts again, exactly like a fresh visit. `/settings` follows URL changes and is not remounted (`LIVE_QUERY_PATHS`); `/orders` is remounted because its status tab ignores a repeated same URL.
6. **Business search is administrative and server side.** `GET /business?mode=dashboard` with `params=id,name,slug,enabled,logo,address`, `page_size=8`, `where` = name or slug `ilike`, plus exact `id` for numbers. The API applies project, role and business access (owners only see their stores). Eatstreet admins use `/backoffice/businesses`, like the Stores list. Never use the public `/search` endpoint (filtered by delivery zone, location and schedule).
7. **Stale answers lose.** 220 ms debounce, the request in flight is cancelled on a new query, and a request id guards late answers. Results are cached 60 s per project + user + token; a project or session change drops the cache and the results.
8. **Remote failure is contained.** If the store search fails, the Stores group shows Retry and every local result still works.
9. **Hand-offs to listings.** When users were found, "Search in Users" becomes one entry per user type found ("Search “ana” in Drivers", "… in Admins"), each landing on its own listing with `?q=`. Every users listing (customers, admins, business owners, call center agents, drivers, driver managers, professionals) applies `?q=` once through `useListingSearchSeed`. Without users found, the palette offers "Search “x” in Orders / Users" and navigates to `/orders?q=x` or `/users/customers?q=x`. The listing reads `q` once (`useListingSearchSeed`), removes it from the URL and applies it:
   - Orders: the search box (id, external id, customer, store, driver).
   - Customers: the search box only matches the phone, so `classifyUserSearchQuery` sends phones to the search box, emails to the email filter and other text to the name / last name filters. The filter modal shows the seeded values and Clear resets them.
10. **Copy.** Titles use `t()` with existing keys where they exist. Aliases are search terms in English and Spanish, not UI copy, so they are not translated. Dynamic keys are seeded in `commandPaletteI18nSeed.js`.

## Auto-indexing (keep the palette complete)

Mia can seed this same palette with a catalog destination ID for the store picker,
or with a query for optional exploration. The ID is resolved in the current catalog;
the assistant does not pass a URL, route or executable callback. A clear resolved
destination opens through shared navigation without making the palette a mandatory step.

Most of the catalog builds itself:

- **Settings fields** come from `config_categories` on every open, so new configs are searchable without a change.
- **Integrations and apps** come from the same API lists the pages use: POS and sales-channel integrations (`/third_party_integrations`), delivery services (`/driver_companies`, system) and My products apps (`/builder/apps`). New providers appear on their own.
- **Stores** are searched on the server.

What still needs a decision is new UI. `utils/__tests__/commandPaletteSurfaces.test.js` runs in CI and fails when:

1. a component reads a URL param (`query.get('x')`, `useOpenFromQuery('x')`) that `utils/commandPaletteSurfaces.js` doesn't classify;
2. `src/App.js` has a route that no palette entry opens and `ROUTE_EXCLUSIONS` doesn't explain;
3. an `indexed` surface has no matching palette entry, or the registry lists something that no longer exists.

When it fails, run `pnpm palette:coverage`, then either add the palette entry and mark the surface `indexed` with its `proof`, or mark it `record` / `list` / `excluded` with the reason. A new page, panel, tab or create form can't ship without that decision.

## Add a destination

- **A new page:** add it to the sidebar section in `getDashboardNavSections` (or `getDashboardFooterLinks`), add its guard to `DASHBOARD_ROUTE_LEVELS`, and add aliases in `NAV_ALIASES`.
- **A panel or tab:** confirm the page opens it from the URL (read on mount is fine) and that a bad or missing id cannot open an empty form. Add it to `buildOpenActionEntries`, gated with `can('<page url>')`. If it needs a store, add a section to `BUSINESS_PALETTE_SECTIONS` instead.
- **A create form:** in the page, call `useOpenFromQuery('add', openForm, { ready, enabled })` with the same rule as its button, then add a row to `CREATE_ACTIONS`. The param is read once and removed from the URL. Never pass record data through it.
- **A Settings field:** nothing to do. New configs appear from `config_categories`. Add `SETTINGS_SEARCH_ALIASES` or `SETTINGS_SECTION_ALIASES` for Spanish terms.
- Add tests next to the util you changed and run `pnpm i18n:generate && pnpm i18n:verify`.

Full coverage, surface by surface: [`COMMAND_PALETTE_COVERAGE.md`](./COMMAND_PALETTE_COVERAGE.md).

## Surfaces that need more context (not offered as actions)

| Surface | Why it is not an action |
| --- | --- |
| Product, category, extra, tag detail (`/stores/products/:store?category=&product=`) | Needs a store slug plus category and product ids. Global product search is unavailable: see Record search › Products. `tag=<bad id>` opens an empty form. |
| Store categories `business_type=` | A bad id opens an empty add panel. |
| Delivery zone, payment method, wallet, menu inside a store | Need ids that only exist after the store loads. The palette opens the store section; the person picks the item. |
| Driver group `?id=`, campaign `?id=`, promotion `?id=` | Record ids. Orders and users are searchable; these lists are small and searchable on their pages. |
| Settings connect panels (`id=doordash`, `lalamove`…) and `more=settings` | They rewrite the hub URL without `group`/`category`; left out until that is fixed. |
| Places `country=&city=`, sites `site=`, loyalty `level=` / `business_id=` | Need record ids from inside the Settings screen. |
| `/intelligence/business-payments?business_id=` | Needs a store id. |
| My products `?id=<app>` | App ids come from the purchased apps list; the sidebar already lists them. |

## Record search: orders and users

Uses the same list endpoints as the Orders and Users pages:

| Search | Endpoint | Matches | Who |
| --- | --- | --- | --- |
| Orders | `GET /orders?mode=dashboard` | extended: number, customer name / last name / email / phone, store name. Safe: exact number | Admins and store owners who can open Orders. Drivers managers are left out: OrdersManager does not open order detail from the URL for them. |
| Users | `GET /users` with `level IN (…)` | exact id; from 3 characters: name, last name, first + last name, email, phone | Admins, limited to the user types whose listing they can open (`USER_LEVEL_DESTINATIONS`). |

| Role | Path (under `src/@/components-dashboard/src`) |
| --- | --- |
| `where` builders, query classification (id / phone / email / text), result items, access | `utils/commandPaletteRecords.js` |
| Shared remote search (debounce, cancel, stale guard, scope cache) | `components/CommandPalette/useRemoteSearch.js` (stores use it too) |
| Order and user hooks | `components/CommandPalette/useRecordSearch.js` |
| Per-project search mode (slow marks in localStorage) | `utils/commandPaletteSearchMode.js` |

Contract notes, checked against the API:

- An OR across fields must be the object form `{ conditions, conector: 'OR' }`. A top-level array with a nested `conector: 'OR'` is ignored and returns every row.
- Relation filters (`{ attribute: 'customer', conditions: [...] }`) join their inner conditions with AND, which gives "first name + last name".
- Phones are stored without country code or formatting: the search matches the last 10 digits typed.
- `ilike` values are encoded before the SDK builds the URL, like the Stores search.
- Five rows per section, one request at a time per section (`serial`). Orders and users sections hide when empty; stores still say "No stores match" for text.

### Search modes (automatic, per project)

| | Extended (default) | Safe |
| --- | --- | --- |
| Orders | number, customer name / last name / email / phone, store name; newest first | exact number only (primary key), no `orderBy` |
| Users | from 3 characters, every field; newest first | from 3 characters, every field; no `orderBy` |
| Debounce | orders 260 ms, users 400 ms | 400 ms |

Nobody has to list the large projects. An extended order or user search that has not answered after 5 s (`RECORD_SEARCH_SLOW_MS`) marks that entity of that project as slow in localStorage (`command_palette_slow_search:<project>`, 30 days) and the same query runs again in safe mode. The slow request is not waited for: the next one goes out at once. On a project in safe mode, a name or phone shows a short note pointing to "Search in Orders". Each browser pays one slow query per project before switching; clear the key (or wait 30 days) to try extended search again.
- Ids are 32-bit integers in the API: a number above 2147483647 (a phone) is never sent as an id, or the whole request fails.

### Limits on large projects (millions of orders or users)

The search policy accounts for these list-endpoint performance constraints:

- Every list request runs a `COUNT(*)` with the same filters before returning the page. Asking for 5 rows still counts every match.
- Aborting a `fetch` does not stop the query in Postgres. Typing fast would stack queries, so order and user searches run one at a time and send only the latest query.
- Orders filter customers and stores through `order_customer` and `order_business`, one row per order, with no text index. A customer, phone or store search scans every order of the project; that is what the 5 s switch to safe mode catches. The Orders listing still runs those scans when someone types in its own search box.
- User text search starts at 3 characters to support trigram indexing. Actual performance depends on the indexes available in the configured API database.
- `ORDER BY id DESC LIMIT 5` with a selective filter can make Postgres walk the primary key backwards over the whole table, so safe mode sends no `orderBy`.
- Store search uses name or slug filters through the existing business endpoint. Performance depends on the configured project and API indexes.

### Products

Global product search is not offered by the palette. Product destinations require a live store the current user can access, plus valid category and product IDs. Showing unvalidated product results could open unavailable records.
