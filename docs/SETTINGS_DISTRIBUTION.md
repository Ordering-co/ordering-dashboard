# Settings distribution: before and after

A guide to Settings organization and legacy URL compatibility. Use this to see **where things lived**, **what was redundant**, and **where you configure them now**.

Rules for agents (do not undo): [`docs/SETTINGS.md`](./SETTINGS.md)

```
BEFORE                                          AFTER
------                                          -----
Plan-locked Settings pages                      One hub for every project
Basic / Standard / Operation / Pro              /settings?group=&category=&q=
Plugin / Enterprise / All-in-one
                                                11 task groups (not plans)
Addon pages in the sidebar                      Addon configs sit in the matching task
Loyalty, Gift cards, Catering, ...              visible in every project

Same config edited in 2 places                  One editor. Other tabs link here.
Payments, Maps, SLA, Loyalty

Duplicate keys shown side by side               One survivor shown. Twins hidden.
dates, distance, Facebook, wallet, ...          API rows remain unchanged.
```

## 1. The old model: plan pages, not tasks

Settings were split by **API parent folder** (`key_basic`, `key_pro`, `key_enterprise`, `key_plugin`) and **plan**. Basic customers only fetched Basic. Pro and Enterprise pages were locked. The same job (for example "how do I change maps?") lived under a product tier, not a task.

| Old page | Old URL | What it really was | Who saw it |
| --- | --- | --- | --- |
| Basic | `/settings/basic` | Formats, maps, order types, Stripe | Everyone |
| Standard | `/settings/standard` | Checkout form fields | Everyone |
| Operation | `/settings/operation` | Guest checkout fields | Everyone |
| Pages | `/settings/pages` | Website pages | Everyone |
| All-in-one | `/all-settings` | Dump of many categories | Everyone |
| Pro | `/settings/pro` | Email, push, login, wallets, analytics | Plan Pro+ |
| Language | `/settings/language` | Translations | Plan Pro+ |
| Plugin | `/settings/plugin` | Plugin credentials | Plan Pro+ |
| Integrations | `/settings/integrations` | API keys | Plan Pro+ |
| Enterprise | `/settings/enterprise` | Drivers, SLAs, security, places | Plan Enterprise |
| Places | `/settings/places` | Countries and cities | Plan Enterprise |

Addon **configs** also had their own pages (and a "My addons" sidebar):

| Old page | Old URL | Config it edited |
| --- | --- | --- |
| Rewards programs | `/loyalty/rewards-programs` | Loyalty points and levels |
| Wallets and refunds | `/loyalty/wallets-refunds` | Cash wallet |
| Gift card settings | `/gift-cards-settings` | Gift card configs |
| Catering | `/catering` | Catering |
| Multi-business checkout | `/multi-business-checkout` | Multi checkout |
| Stripe Connect | `/stripe-connect` | Stripe Connect |
| Reservations | `/reservations` | Reservations |

Those pages are **deleted**. Old URLs still open the hub on the matching group and section.

## 2. The new model: one hub, 11 tasks

Every project fetches **all** parent folders (`key_basic`, `key_pro`, `key_enterprise`, `key_plugin`, `key_addon`) plus `store_reservation`. The hub **regroups** them by job. `key_*` names are API folders, not products.

```
/settings
  ?group=orders&category=basic_order_types
  ?group=payments&category=stripe
  ?q=onesignal
```

| Hub group | What you configure here | Where those keys used to live |
| --- | --- | --- |
| **Orders & checkout** | Order types, checkout fields, guest checkout, scheduled orders, cart products, orders board, SLAs, catering, reservations, appointments, multi-store checkout | Basic, Standard, Operation, Pro, Enterprise, addon pages |
| **Payments** | Stripe, Apple Pay, Google Pay, Stripe Connect, cash wallet, gift cards, loyalty points | Basic, Pro, addon pages. Also a second editor on Payments |
| **Emails & notifications** | Email alerts, sender and SMTP, push (OneSignal), dashboard order alerts | Pro. Toast alert used to sit under dashboard theme |
| **Languages** | Available languages, translations | Basic / Pro language pages |
| **Locations & markets** | Maps, countries and cities, multi-country | Basic maps, Enterprise places. Also a second editor on Maps |
| **Platform** | Date and time, currency, distance, fees, registration and terms | Basic, Enterprise platform |
| **Security & login** | Login methods, Facebook / Google / Apple, Twilio, reCAPTCHA, rate limits, kiosk | Pro, Enterprise |
| **Drivers** | Permissions, location checks, assignment, scheduling, delivery-company **configs** | Enterprise delivery, addon delivery companies |
| **Website & channels** | Website pages, sales channels | Pages, Enterprise sites |
| **Apps & developers** | Plugins, analytics, API, custom orders | Plugin, Integrations. Delivery-company **credentials** stay in Connect |
| **Dashboard** | Support widget | Pro white-label / support |

If a category has no group yet, it falls into **More settings**.

## 3. Same setting, two editors (removed)

These tabs used to **edit** project configs. They now **link** to the hub. That is the main UX win besides the unlock.

| Topic | Before (two places) | After (one place) |
| --- | --- | --- |
| Loyalty levels and wallet | Loyalty tab (`FilterSettings` + Rewards programs) **and** Settings | Settings > Payments > Loyalty. Same page: Points wallet (General defaults + businesses), Levels, and the addon configs. Loyalty tab is not a config editor |
| Stripe / gateway keys | Payments > General **and** Settings | Settings > Payments (or Apps & developers for some plugins). Payments shows status + a link |
| Maps API key | Maps tab form **and** Settings > Basic maps | Settings > Locations > Maps. Maps tab shows a warning + link |
| Order SLAs | Orders SLA popover **and** Settings > Enterprise | Settings > Orders > Deadlines & SLAs. Orders navigates there |
| Gift card **configs** | Gift card settings page **and** Settings | Settings > Payments > Gift cards. `/gift-cards` stays **inventory** only |
| Delivery company **configs** | My addons / addon page | Settings > Drivers > Delivery companies |
| Delivery company **list** | Mixed with configs | Delivery tab (operations) |
| Appointments **list** | Mixed with configs | Orders |
| Professionals **list** | Mixed with configs | Users |

## 4. Intentionally not in the hub

These are not project-config lists. Do not move them into `/settings`.

| Surface | Stays here | Why |
| --- | --- | --- |
| Dashboard theme | My Products > Dashboard | Look of the dashboard, not a marketplace config |
| School module on/off | Schools tab | Module switch, not a Settings category |
| DoorDash, Uber Direct, and similar **credentials** | Connect | Plugin credentials for delivery companies |
| Gift card **inventory** | Orders > Gift cards | Stock, not configs |
| Apps purchase catalog | Footer Apps & Addons | Buying apps. Enabled app **configs** live in the matching Settings group |
| Logs Audit | `/settings/logs` | Separate tool. Not part of the hub |

`notification_toast` left dashboard theme and now lives in Emails & notifications (order alerts). `preorder_maximum_days` left catering and now lives with Scheduled orders.

## 5. Redundant keys: what we kept, what we hid

The API can still return two keys that do the same job. The hub **shows one** and **hides the rest**. Rows are not deleted by the Dashboard. Other clients may still **read** the hidden keys.

| Job | You edit this now | Hidden (do not show again) |
| --- | --- | --- |
| Date and time format | `dates_general_format` | `general_hour_format`, `dates_moment_format`, `format_time`, `time_format` |
| Distance unit | `distance_unit` | `distance_unit_km` |
| Facebook login on/off | `facebook_login_enabled` | `facebook_login` |
| Driver availability switch | `available_status_enabled` | `drivers_availability_enabled` |
| Wallet master switch | (none) Derived from `wallet_cash_enabled` and `wallet_credit_point_enabled` | `wallet_enabled` |
| Support widget | `ordering_support_widget` | `support_section` |
| OneSignal defaults | Per-app OneSignal keys | `onesignal_default_dashboardweb_id`, `onesignal_default_enabled` |

Also hidden as leftover / unused (never useful in the hub):

`search_by_address`, `pickup`, `orders_metafields_strategy`, `order_validate`, `driver_close_distance`, `lazy_load_products_when_necessary`, `advanced_business_search_enabled`

Whole categories never shown: `cloudinary`, `tookan`, `order_messages`, `others`.

## 6. Unlock vs addon flags

```
Plan locks          GONE
plan_pro            do not use on Settings
plan_enterprise     do not use on Settings
eat-in / curbside   always available in order types
drive-thru / seat   always available in order types

Addon section gates GONE
loyalty, gift cards, catering, reservations,
appointments, Stripe Connect, cash wallet,
multi checkout, delivery companies
                    visible in every project
```

## 7. Old URL to hub (bookmarks and emails)

| Old URL | Opens now |
| --- | --- |
| `/all-settings` | `/settings` |
| `/settings/basic` | `/settings?group=platform` |
| `/settings/standard` | `/settings?group=orders&category=user_information` |
| `/settings/operation` | `/settings?group=orders` |
| `/settings/pro` | `/settings?group=notifications` |
| `/settings/plugin` | `/settings?group=developers` |
| `/settings/enterprise` | `/settings?group=drivers` |
| `/settings/pages` | `/settings?group=website&category=pages` |
| `/settings/places` | `/settings?group=locations&category=places` |
| `/settings/integrations` | `/settings?group=developers&category=developers` |
| `/settings/language` | `/settings?group=languages&category=language_manager` |
| `/loyalty/rewards-programs` | `/settings?group=payments&category=addon_points_and_levels` |
| `/loyalty/wallets-refunds` | `/settings?group=payments&category=addon_cash_wallet_and_refunds` |
| `/gift-cards-settings` | `/settings?group=payments&category=addon_gift_cards` |
| `/catering` | `/settings?group=orders&category=addon_catering` |
| `/multi-business-checkout` | `/settings?group=orders&category=addon_multi_business_checkout` |
| `/stripe-connect` | `/settings?group=payments&category=addon_stripe_connect` |
| `/reservations` | `/settings?group=orders&category=store_reservation` |
| `/settings/logs` | unchanged (Logs Audit) |
| `/gift-cards` | unchanged (inventory) |

## 8. How to configure something today

1. Open **Settings** in the sidebar (`/settings`).
2. Pick a **task group**, or search by name or config key.
3. Edit the section. Custom UIs (date, reCAPTCHA, preorder, OneSignal, alerts, location checks, multi-checkout, loyalty stores) sit in that same page.
4. If you are on Payments, Maps, SLA, or Loyalty and need a config, follow the **Open Settings** link. Do not look for a form on that tab.

Sidebar shortcuts to the old Settings pages and the My addons accordion are gone. Apps live under My products. Addon **configs** live in the matching Settings group (Orders, Payments, or Drivers). There is no Add-ons group.

## 9. API compatibility

Other clients may still read hidden keys, which can remain in the database. Do not delete API configs from the dashboard. Do not show the hidden twins again "for compatibility".
