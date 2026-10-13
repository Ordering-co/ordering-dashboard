# Command palette coverage matrix

What ⌘K reaches, surface by surface: integrations, stores, other pages and Settings. Rules and architecture: [`COMMAND_PALETTE.md`](./COMMAND_PALETTE.md).

Status:
- **covered**: the palette opens it.
- **store first**: the palette asks for a store, then opens it.
- **record**: needs an order, user, product, campaign or other record id; reached through its listing.
- **excluded**: with the reason.

Every covered row uses the same visibility rule as the UI (sidebar section, route guard, read-only flags, addons, project rules).

## Pages

| Area | Covered | Not covered |
| --- | --- | --- |
| Mia / Assistant destination search | shared canonical navigation, Settings, integrations, stores, orders, users, safe-mode hand-offs, and destination cards | only destinations available in the current catalog can be opened |
| All sidebar pages and footer routes | covered (`utils/dashboardNavigation.js`) | `/support`, `/ordering-products`: sidebar links are commented out, excluded. `/assistant`: has its own ⌘J shortcut, excluded. |
| Orders | status tabs; Create custom order (`?add=custom_order`); search hand-off (`?q=`) | Order detail, sections and history tabs: record. Filters, SLA and column picker: local UI state. Export, delete, bulk status: excluded (download / destructive). |
| Deliveries, All in one | status tabs | Order detail: record. Filters: local state. |
| Drivers dashboard, Driver store status | page | Driver panel: record. |
| Messages, Appointments | page | Conversations, appointments: record. |
| Users (customers, owners, agents, admins, professionals) | pages; Inactive tab; Add user / Add professional (`?add=1`); customers hand-off (`?q=` to the search box or filters) | User detail sections and tabs: record. Export, delete: excluded. |
| Delivery (drivers, managers, companies, groups, time display) | pages; Add driver, driver manager, driver group, driver company (`?add=1`, button rules kept) | Detail tabs, group logistics options: record. Time display blocks: local state. |
| Marketing | Advanced offers; Quick offers view; 8 quick-offer templates (`?template=`); Add promotion; Add campaign; Ad banner positions | Promotion, campaign, banner detail: record. Add banner per position: not yet (needs the position panel to load first). |
| Cart recovery | pages; Add recovery action | Cart and action detail: record. |
| Gift cards | Pending / Redeemed tabs; Setup Gift Cards (`?setup=1`) | Gift card product detail: record. |
| Reports | Business, drivers, payment reports; 21 enterprise reports; 4 ecommerce reports (no sidebar item, admin only); invoice types and tabs; reviews tabs (professionals with the appointments addon) | Review detail, invoice detail: record. Report filters: local state. Downloads: excluded. |
| My products, Apps & Addons, Free downloads, Profile, Logs Audit | pages | App and addon detail: record (`?id=`). Buy addon, session deletion: excluded. External links: excluded. |
| Builder (project visibility rules apply) | page; Create app (`?add=1`, opens only when the catalog offers Create) | App detail (`/builder/:productId`): record. Search and filters: local state. |
| Schools | page | Tabs need a school (`school=`): record. Module toggle: excluded (changes data). |

## Stores

| Surface | Status |
| --- | --- |
| Stores list, Inactive stores, Importers panel, Sync with Deliverect / ItsaCheckmate, Add new store (`allowBusinessRegister` rule) | covered |
| Store detail sections: details, schedule, menu, delivery & pickup, notifications, payment methods, tax & fees, promotions, ordering channels, preorders (catering), custom fields (metafields), webhooks, logs, sales channels, layout, payment account, QR codes, business fees, markups, white label, reservations | store first |
| Section tabs: owner, categories, location, agents, images, videos, SEO; shared menus; delivery, pickup, driver group, advanced ETA; custom slug, widgets | store first (each tab keeps its own rule: owner hidden for level 2, agents / driver group / custom slug hidden for EatStreet owners) |
| Connect clover button | store first (opens the detail; the person presses the button, which goes to Clover) |
| Store products page, Connect POS & Menu Sync, Connect Sales Channels, Payment reports for a store | store first |
| Menu, zone, paymethod, wallet, business type, place group, product, category, tag, extra, ingredient | record. `paymethod=` and `business_type=` / `tag=` with a bad id change data or open an empty form: never deep-linked. |
| Integrations settings, Spoonity key | record (depend on the store's own configs) |
| Duplicate, delete, enable switch, slug autosave, snooze | excluded (change data) |

## Settings

| Surface | Status |
| --- | --- |
| Groups, sections, special screens, every visible field (`?focus=`), suggested tasks | covered (addon and hide rules from `buildSettingsHub`) |
| Fields inside custom blocks without their own anchor (location checks, OneSignal, order alerts, multi-checkout) | covered: focus lands on the block (`getSettingsBlockFocusId`) |
| Fields in Email alerts and Push notifications sections | covered to the section; the field highlight is not supported by those screens |
| Plugins, Webhooks, API keys, MCP keys panels | covered |
| Translations per product type (9) | covered (remounts the screen, which reads the type on mount) |
| Search hand-off (`/settings?q=`) | covered |
| Countries, cities, sites, loyalty levels and store wallets, checkout fields per site | record |
| DoorDash / Lalamove / Picker Express / Deliverect / ItsaCheckmate connect panels | excluded: no visible tile in the hub; the working integrations are in Connect and Stores › Sync |
| Payment gateway and analytics tiles, BAC Credomatic | excluded: not rendered (dead code) |

A deep link with `category` and no `group` resolves the group and keeps every other param (`country`, `city`, `site`, `id`).

## Integrations by provider name

| Search | Lands on |
| --- | --- |
| Deliverect, ItsaCheckmate, Checkmate | Connect › POS & Menu Sync; Stores › Sync |
| DoorDash, Uber Direct, Lalamove, Picker Express | Connect › Delivery services |
| DoorDash, Uber Eats, GloriaFood, Ordering.co | Connect › Importers |
| DoorDash, Uber Eats | Connect › Sales Channels |
| Clover | Connect clover (store first) |
| Facebook, Instagram, TikTok, Google My Business | Store › Sales channels (store first) |
| Stripe, PayPal, Square, Braintree, Paystack, Mercado Pago, Redsys, … (payment plugin catalog) | Store › Payment methods (store first); Settings › Payments sections |
| Google Analytics, Facebook Pixel, Segment, Intercom, Spoonity, Twilio, Apple / Facebook / Google login, Apple Pay, Google Pay, Stripe Connect | the matching Settings section |
| Any installed plugin | its Settings section (names come from `config_categories`) |

| Any POS integration listed by the API (Simphony, Wansoft, Clover…) | Connect › POS & Menu Sync for the chosen store (store first) |
| Any sales channel listed by the API (Rappi, Uber Eats…) | Connect › Sales Channels for the chosen store (store first) |
| Any system delivery company (Doordash, Uber Direct, Shipday…) | Connect › Delivery services with that company open |
| Any My products app (Marketplace App, Business App, Driver App…) | its app builder page |

These four lists are loaded from the same endpoints the pages use (`/third_party_integrations`, `/driver_companies`, `/builder/apps`) the first time the palette opens, so new providers and apps are indexed without a code change.

## Known limitations

- `/drivers-dashboard`: clicking a driver never writes `?id=` (unmapped `go_to_page 'drivers'`).
- Stores products page parses its query by position, so `?category=&tab=` breaks.
- Mercado Pago writes `payemthod_tab` (typo) and it is never cleared.
- Store detail opens any `?section=` without re-checking the menu rule; the palette applies the rule.
- `/settings/logs` page-size change calls an undefined function.
- Apps & Addons `?id=` only opens recurring, unpurchased addons.
