# Settings hub

Read this before changing Settings, project configs, or anything that used to live under Basic / Pro / Plugin / Enterprise / My addons.

This is the source of truth for humans and for LLMs working in `ordering-dashboard`.

For a before/after map (old pages, new groups, hidden redundant keys): [`docs/SETTINGS_DISTRIBUTION.md`](./SETTINGS_DISTRIBUTION.md).

## Product rules (do not undo)

1. **Universal unlock.** Every project sees the same Settings catalog. There is no legacy vs new split. Do not gate Settings UI, category fetch, or in-form order types on `plan_pro` or `plan_enterprise`.
2. **One home.** Project configs are edited on `/settings` (the task hub). Do not add a second editor on another tab, modal, or old Settings page.
3. **Addon sections are universal.** Loyalty, cash wallet, gift cards, catering, reservations, appointments, Stripe Connect, and the other addon sections are visible in every project. Do not hide a hub section because an addon config or project feature is off.
4. **Logs Audit is out of scope.** `/settings/logs` stays its own page. Do not fold it into the hub and do not un-gate it here.

## What customers see

Route: `/settings?group=<group>&category=<key>&q=<search>`

`src/pages/Settings` renders `AllSettings`, which fetches the full `config_categories` catalog in **one request** and builds the hub trees on the client (`key_basic`, `key_pro`, `key_enterprise`, `key_plugin`, `key_addon`, plus `store_reservation`). Do not walk the tree with one request per folder.

Groups (task order):

| Group key | Label |
| --- | --- |
| `orders` | Orders & checkout |
| `payments` | Payments |
| `notifications` | Emails & notifications |
| `languages` | Languages |
| `locations` | Locations & markets |
| `platform` | Platform |
| `security` | Security & login |
| `drivers` | Drivers |
| `website` | Website & channels |
| `developers` | Apps & developers |
| `dashboard` | Dashboard |

Search matches title, description, and config key. Sections inside a group are listed A-Z. Mobile is list, then detail. Copy and help live inline.

Empty search shows a short task list (What do you want to do?). The Suggestions button opens that list again at `/settings` with no query. Every task stays inside Settings and opens its field with `?focus=`. Typed search matches Settings fields (and aliases), then sections. A task stays hidden when its field is missing. Do not send a task to another dashboard page from this landing.

Admin only: Settings routes use `allowedLevels={[0]}`.

Read-only screens are allowed when they belong to a group. **API usage limits** (`?group=developers&category=api_usage`) shows `GET /usage_limits` for the project: usage, remaining and reset per limit, plus empty and degraded states. It never edits limits and never sends `?include=monitor`. It loads on open and on Refresh only (no polling); Refresh waits 5 s between requests. Link to it with `buildSettingsPath({ group: 'developers', category: 'api_usage' })` (e.g. the limit-exceeded email).

**MCP (Claude Code & Codex)** (`?group=developers&category=developers&id=mcpTokens`) is a side panel of API & integrations. It calls `GET /mcp/status` first: `enabled: false` shows a Coming soon state; `enabled: true` shows the server URL (`status.url`, never built in the frontend), the user's own MCP keys (`/users/{session user}/mcp_tokens`: list, create, revoke) and the setup guide for Claude Code and Codex. Creating a key requires the data notice checkbox and sends `data_notice_version` from the status. The secret (`token`) is shown once in the create modal and dropped when it closes: never store or log it. The tile and panel are for levels 0 and 2; the Settings route itself is still level 0 only.

**Stripe Connect** (`?group=payments&category=addon_stripe_connect`) has two tabs. **Settings** retains the section configs: test mode, the Connect client ID and the payouts switch. **Configuration** reads and saves global payout rules through `GET` / `PUT /payout_rules/{platform|driver}`. Save a complete rule; it applies to future orders. The worked example illustrates the rule, while the API computes actual orders. Stripe keys remain in Card payments (Stripe).

## What is not edited in Settings

These stay outside the hub on purpose. Do not move them in without a product decision.

| Surface | Where it stays | Why |
| --- | --- | --- |
| Dashboard theme (`dashboard_theme`) | My Products > Dashboard | `notification_toast` is rehomed into Notifications. |
| School module toggle | Schools tab | `schools` is not a hub category. |
| Delivery-company plugin credentials | Connect | DoorDash, Uber Direct, and similar plugin categories are filtered out of Apps & developers. |
| Gift card inventory | Orders > Gift cards (`/gift-cards`) | Inventory, not project config. Configs are Settings > Payments. |
| Apps catalog | Footer Apps & Addons (`/purchase/addons`) | Purchase catalog. Enabled app configs live in the matching Settings group. |
| Logs Audit | `/settings/logs` | Out of scope. |
| Store Stripe account, platform fee and payouts | Stores > store > Payment methods > Stripe Connect v2 | Per-store records; account connection follows store-owner permissions. |
| Driver Stripe account and payment rule | Delivery > Drivers > driver > Stripe Connect | Per-driver records; available to administrators when the payouts flag is enabled. |

## File map

| Role | Path |
| --- | --- |
| Page | `src/pages/Settings/index.js` |
| Legacy URL redirect | `src/pages/Settings/LegacyRedirect.js` |
| Fetch + hub wire | `src/@/components-dashboard/src/ui/src/components/Settings/AllSettings/` |
| Category tree from one catalog | `src/@/components-dashboard/src/utils/settingsCategoryTree.js` |
| Hub UI | `src/@/components-dashboard/src/ui/src/components/Settings/SettingsHub/` |
| Custom blocks (date, reCAPTCHA, preorder, OneSignal, alerts, location checks, multi-checkout, reservation JSON) | `src/@/components-dashboard/src/ui/src/components/Settings/SettingsCustomBlocks/` |
| Loyalty wallet (general defaults, per-store rules, levels) | `src/@/components-dashboard/src/ui/src/components/Settings/SettingsLoyaltyStores/` |
| Generic config list | `src/@/components-dashboard/src/ui/src/components/Settings/SettingsList/` |
| Custom blocks, copy, dependent field map | `src/@/components-dashboard/src/utils/settingsCustomSections.js` |
| IA, hide lists, groups | `src/@/components-dashboard/src/utils/settingsIa.js` |
| Fetch unlock, order types | `src/@/components-dashboard/src/utils/settingsAccess.js` |
| Old URL map, `buildSettingsPath` | `src/@/components-dashboard/src/utils/settingsRedirects.js` |
| Links from other tabs | `src/@/components-dashboard/src/utils/settingsExternalEditors.js` |
| API usage limits (read-only) | `src/@/components-dashboard/src/ui/src/components/Settings/ApiUsageLimits/` |
| MCP keys + setup guide | `src/@/components-dashboard/src/components/McpTokens/` (controller), `src/@/components-dashboard/src/ui/src/components/Settings/McpTokens/` (UI) |
| Literal `t()` seeds for dynamic copy | `src/@/components-dashboard/src/utils/settingsI18nSeed.js` |
| My Products theme editor only | `FilterSettings` used from `MyProducts/OrderingWebsite` with `settingsType: 'dashboard_theme'` |

Old pages (`BasicSettings`, `ProSettings`, `PluginSettings`, addon settings pages, `SettingsMenuOptions`, Maps key form, SLA popover) are not used. Do not recreate them.

## Unlock details

`getSettingsCategoryKeysToFetch()` always returns every parent key as enabled. `getSettingsOrderTypeValues()` always includes eat-in, curbside, drive-thru, seat delivery, catering, and reservation. Do not hide those types behind an addon flag.

Do **not**:

- Reintroduce `isProjectProPlan` / `isProjectEnterpricePlan` / `plan_pro` / `plan_enterprise` on Settings paths.
- Hide eat-in, curbside, drive-thru, or seat delivery behind a plan.
- Fetch only `key_basic` for some projects.

Sidebar Connect or billing flags are a different system (`getFeatureFlags`, PostHog, `dashboardFeatureAccess`). Do not copy those gates into Settings.

## Hidden and surviving configs

The API may still return superseded keys. The hub hides them, but other clients may still read them. Do not delete API rows from the Dashboard.

| Setting | Keep | Hide |
| --- | --- | --- |
| Date and time | `dates_general_format` | `general_hour_format`, `dates_moment_format`, `format_time`, `time_format` |
| Distance | `distance_unit` | `distance_unit_km` |
| Facebook login | `facebook_login_enabled` | `facebook_login` |
| Driver availability | `available_status_enabled` | `drivers_availability_enabled` |
| Wallet | `wallet_cash_enabled`, `wallet_credit_point_enabled` | `wallet_enabled` (derived) |
| Support widget | `ordering_support_widget` | `support_section` |
| OneSignal | per-app keys | `onesignal_default_dashboardweb_id`, `onesignal_default_enabled` |

Rehomed into another hub section:

- `notification_toast` → `notification`
- `preorder_maximum_days` → `pro_preorder`

Lists live in `settingsIa.js`: `SETTINGS_HIDDEN_CONFIG_KEYS`, `SETTINGS_HIDDEN_CATEGORY_KEYS`, `SETTINGS_HUB_EXCLUDED_CATEGORY_KEYS`, `SETTINGS_REHOMED_CONFIGS`, `SETTINGS_DELIVERY_COMPANY_PLUGIN_KEYS`. `SETTINGS_ADDON_CATEGORY_FLAGS` is empty: addon sections are not gated.

Dependent field pairs live in `settingsCustomSections.js`: `SETTINGS_FIELD_DEPENDENCIES`.

## Dependent fields

A dependent config is hidden until its master matches. The local map is the source of truth. Ignore API `dependency_key` (the catalog is stale).

Contract in `SETTINGS_FIELD_DEPENDENCIES`:

- `{ key: masterKey }` or `{ key: masterKey, on: true }`: show the dependent when the master is on (`1`, `true`, `yes`).
- `{ key: masterKey, on: false }`: show the dependent when the master is off (SMTP custom host).
- `{ key: masterKey, values: string[] }`: show the dependent when the master raw value (trimmed) is in that list. Used for Stripe sandbox vs live.

Rules:

- Hidden means unmounted. Do not render a collapsed summary or a disabled field.
- Values stay in the database (ghost data). Do not send hidden dependents in the save payload.
- Fail-open: if the master key is missing from the category configs, keep the dependent visible.
- `?focus=` on a hidden dependent scrolls to the master. Never fail silently.

`SettingsList` and `SettingsCustomBlocks` both filter with `getVisibleSettingsConfigs` before render.

Save stays hidden unless a visible field string differs from the last saved snapshot (`String(next) !== String(saved)`). Reverting a field drops it from `changes`. Do not trim or coerce types. Hidden dependents still stay out of the payload.

Leftover enable switches that belong with a custom block (`checkout_multi_business_enabled`, `preorder_status_enabled`, `reservation_enabled`) render above that block. Other leftovers stay below.

Leftover type 6 configs (pipe lists per order type, such as `preorder_minimum_days`) use the same compact table as Scheduled orders: Order type | Days, Minutes, or Value. Row labels come from `PREORDER_TYPE_LABELS`. Catering rows show only when the catering addon is on. Do not add a custom block for these leftovers.

`reservation_setting` is a custom block that uses the same compact table as leftover type 6. Save still sends one JSON string. Do not show the raw JSON box. `reservation_enabled` stays visible above the table. Do not hide the table from that switch.

Do **not** add these to the map (already handled or ambiguous):

- reCAPTCHA keys (`RecaptchaBlock` already swaps v2/v3)
- Driver location-check table cells (hiding a cell would leave a blank row)
- `twilio_whatsapp_template_sid`
- `use_alternative_to_google_maps`

## Old URLs

`SETTINGS_LEGACY_REDIRECTS` in `settingsRedirects.js` maps old paths to hub query. `App.js` still mounts `SettingsLegacyRedirect` for those paths. `ListenPageChanges` may still emit the old page names; those URLs redirect.

Use `buildSettingsPath({ group, category, q })` for any new in-app link to Settings. If you touch loyalty or similar URL helpers, merge query params. Do not wipe `group` / `category`.

## How to add or change a setting

1. Prefer an existing hub section. Map the API category in `SETTINGS_CATEGORY_GROUPS` if it is new.
2. If the UI needs a custom block, add it in `SettingsCustomBlocks` (or a sibling) and skip that key in `SettingsList`.
3. If a field should stay hidden until a master is on (or matches a value), add it to `SETTINGS_FIELD_DEPENDENCIES` in `settingsCustomSections.js`. Do not hide it only in the renderer.
4. Put customer-facing copy in `t('KEY', 'English fallback')`. If the key is built dynamically, add a literal `t()` in `settingsI18nSeed.js` so `pnpm i18n:generate` sees it. Fill all locales in `i18n/config.json` (`pnpm i18n:missing`, translate-keys, `pnpm i18n:verify`).
5. If the editor used to live on another tab, remove that editor and link to the hub (`settingsExternalEditors.js`).
6. Add or update tests next to `settingsIa`, `settingsAccess`, `settingsRedirects`, `settingsCustomSections`, `SettingsHub`, `SettingsList`, or the custom block.
7. Do not add a new `src/pages/*Settings` wrapper. The only Settings page is `src/pages/Settings`.

## i18n

Scanner only sees literal `t('KEY', 'fallback')`. Dynamic `t(copy.labelKey)` needs the seed file. After commit, husky runs `i18n:generate`. Generate may report empty slots; `pnpm i18n:missing --summary` and `pnpm i18n:verify` are the truth.

## Tests

```bash
pnpm lint:check
pnpm i18n:verify
pnpm exec vitest --run src/@/components-dashboard/src/utils/__tests__/settingsIa.test.js src/@/components-dashboard/src/utils/__tests__/settingsAccess.test.js src/@/components-dashboard/src/utils/__tests__/settingsRedirects.test.js src/@/components-dashboard/src/utils/__tests__/settingsCategoryTree.test.js src/@/components-dashboard/src/utils/__tests__/settingsCustomSections.test.js src/@/components-dashboard/src/ui/src/components/Settings/SettingsHub/__tests__/SettingsHub.test.jsx src/@/components-dashboard/src/ui/src/components/Settings/SettingsList/__tests__/SettingsList.test.jsx src/@/components-dashboard/src/ui/src/components/Settings/SettingsCustomBlocks/__tests__/SettingsCustomBlocks.test.jsx
```

## Common LLM mistakes

1. Recreating Basic / Pro / Plugin / All-in-one Settings pages.
2. Walking `config_categories` one folder at a time. Fetch the catalog once and build the tree in `settingsCategoryTree.js`.
3. Opening a `FilterSettings` or config form on Orders, Payments, Loyalty, Drivers, or Maps.
4. Gating hub categories or order types on plan configs.
5. Putting `dashboard_theme` back in the hub, or moving the school toggle into Settings.
6. Showing DoorDash / Uber Direct credentials under Settings > Apps & developers.
7. Replacing hub query params when opening a nested loyalty or payment sidebar.
8. Editing only `en` copy. Update every locale in `i18n/config.json`.
9. Treating `key_basic` / `key_pro` / `key_enterprise` as plan products. They are API parent folders. Every project fetches all of them.
