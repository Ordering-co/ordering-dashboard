/**
 * Command palette surface registry (auto-indexing guard).
 *
 * `commandPaletteSurfaces.test.js` scans every UI component for URL params it
 * reads (`query.get('x')`, `useOpenFromQuery('x')`) and every route in
 * `src/App.js`. Each one must be classified here, so a new page, panel, tab
 * or modal can't ship without deciding whether ⌘K reaches it:
 *
 * - `indexed`: the palette opens it. `proof` is a `path` or an entry `action`
 *   id the palette catalog must contain (checked by the test).
 * - `record`: needs a record id (order, user, product, campaign…).
 * - `list`: list state (pagination, filters) that the page entry covers.
 * - `excluded`: never offered, with the reason.
 *
 * Run `pnpm palette:coverage` to see what is missing.
 */

/** Default status by param name; a `SURFACE_REGISTRY` entry wins. */
export const PARAM_POLICY = {
  page: 'list',
  pageSize: 'list',
  active: 'list',
  enabled: 'list',
  q: 'list',
  id: 'record',
  product: 'record',
  category: 'record',
  zone: 'record',
  zone_tab: 'record',
  business_id: 'record',
  business: 'record',
  country: 'record',
  city: 'record',
  site: 'record',
  level: 'record',
  banner: 'record',
  menu: 'record',
  setting_tab: 'record',
  paymethod: 'record',
  paymethod_tab: 'record',
  payemthod_tab: 'record',
  wallet: 'record',
  place_group: 'record',
  business_type: 'record',
  extra: 'record',
  ingredient: 'record',
  tag: 'record',
  invoice_id: 'record',
  ext_report_id: 'record',
  config: 'record'
}

const indexed = (proof) => ({ status: 'indexed', proof })
const record = (note) => ({ status: 'record', note })
const excluded = (reason) => ({ status: 'excluded', reason })

const HIDDEN_CONNECT_PANEL = excluded('Settings connect panel without a visible tile (SETTINGS.md Decision S8); the working integrations are in Connect and Stores › Sync')
const THEME_EDITOR = excluded('My products › Dashboard theme editor (FilterSettings), reached from that page')

/** `<component dir relative to ui/src/components>:<param>` → classification */
export const SURFACE_REGISTRY = {
  'Stores/StoreOnboarding:key': excluded('Google Maps SDK resource query; not an application navigation surface'),
  // Reports
  // redesign invoice (D2): the one-page builder keeps the ⌘K destinations of main (?tab=; ?invoice= is read through kindFromSearch)
  'BusinessIntelligence/InvoiceBuilder:tab': indexed({ path: '/intelligence/invoice?invoice=business&tab=payment_methods' }),
  // redesign reviews: the URL of the page is read in one place (useReviewsQuery); the tabs keep their ⌘K destination
  'BusinessIntelligence/ReviewsDirectory:tab': indexed({ path: '/intelligence/reviews?tab=business' }),
  // redesign (row 3, reports P1, D-29): an open report carries its period and filters in the address to be shared; the entry of
  // each report (/intelligence/reports?id=) is the destination
  'BusinessIntelligence/Reports:from': excluded('period of an open report (?from=), shared with the link; the entry of each report covers it'),
  'BusinessIntelligence/Reports:to': excluded('period of an open report (?to=), shared with the link; the entry of each report covers it'),
  'BusinessIntelligence/Reports:day': excluded('day of report 7 (?day=), shared with the link; the entry of the report covers it'),

  // Cart recovery
  'CartRecovery/OpenCartListing:view': indexed({ path: '/cart-recovery/open-carts?view=paymentFailed' }), // redesign OC-integration
  'CartRecovery/OpenCartListing:contact': excluded('view preference of Follow up'), // redesign OC-F3 (OC-Q1-08)
  'CartRecovery/RecoveryActionListing:add': indexed({ path: '/cart-recovery/recovery-actions?add=1' }),
  'CartRecovery/RecoveryActionListing:tab': record('recovery rule panel section (?tab=notifications scrolls to Messages); needs the rule'), // redesign RA-B5

  // Connect
  // redesign DS-B4: the provider panel of the redesigned page reads the same ?tab= (its sections)
  'Connect/DeliveryServicesDirectory:tab': record('delivery company detail'),
  'Connect/WhatsAppBots:add': indexed({ path: '/connect/whatsapp-bots?add=1' }),
  // list filter of /connect/sales-channels (Channel chosen), on the
  // pattern of Stores/BusinessesListing:type; the Sales channels page entry covers it
  'Connect/PosMenu:channel': excluded('list filter of /connect/sales-channels (Channel chosen, ?channel=); the Sales channels page entry covers it'),

  // Delivery
  // redesign DL-B5: the drivers page's own listing (same ?add=1, ?tab= of main; ?status= is a view filter)
  'Delivery/DriversDirectory:add': indexed({ path: '/delivery/drivers-list?add=1' }),
  'Delivery/DriversDirectory:status': excluded('view filter of the drivers list (All, Available, Busy, Offline)'),
  'Delivery/DriversDirectory:tab': record('driver detail'),
  // redesign DC-B5: the delivery companies page moved to Delivery/DriversCompaniesDirectory (same ?add=1)
  'Delivery/DriversCompaniesDirectory:add': indexed({ path: '/delivery/drivers-companies?add=1' }),
  'Delivery/DriversGroupDetails:tab': record('driver group detail'),
  // redesign DG-B5: the delivery groups page moved to Delivery/DriversGroupsDirectory (same ?add=1)
  'Delivery/DriversGroupsDirectory:add': indexed({ path: '/delivery/drivers-groups?add=1' }),

  // Loyalty
  'Loyalty/Wallet:tab': record('wallet panel inside a loyalty program'),

  // Marketing
  'Marketing/AdBannersListing:position': indexed({ path: '/marketing/ad-banners?position=web_home_page' }),
  'Marketing/CampaignDetail:tab': record('campaign detail'),
  'Marketing/CampaignListing:add': indexed({ path: '/marketing/campaign?add=1' }),
  'Marketing/EnterprisePromotionListing:add': indexed({ path: '/marketing/promotions-enterprise?view=advanced_offers&add=1' }),
  'Marketing/PromotionJourneysListing:template': indexed({ path: '/marketing/promotions-enterprise?view=journeys&template=first_order' }),
  'Marketing/PromotionJourneysListing:view': indexed({ path: '/marketing/promotions-enterprise?view=journeys' }),

  // Orders
  'Orders/CreateCustomOrder:add': indexed({ path: '/orders?add=custom_order' }),
  'Orders/GiftCardsListing:setup': indexed({ path: '/gift-cards?setup=1' }),
  'Orders/GiftCardsListing:status': indexed({ path: '/gift-cards?status=pending' }),
  'Orders/Messages:tab': record('order history'),
  'Orders/OrderDetails:section': record('order detail'),
  'Orders/OrdersDashboardList:status': indexed({ path: '/orders?status=pending' }),
  'Orders:status': indexed({ path: '/orders?status=pending' }),
  // (D-22): filter seeds of /orders and /deliveries, read once on mount and removed from the URL (Home «Needs attention» links to them)
  'Orders:unassigned': excluded('filter seed of /orders and /deliveries (Unassigned on), read once and removed; the Orders and Deliveries page entries cover the page'),
  'Orders:late': excluded('filter seed of /orders and /deliveries (Late on), read once and removed; the Orders and Deliveries page entries cover the page'),
  // (row 28, driver-store-status P-1): the «View drivers» exit of /driver-store-status opens the board with its Driver group filter set
  'Orders/DriversManager:groups': excluded('filter seed of /drivers-dashboard (Driver group chosen), read once and removed; the Drivers dashboard page entry covers the page'),

  // Settings
  'Settings/AddressFieldsSetting:category': indexed({ path: '/settings?group=orders&category=user_information' }),
  'Settings/BacCredomatic:more': HIDDEN_CONNECT_PANEL,
  'Settings/CardFieldsSetting:category': indexed({ path: '/settings?group=orders&category=user_information' }),
  'Settings/CheckoutFieldsSetting:category': indexed({ path: '/settings?group=orders&category=user_information' }),
  'Settings/CountriesList:category': indexed({ path: '/settings?group=locations&category=places' }),
  'Settings/Deliverect:more': HIDDEN_CONNECT_PANEL,
  'Settings/DoordashConnect:more': HIDDEN_CONNECT_PANEL,
  'Settings/DropdownOptionList:category': indexed({ path: '/settings?group=locations&category=places' }),
  'Settings/FilterSettings:category': THEME_EDITOR,
  'Settings/IntegrationListing:category': indexed({ path: '/settings?group=developers&category=developers' }),
  'Settings/IntegrationListing:group': indexed({ path: '/settings?group=developers&category=developers' }),
  'Settings/ItsaCheckmate:more': HIDDEN_CONNECT_PANEL,
  'Settings/LalaMoveConnect:more': HIDDEN_CONNECT_PANEL,
  'Settings/LanguageManager:product_type': indexed({ path: '/settings?group=languages&category=language_manager&product_type=website' }),
  'Settings/PickerExpress:more': HIDDEN_CONNECT_PANEL,
  'Settings/PlaceListing:category': indexed({ path: '/settings?group=locations&category=places' }),
  'Settings/SettingsDetail:category': THEME_EDITOR,
  'Settings/SettingsDetail:more': THEME_EDITOR,
  'Settings/SettingsHub:category': indexed({ path: '/settings?group=payments' }),
  'Settings/SettingsHub:focus': indexed({ action: 'settings-group:payments' }),
  'Settings/SettingsHub:group': indexed({ path: '/settings?group=payments' }),
  'Settings/SettingsHub:view': indexed({ path: '/settings' }),
  'Settings/SitesAuthSettings:category': indexed({ path: '/settings?group=website&category=sites' }),
  // the filters of Logs Audit (settingsLogsQuery); the page entry (/settings/logs) covers them, as ?config= (a record) and ?id=
  'Settings/SettingsLogs:author': { status: 'list' },
  'Settings/SettingsLogs:from': { status: 'list' },
  'Settings/SettingsLogs:to': { status: 'list' },

  // Builder
  'Builder/BuilderProductsList:add': indexed({ path: '/builder?add=1' }),
  'Builder/BuilderWebTheme:item': record('theme of a Builder website (a component or page in its editor)'),
  'Builder/BuilderWebTheme:section': record('theme of a Builder website (a section of its editor)'),

  // Stores
  'Stores/BusinessBrandListing:tab': record('brand detail'),
  'Stores/BusinessDeliveryPickupMore:tab': indexed({ action: 'action:business-delivery_pickup_more:pickup' }),
  'Stores/BusinessDetail:tab': indexed({ action: 'action:business-store_details:seo_options' }),
  'Stores/BusinessDetails:section': indexed({ action: 'action:business-schedule' }),
  // redesign stores 4.A: the shell reads `tab` only to check its rule before it opens the section (decision 11)
  'Stores/BusinessDetails:tab': indexed({ action: 'action:business-store_details:location' }),
  'Stores/BusinessMenu:tab': indexed({ action: 'action:business-menu:shared_menus' }),
  'Stores/BusinessOrderingChannels:tab': indexed({ action: 'action:business-ordering_channels:widgets' }),
  'Stores/BusinessProductsCategoyDetails:tab': record('category detail'),
  'Stores/BusinessProductsListing:category': record('category of a store'),
  'Stores/BusinessSync:tab': indexed({ path: '/stores/list?header=sync&tab=deliverect' }),
  'Stores/BusinessesListing:header': indexed({ path: '/stores/list?header=sync&tab=deliverect' }),
  // redesign SC-B1, decision 3A: the day that «Meals & reports» and «Print labels» share is in the address; the Schools page
  // entry (nav:schools) covers them
  'Schools:date': excluded('day filter shared by the Meals and Labels tabs of /schools (?date=); the Schools page entry covers it'),
  'Schools:grade': excluded('grade filter shared by the Meals and Labels tabs of /schools (?grade=); the Schools page entry covers it'),
  'Schools:classroom': excluded('classroom filter shared by the Meals and Labels tabs of /schools (?classroom=); the Schools page entry covers it'),
  // redesign stores 3.A, decision 1 A: the business type of the list is in the address; a filter the page entry covers
  'Stores/BusinessesListing:type': excluded('list filter of /stores/list (business type, ?type=); the Stores page entry covers it'),
  'Stores/ImportersButton:header': indexed({ path: '/stores/list?header=importers' }),
  'Stores/Markups:add': indexed({ path: '/stores/markups?add=1' }),
  // redesign SL-F1 (A2): the row menu opens the store editor on its schedule, the same section the palette already indexes
  'Stores/StoresList:section': indexed({ action: 'action:business-schedule' }),
  'Stores/ProductDetails:section': record('product detail'),
  // redesign SP-F4 (D1): the product editor writes `tab` with its section (the tabs of Product details are entries of its list)
  'Stores/ProductDetails:tab': record('product detail'),
  'Stores/ProductMainDetails:tab': record('product detail'),

  // Users
  'Users/CustomerCashWallet:tab': record('customer detail'),
  'Users/CustomerDetails:section': record('customer detail'),
  'Users/CustomersDirectory:section': record('customer detail'), // redesign UC-B7: the customer panel's section (and legacy ?section=)
  'Users/CustomersDirectory:tab': record('customer detail'), // redesign UC-B7: only read to translate main's ?tab= links
  'Users/CustomerPointsWallet:tab': record('customer detail'),
  'Users/CustomersListing:add': indexed({ path: '/users/customers?add=1' }),
  'Users/ProfessionalDetail:tab': excluded('no route mounts Users/ProfessionalDetail since /users/professionals moved to Users/StaffDirectory; the professional\'s section is Users/StaffDirectory:tab'),
  'Users/StaffDirectory:add': indexed({ path: '/users/business-owners?add=1' }), // redesign BO-B6 / CA-B1 / AD-B1 / create:business_owner, create:callcenter_agent (/users/callcenter-agents?add=1), create:admin (/users/admins?add=1) and create:professional (/users/professionals?add=1) open the staff directory's add sheet; one sample path
  'Users/StaffDirectory:tab': record('staff record detail'), // redesign BO-B3 / CA-B1 / AD-B1 / the record's section (business owner, call center agent, admin or professional: profile, schedule, business_services), main's ?tab= values
  'Users/ProfessionalListing:add': excluded('no route mounts Users/ProfessionalListing since /users/professionals moved to Users/StaffDirectory; create:professional opens Users/StaffDirectory:add'),
  'Users/UserDetails:tab': record('user detail')
}

/**
 * Routes in `src/App.js` the palette does not open as a page, with the
 * reason. Every other route must be the path of a palette entry.
 */
export const ROUTE_EXCLUSIONS = {
  '/': 'redirects to the first page of the role',
  '/login': 'public',
  '/onboarding/store': 'local first-store setup controlled by the empty-project gate; not a palette destination',
  '/password/forgot': 'public',
  '/password/reset': 'public',
  '/reset_password': 'public',
  '/all-settings': 'legacy redirect into /settings',
  '/settings/basic': 'legacy redirect into /settings',
  '/settings/standard': 'legacy redirect into /settings',
  '/settings/operation': 'legacy redirect into /settings',
  '/settings/pro': 'legacy redirect into /settings',
  '/settings/plugin': 'legacy redirect into /settings',
  '/settings/pages': 'legacy redirect into /settings',
  '/settings/places': 'legacy redirect into /settings',
  '/settings/integrations': 'legacy redirect into /settings',
  '/settings/language': 'legacy redirect into /settings',
  '/settings/enterprise': 'legacy redirect into /settings',
  '/loyalty/rewards-programs': 'legacy redirect into /settings',
  '/loyalty/wallets-refunds': 'legacy redirect into /settings',
  '/gift-cards-settings': 'legacy redirect into /settings',
  '/catering': 'legacy redirect into /settings',
  '/multi-business-checkout': 'legacy redirect into /settings',
  '/stripe-connect': 'legacy redirect into /settings',
  '/reservations': 'legacy redirect into /settings',
  // redesign (n.º 21, ecommerce P2): merged into Enterprise reports; its search terms live on the report entries 1-3 and 22
  '/intelligence/ecommerce_reports': 'legacy redirect into /intelligence/reports',
  '/connect/overview': 'retired page; redirects to /connect/pos-menu',
  '/purchase/addons': 'retired page; redirects to /home',
  '/ordering-products': 'sidebar link is commented out',
  '/assistant': 'opened with its own shortcut (⌘J) and sidebar button',
  '*': 'not found page'
}
