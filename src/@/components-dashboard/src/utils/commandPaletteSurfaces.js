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
  'BusinessIntelligence/BusinessReviewList:tab': record('store review detail'),
  'BusinessIntelligence/InvoiceBusinessManager:tab': indexed({ path: '/intelligence/invoice?invoice=business&tab=order_type' }),
  'BusinessIntelligence/InvoiceDriverManager:tab': indexed({ path: '/intelligence/invoice?invoice=driver&tab=payment_methods' }),
  'BusinessIntelligence/InvoiceManager:invoice': indexed({ path: '/intelligence/invoice?invoice=business' }),
  'BusinessIntelligence/ReviewProductsListing:category': record('product review needs a store and category'),
  'BusinessIntelligence/ReviewsListing:tab': indexed({ path: '/intelligence/reviews?tab=business' }),

  // Cart recovery
  'CartRecovery/RecoveryActionDetail:tab': record('recovery action detail'),
  'CartRecovery/RecoveryActionListing:add': indexed({ path: '/cart-recovery/recovery-actions?add=1' }),

  // Connect
  'Connect/BusinessDetails:section': record('integration section needs the integration chosen in the panel'),
  'Connect/DeliveryServiceDetails:tab': record('delivery company detail'),

  // Delivery
  'Delivery/DeliveryUsersListing:add': indexed({ path: '/delivery/drivers-list?add=1' }),
  'Delivery/DriversCompaniesListing:add': indexed({ path: '/delivery/drivers-companies?add=1' }),
  'Delivery/DriversCompanyDetailsForm:tab': record('delivery company detail'),
  'Delivery/DriversGroupDetails:tab': record('driver group detail'),
  'Delivery/DriversGroupsListing:add': indexed({ path: '/delivery/drivers-groups?add=1' }),
  'Delivery/UserDetails:tab': record('driver detail'),

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
  'OrderingProducts/OrderingProductDetails:tab': excluded('/ordering-products has no sidebar link'),
  'Orders/CreateCustomOrder:add': indexed({ path: '/orders?add=custom_order' }),
  'Orders/GiftCardsListing:setup': indexed({ path: '/gift-cards?setup=1' }),
  'Orders/GiftCardsListing:status': indexed({ path: '/gift-cards?status=pending' }),
  'Orders/Messages:tab': record('order history'),
  'Orders/OrderDetails:section': record('order detail'),
  'Orders/OrdersDashboardList:status': indexed({ path: '/orders?status=pending' }),
  'Orders:status': indexed({ path: '/orders?status=pending' }),

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

  // Builder
  'Builder/BuilderProductsList:add': indexed({ path: '/builder?add=1' }),

  // Stores
  'Stores/BusinessBrandListing:tab': record('brand detail'),
  'Stores/BusinessDeliveryPickupMore:tab': indexed({ action: 'action:business-delivery_pickup_more:pickup' }),
  'Stores/BusinessDetail:tab': indexed({ action: 'action:business-store_details:seo_options' }),
  'Stores/BusinessDetails:section': indexed({ action: 'action:business-schedule' }),
  'Stores/BusinessMenu:tab': indexed({ action: 'action:business-menu:shared_menus' }),
  'Stores/BusinessOrderingChannels:tab': indexed({ action: 'action:business-ordering_channels:widgets' }),
  'Stores/BusinessProductsCategoyDetails:tab': record('category detail'),
  'Stores/BusinessProductsListing:category': record('category of a store'),
  'Stores/BusinessSync:tab': indexed({ path: '/stores/list?header=sync&tab=deliverect' }),
  'Stores/BusinessesListing:header': indexed({ path: '/stores/list?header=sync&tab=deliverect' }),
  'Stores/ImportersButton:header': indexed({ path: '/stores/list?header=importers' }),
  'Stores/Markups:add': indexed({ path: '/stores/markups?add=1' }),
  'Stores/ProductDetails:section': record('product detail'),
  'Stores/ProductMainDetails:tab': record('product detail'),

  // Users
  'Users/CustomerCashWallet:tab': record('customer detail'),
  'Users/CustomerDetails:section': record('customer detail'),
  'Users/CustomerPointsWallet:tab': record('customer detail'),
  'Users/CustomersListing:add': indexed({ path: '/users/customers?add=1' }),
  'Users/ProfessionalDetail:tab': record('professional detail'),
  'Users/ProfessionalListing:add': indexed({ path: '/users/professionals?add=1' }),
  'Users/UserDetails:tab': record('user detail'),
  'Users/UsersListing:add': indexed({ path: '/users/admins?add=1' })
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
  '/support': 'sidebar link is commented out',
  '/ordering-products': 'sidebar link is commented out',
  '/assistant': 'opened with its own shortcut (⌘J) and sidebar button',
  '*': 'not found page'
}
