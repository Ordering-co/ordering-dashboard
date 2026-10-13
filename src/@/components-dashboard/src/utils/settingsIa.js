/**
 * Settings information architecture.
 *
 * Maps the API config category tree (config_categories) to the task based
 * groups shown in the Settings hub. Pure data and helpers, no React.
 *
 * Labels are stored as translation key plus English fallback so the UI can
 * call `t(labelKey, label)`.
 */

export const SETTINGS_FALLBACK_GROUP_KEY = 'more'

/**
 * Ordered list of groups shown in the hub navigation.
 */
export const SETTINGS_GROUPS = [
  {
    key: 'platform',
    labelKey: 'SETTINGS_GROUP_PLATFORM',
    label: 'Platform',
    descriptionKey: 'SETTINGS_GROUP_PLATFORM_DESCRIPTION',
    description: 'Date and time, currency, distance, fees, registration and terms.'
  },
  {
    key: 'orders',
    labelKey: 'SETTINGS_GROUP_ORDERS',
    label: 'Orders & checkout',
    descriptionKey: 'SETTINGS_GROUP_ORDERS_DESCRIPTION',
    description: 'Order types, checkout fields, scheduled orders, catering and reservations.'
  },
  {
    key: 'payments',
    labelKey: 'SETTINGS_GROUP_PAYMENTS',
    label: 'Payments',
    descriptionKey: 'SETTINGS_GROUP_PAYMENTS_DESCRIPTION',
    description: 'Card payments, wallets, gift cards and payment gateways.'
  },
  {
    key: 'notifications',
    labelKey: 'SETTINGS_GROUP_NOTIFICATIONS',
    label: 'Emails & notifications',
    descriptionKey: 'SETTINGS_GROUP_NOTIFICATIONS_DESCRIPTION',
    description: 'Email alerts, sender and SMTP, push notifications and dashboard alerts.'
  },
  {
    key: 'languages',
    labelKey: 'SETTINGS_GROUP_LANGUAGES',
    label: 'Languages',
    descriptionKey: 'SETTINGS_GROUP_LANGUAGES_DESCRIPTION',
    description: 'Available languages and translations.'
  },
  {
    key: 'locations',
    labelKey: 'SETTINGS_GROUP_LOCATIONS',
    label: 'Locations & markets',
    descriptionKey: 'SETTINGS_GROUP_LOCATIONS_DESCRIPTION',
    description: 'Countries, cities, maps and multi-country.'
  },
  {
    key: 'security',
    labelKey: 'SETTINGS_GROUP_SECURITY',
    label: 'Security & login',
    descriptionKey: 'SETTINGS_GROUP_SECURITY_DESCRIPTION',
    description: 'Login methods, one time codes, reCAPTCHA and rate limits.'
  },
  {
    key: 'drivers',
    labelKey: 'SETTINGS_GROUP_DRIVERS',
    label: 'Drivers',
    descriptionKey: 'SETTINGS_GROUP_DRIVERS_DESCRIPTION',
    description: 'Driver permissions, location checks, assignment, scheduling and delivery companies.'
  },
  {
    key: 'website',
    labelKey: 'SETTINGS_GROUP_WEBSITE',
    label: 'Website & channels',
    descriptionKey: 'SETTINGS_GROUP_WEBSITE_DESCRIPTION',
    description: 'Website pages and sales channels.'
  },
  {
    key: 'developers',
    labelKey: 'SETTINGS_GROUP_DEVELOPERS',
    label: 'Apps & developers',
    descriptionKey: 'SETTINGS_GROUP_DEVELOPERS_DESCRIPTION',
    description: 'Plugins, integrations, analytics and API access.'
  },
  {
    key: 'dashboard',
    labelKey: 'SETTINGS_GROUP_DASHBOARD',
    label: 'Dashboard',
    descriptionKey: 'SETTINGS_GROUP_DASHBOARD_DESCRIPTION',
    description: 'Options for this dashboard.'
  },
  {
    key: SETTINGS_FALLBACK_GROUP_KEY,
    labelKey: 'SETTINGS_GROUP_MORE',
    label: 'More settings',
    descriptionKey: 'SETTINGS_GROUP_MORE_DESCRIPTION',
    description: 'Settings that do not belong to a task group yet.'
  }
]

/**
 * Parent keys fetched from the API to build the hub. Every project fetches
 * all of them (no plan gating).
 */
export const SETTINGS_PARENT_CATEGORY_KEYS = ['key_basic', 'key_pro', 'key_enterprise', 'key_plugin', 'key_addon']

/**
 * Categories that are not children of a parent key and are fetched by key.
 */
export const SETTINGS_STANDALONE_CATEGORY_KEYS = ['store_reservation']

/**
 * API category key to hub group. Second and third level categories are listed
 * so the hub can flatten the tree. Plugin categories (children of key_plugin)
 * are dynamic and resolve through their parent.
 */
export const SETTINGS_CATEGORY_GROUPS = {
  // key_basic
  basic_platform: 'platform',
  platform_currency_settings: 'platform',
  platform_date_time_formats: 'platform',
  platform_distance_measurement_settings: 'platform',
  platform_fee_tip_settings: 'platform',
  platform_miscellaneous_settings: 'platform',
  platform_product_order_settings: 'orders',
  platform_registration_terms_settings: 'platform',
  basic_maps: 'locations',
  google_maps: 'locations',
  basic_order_types: 'orders',
  stripe: 'payments',
  // key_pro
  pro_preorder: 'orders',
  pro_guest_checkout: 'orders',
  email_configs: 'notifications',
  notification: 'notifications',
  pro_advanced_login: 'security',
  facebook: 'security',
  google: 'security',
  apple_login: 'security',
  twilio: 'security',
  pro_advanced_login_other: 'security',
  pro_white_labeling: 'notifications',
  ordering_support: 'dashboard',
  pro_payments: 'payments',
  global_apple_pay: 'payments',
  global_google_pay: 'payments',
  pro_integrations: 'developers',
  google_analytics: 'developers',
  facebook_pixel: 'developers',
  intercom: 'developers',
  // key_enterprise
  enterprise_platform_settings: 'platform',
  enterprise_orders_management: 'orders',
  enterprise_delivery: 'drivers',
  enterprise_delivery_driver_permissions_and_controls: 'drivers',
  enterprise_delivery_driver_assignment_and_scheduling: 'drivers',
  enterprise_delivery_auto_assignment_penalties: 'drivers',
  enterprise_delivery_offline_functionality: 'drivers',
  enterprise_delivery_order_and_status_management: 'drivers',
  enterprise_orders_slas: 'orders',
  enterprise_security: 'security',
  recaptcha: 'security',
  auth_attempts: 'security',
  generate_code: 'security',
  forgot_password_rate: 'security',
  enterprise_integrations: 'developers',
  segment: 'developers',
  spoonity: 'developers',
  enterprise_kiosk: 'security',
  // key_addon and standalone
  addon_points_and_levels: 'payments',
  addon_cash_wallet_and_refunds: 'payments',
  addon_gift_cards: 'payments',
  addon_multi_business_checkout: 'orders',
  addon_catering: 'orders',
  addon_stripe_connect: 'payments',
  addon_delivery_companies: 'drivers',
  addon_appointments: 'orders',
  professional_signup: 'orders',
  store_reservation: 'orders'
}

/**
 * Parent key to hub group, used when a category key is unknown (plugins).
 */
export const SETTINGS_PARENT_GROUPS = {
  key_plugin: 'developers'
}

/**
 * Screens that are not API categories (custom components) and where they
 * live in the hub. `settingsType` is the parent key the old UI used.
 */
export const SETTINGS_SPECIAL_SCREENS = [
  { key: 'user_information', group: 'orders', settingsType: 'key_basic', labelKey: 'CHECKOUT_FORM_FIELDS', label: 'Checkout form fields' },
  { key: 'checkout_fields', group: 'orders', settingsType: 'key_basic', labelKey: 'GUEST_CHECKOUT_FIELDS', label: 'Guest checkout fields' },
  { key: 'language_manager', group: 'languages', settingsType: 'key_basic', labelKey: 'TRANSLATIONS', label: 'Translations' },
  { key: 'languages', group: 'languages', settingsType: 'key_pro', labelKey: 'AVAILABLE_LANGUAGES', label: 'Available languages' },
  {
    key: 'custom_order',
    group: 'developers',
    settingsType: 'key_pro',
    labelKey: 'CUSTOM_ORDERS',
    label: 'Custom orders',
    descriptionKey: 'SETTINGS_CUSTOM_ORDER_HELP',
    description: 'Fees and limits for custom orders on this project.'
  },
  {
    key: 'developers',
    group: 'developers',
    settingsType: 'key_pro',
    labelKey: 'API_AND_INTEGRATIONS',
    label: 'API & integrations',
    descriptionKey: 'SETTINGS_DEVELOPERS_HELP',
    description: 'Plugins, webhooks, API keys and MCP keys for this project.'
  },
  {
    key: 'api_usage',
    group: 'developers',
    settingsType: 'key_pro',
    labelKey: 'API_USAGE_LIMITS',
    label: 'API usage limits',
    descriptionKey: 'SETTINGS_API_USAGE_HELP',
    description: 'API limits that apply to this project and how much of each is used. A limit that blocks answers with error 429 once it is exceeded.'
  },
  { key: 'places', group: 'locations', settingsType: 'key_enterprise', labelKey: 'COUNTRIES_CITIES', label: 'Countries & cities' },
  { key: 'multi_country', group: 'locations', settingsType: 'key_enterprise', labelKey: 'MULTI_COUNTRY', label: 'Multi-country' },
  { key: 'sites', group: 'website', settingsType: 'key_enterprise', labelKey: 'SALES_CHANNELS', label: 'Sales channels' },
  { key: 'pages', group: 'website', settingsType: 'key_general', labelKey: 'WEBSITE_PAGES', label: 'Website pages' }
]

/**
 * Copy dictionary: clearer section names for API categories. Categories not
 * listed keep the API name.
 */
export const SETTINGS_CATEGORY_COPY = {
  basic_platform: { labelKey: 'SETTINGS_SECTION_PLATFORM_BASICS', label: 'Formats & defaults' },
  platform_date_time_formats: { labelKey: 'SETTINGS_SECTION_DATE_TIME', label: 'Date & time format' },
  platform_currency_settings: { labelKey: 'SETTINGS_SECTION_CURRENCY', label: 'Currency & numbers' },
  platform_distance_measurement_settings: { labelKey: 'SETTINGS_SECTION_DISTANCE', label: 'Distance unit' },
  platform_fee_tip_settings: { labelKey: 'SETTINGS_SECTION_FEES_TIPS', label: 'Platform fee & driver tips' },
  platform_registration_terms_settings: { labelKey: 'SETTINGS_SECTION_REGISTRATION_TERMS', label: 'Registration & terms' },
  platform_product_order_settings: { labelKey: 'SETTINGS_SECTION_PRODUCT_ORDER', label: 'Products in the cart' },
  platform_miscellaneous_settings: { labelKey: 'SETTINGS_SECTION_OTHER_PLATFORM', label: 'Other platform options' },
  basic_maps: { labelKey: 'SETTINGS_SECTION_MAPS', label: 'Maps' },
  basic_order_types: { labelKey: 'SETTINGS_SECTION_ORDER_TYPES', label: 'Order types' },
  stripe: { labelKey: 'SETTINGS_SECTION_STRIPE', label: 'Card payments (Stripe)' },
  pro_preorder: { labelKey: 'SETTINGS_SECTION_PREORDER', label: 'Scheduled orders' },
  pro_guest_checkout: { labelKey: 'SETTINGS_SECTION_GUEST_CHECKOUT', label: 'Guest checkout' },
  email_configs: { labelKey: 'SETTINGS_SECTION_EMAIL_ALERTS', label: 'Email alerts' },
  notification: { labelKey: 'SETTINGS_SECTION_PUSH', label: 'Push notifications' },
  pro_advanced_login: { labelKey: 'SETTINGS_SECTION_LOGIN_METHODS', label: 'Login methods' },
  pro_advanced_login_other: { labelKey: 'SETTINGS_SECTION_LOGIN_OTHER', label: 'Email, phone & password login' },
  pro_white_labeling: { labelKey: 'SETTINGS_SECTION_EMAIL_SENDER', label: 'Email sender & SMTP' },
  ordering_support: { labelKey: 'SETTINGS_SECTION_SUPPORT_WIDGET', label: 'Support widget' },
  pro_payments: { labelKey: 'SETTINGS_SECTION_WALLET_PAYMENTS', label: 'Apple Pay & Google Pay' },
  pro_integrations: { labelKey: 'SETTINGS_SECTION_ANALYTICS', label: 'Analytics & tracking' },
  enterprise_platform_settings: { labelKey: 'SETTINGS_SECTION_ADVANCED_PLATFORM', label: 'Advanced platform options' },
  enterprise_orders_management: { labelKey: 'SETTINGS_SECTION_ORDERS_BOARD', label: 'Orders board' },
  enterprise_delivery: { labelKey: 'SETTINGS_SECTION_DRIVERS', label: 'Driver operations' },
  enterprise_delivery_driver_permissions_and_controls: { labelKey: 'SETTINGS_SECTION_DRIVER_PERMISSIONS', label: 'Driver permissions & location checks' },
  enterprise_delivery_driver_assignment_and_scheduling: { labelKey: 'SETTINGS_SECTION_DRIVER_ASSIGNMENT', label: 'Assignment & scheduling' },
  enterprise_delivery_auto_assignment_penalties: { labelKey: 'SETTINGS_SECTION_AUTOASSIGN_RETRIES', label: 'Auto-assignment retries' },
  enterprise_delivery_offline_functionality: { labelKey: 'SETTINGS_SECTION_DRIVER_OFFLINE', label: 'Offline mode' },
  enterprise_delivery_order_and_status_management: { labelKey: 'SETTINGS_SECTION_DRIVER_STATUS_RULES', label: 'Status & distance rules' },
  enterprise_orders_slas: { labelKey: 'SETTINGS_SECTION_DEADLINES', label: 'Deadlines & SLAs' },
  enterprise_security: { labelKey: 'SETTINGS_SECTION_ACCOUNT_SECURITY', label: 'Account security' },
  recaptcha: {
    labelKey: 'SETTINGS_SECTION_RECAPTCHA',
    label: 'reCAPTCHA',
    descriptionKey: 'SETTINGS_SECTION_RECAPTCHA_HELP',
    description: 'Choose v2, v3, or both, then add the keys.'
  },
  auth_attempts: { labelKey: 'SETTINGS_SECTION_LOGIN_ATTEMPTS', label: 'Login attempt limits' },
  generate_code: { labelKey: 'SETTINGS_SECTION_CODE_LIMITS', label: 'One time code limits' },
  forgot_password_rate: { labelKey: 'SETTINGS_SECTION_PASSWORD_RESET_LIMITS', label: 'Password reset limits' },
  enterprise_integrations: { labelKey: 'SETTINGS_SECTION_INTEGRATIONS', label: 'Integrations' },
  enterprise_kiosk: { labelKey: 'SETTINGS_SECTION_KIOSK', label: 'Kiosk device login' },
  addon_points_and_levels: { labelKey: 'SETTINGS_SECTION_LOYALTY', label: 'Loyalty points & levels' },
  addon_cash_wallet_and_refunds: { labelKey: 'SETTINGS_SECTION_CASH_WALLET', label: 'Cash wallet & refunds' },
  addon_gift_cards: { labelKey: 'SETTINGS_SECTION_GIFT_CARDS', label: 'Gift cards' },
  addon_multi_business_checkout: { labelKey: 'SETTINGS_SECTION_MULTI_CHECKOUT', label: 'Multi-business checkout' },
  addon_catering: { labelKey: 'SETTINGS_SECTION_CATERING', label: 'Catering' },
  addon_stripe_connect: { labelKey: 'SETTINGS_SECTION_STRIPE_CONNECT', label: 'Stripe Connect' },
  addon_delivery_companies: { labelKey: 'SETTINGS_SECTION_DELIVERY_COMPANIES', label: 'Delivery companies' },
  addon_appointments: { labelKey: 'SETTINGS_SECTION_APPOINTMENTS', label: 'Appointments' },
  store_reservation: { labelKey: 'SETTINGS_SECTION_RESERVATIONS', label: 'Reservations' }
}

/**
 * Addon sections are visible for every project. Buying an addon is no longer
 * possible, so these categories are not gated on a project feature or config.
 */
export const SETTINGS_ADDON_CATEGORY_FLAGS = {}

/**
 * Legacy categories never shown anywhere in Settings.
 */
export const SETTINGS_HIDDEN_CATEGORY_KEYS = [
  'cloudinary',
  'tookan',
  'order_messages',
  'others'
]

/**
 * Categories excluded from the hub only. dashboard_theme is edited in
 * My Products > Dashboard; its notification_toast config is
 * rehomed, see SETTINGS_REHOMED_CONFIGS.
 */
export const SETTINGS_HUB_EXCLUDED_CATEGORY_KEYS = ['dashboard_theme']

/**
 * Plugin config categories that belong to delivery companies. Their
 * credentials are edited in Connect, so they are filtered out
 * of Apps & developers.
 */
export const SETTINGS_DELIVERY_COMPANY_PLUGIN_KEYS = [
  'doordash_drive_integration',
  'uber_direct_integration',
  'doordash',
  'lalamove',
  'picker_express'
]

/**
 * Config keys never rendered by the hub. Superseded keys are still returned
 * by the API for the readers that have not migrated yet.
 */
export const SETTINGS_HIDDEN_CONFIG_KEYS = [
  // legacy hide list
  'search_by_address',
  'pickup',
  'orders_metafields_strategy',
  'order_validate',
  'driver_close_distance',
  'lazy_load_products_when_necessary',
  'advanced_business_search_enabled',
  // date and time: dates_general_format is the single source
  'general_hour_format',
  'dates_moment_format',
  'format_time',
  'time_format',
  // distance: distance_unit is the single source
  'distance_unit_km',
  // Facebook login: facebook_login_enabled is the single switch
  'facebook_login',
  // driver availability: available_status_enabled is the single switch
  'drivers_availability_enabled',
  // wallet: derived from wallet_cash_enabled and wallet_credit_point_enabled
  'wallet_enabled',
  // OneSignal defaults
  'onesignal_default_dashboardweb_id',
  'onesignal_default_enabled',
  // support widget: ordering_support_widget is the single switch
  'support_section'
]

/**
 * Configs that leave their API category and render inside another section.
 * notification_toast lives in dashboard_theme (hub excluded) but belongs to
 * the dashboard order alerts block. preorder_maximum_days
 * lives on catering but belongs with the global preorder window.
 */
export const SETTINGS_REHOMED_CONFIGS = {
  notification_toast: 'notification',
  preorder_maximum_days: 'pro_preorder'
}

const groupKeys = new Set(SETTINGS_GROUPS.map(group => group.key))

export const getSettingsGroup = (groupKey) =>
  SETTINGS_GROUPS.find(group => group.key === groupKey) || SETTINGS_GROUPS.find(group => group.key === SETTINGS_FALLBACK_GROUP_KEY)

/**
 * Resolves the hub group for a category. Order of precedence: explicit
 * category map, parent map, fallback group.
 */
export const getSettingsGroupKey = ({ categoryKey, parentKey } = {}) => {
  const byCategory = SETTINGS_CATEGORY_GROUPS[categoryKey]
  if (byCategory && groupKeys.has(byCategory)) return byCategory
  const byParent = SETTINGS_PARENT_GROUPS[parentKey]
  if (byParent && groupKeys.has(byParent)) return byParent
  return SETTINGS_FALLBACK_GROUP_KEY
}

export const isSettingsCategoryHidden = ({ key } = {}) => SETTINGS_HIDDEN_CATEGORY_KEYS.includes(key)

export const isSettingsCategoryExcludedFromHub = ({ key } = {}) => SETTINGS_HUB_EXCLUDED_CATEGORY_KEYS.includes(key)

export const isSettingsConfigHidden = ({ key } = {}) => SETTINGS_HIDDEN_CONFIG_KEYS.includes(key)

export const isDeliveryCompanyPluginCategory = ({ key } = {}) => SETTINGS_DELIVERY_COMPANY_PLUGIN_KEYS.includes(key)

const isFlagOn = (config) => {
  const value = config?.value
  return value === true || value === 1 || value === '1' || value === 'true'
}

/**
 * Addon categories are visible for every project. The flag map is empty.
 * `configs` stays in the signature so callers do not change.
 */
export const isSettingsAddonCategoryVisible = ({ key } = {}, configs = {}) => {
  const flagKey = SETTINGS_ADDON_CATEGORY_FLAGS[key]
  if (!flagKey) return true
  return isFlagOn(configs?.[flagKey])
}

/**
 * Applies every hub hide rule to a category list coming from the API and
 * sorts configs by rank. `parentKey` is used for plugin categories.
 */
export const filterSettingsCategories = ({ categories = [], parentKey, configs = {} } = {}) =>
  categories
    .filter(Boolean)
    .filter(category => !isSettingsCategoryHidden(category))
    .filter(category => !isSettingsCategoryExcludedFromHub(category))
    .filter(category => parentKey !== 'key_plugin' || !isDeliveryCompanyPluginCategory(category))
    .filter(category => isSettingsAddonCategoryVisible(category, configs))
    .map(category => ({
      ...category,
      configs: filterSettingsConfigs(category.configs, { categoryKey: category.key, dictionary: configs })
    }))

/**
 * The category catalog is fetched once; the config dictionary is refreshed
 * after every save. Overlay the live value so the hub never hands a stale
 * value back to the form.
 */
const applyLiveConfigValue = (config, dictionary = {}) => {
  const live = config?.key && Object.prototype.hasOwnProperty.call(dictionary || {}, config.key)
    ? dictionary[config.key]
    : null
  if (!live || live.value === undefined || live.value === config.value) return config
  return { ...config, value: live.value }
}

export const filterSettingsConfigs = (configs = [], { categoryKey, dictionary = {} } = {}) =>
  (configs || [])
    .filter(Boolean)
    .filter(config => !isSettingsConfigHidden(config))
    .filter(config => {
      const targetKey = SETTINGS_REHOMED_CONFIGS[config.key]
      return !targetKey || targetKey === categoryKey
    })
    .map(config => applyLiveConfigValue(config, dictionary))
    .sort((a, b) => (Number(a?.rank) || 0) - (Number(b?.rank) || 0))

/**
 * Returns `{ labelKey, label }` for a category, preferring the copy
 * dictionary and falling back to the API name.
 */
export const getSettingsCategoryCopy = (category = {}) => {
  const copy = SETTINGS_CATEGORY_COPY[category.key]
  if (copy) return copy
  return { labelKey: `CATEGORY_${String(category.key || '').toUpperCase()}`, label: category.name || '' }
}

/**
 * Walks a category tree (children nested on each node) into a flat list.
 */
export const flattenSettingsCategories = (categories = []) => {
  const out = []
  const walk = (list) => {
    (list || []).filter(Boolean).forEach(category => {
      out.push(category)
      if (category.children?.length) walk(category.children)
    })
  }
  walk(categories)
  return out
}

/**
 * Collects configs that must render inside another category (see
 * SETTINGS_REHOMED_CONFIGS). Reads the raw trees so excluded categories such
 * as dashboard_theme still contribute their configs.
 */
export const collectRehomedConfigs = (categoryLists = {}) => {
  const byTarget = {}
  Object.values(categoryLists).forEach(list => {
    flattenSettingsCategories(list).forEach(category => {
      (category.configs || []).forEach(config => {
        const targetKey = SETTINGS_REHOMED_CONFIGS[config?.key]
        if (!targetKey) return
        if (!byTarget[targetKey]) byTarget[targetKey] = []
        byTarget[targetKey].push(config)
      })
    })
  })
  return byTarget
}

const isEmptyParentCategory = (category) => {
  const hasChildren = Array.isArray(category?.children) && category.children.length > 0
  return hasChildren && !(category.configs || []).length
}

const attachRehomedConfigs = (category, rehomed = {}, dictionary = {}) => {
  const extras = rehomed[category.key]
  if (!extras?.length) return category
  const existing = new Set((category.configs || []).map(config => config.key))
  const merged = [
    ...(category.configs || []),
    ...extras.filter(config => config && !existing.has(config.key))
  ]
  return { ...category, configs: filterSettingsConfigs(merged, { categoryKey: category.key, dictionary }) }
}

export const getSettingsSectionLabel = (section) =>
  String(section?.copy?.label || section?.category?.name || section?.key || '')

/**
 * Alphabetical section order by the visible label. `getLabel` lets the UI
 * sort by the translated string so each locale stays A-Z.
 */
export const sortSettingsSections = (sections = [], getLabel = getSettingsSectionLabel) =>
  [...(sections || [])].sort((left, right) =>
    String(getLabel(left) || '').localeCompare(String(getLabel(right) || ''), undefined, {
      sensitivity: 'base',
      numeric: true
    })
  )

/**
 * Builds the hub structure: every group with its sections (API categories and
 * special screens) in A-Z label order. Groups without sections are dropped
 * unless `keepEmpty` is true.
 *
 * `categoryLists` is `{ [parentKey]: category[] }` as returned by the
 * AllSettings controller. Nested children are flattened. Empty parent
 * categories (only used as folders) are omitted.
 */
export const buildSettingsHub = ({ categoryLists = {}, configs = {}, keepEmpty = false } = {}) => {
  const sections = []
  const rehomed = collectRehomedConfigs(categoryLists)

  Object.entries(categoryLists).forEach(([parentKey, categories]) => {
    const flattened = flattenSettingsCategories(categories)
    const visible = filterSettingsCategories({ categories: flattened, parentKey, configs })
      .filter(category => !isEmptyParentCategory(category))
      .map(category => attachRehomedConfigs(category, rehomed, configs))

    visible.forEach(category => {
      sections.push({
        type: 'category',
        key: category.key,
        id: category.id,
        parentKey,
        group: getSettingsGroupKey({ categoryKey: category.key, parentKey }),
        rank: Number(category.rank) || 0,
        copy: getSettingsCategoryCopy(category),
        category
      })
    })
  })

  SETTINGS_SPECIAL_SCREENS.forEach((screen, index) => {
    sections.push({
      type: 'screen',
      key: screen.key,
      parentKey: screen.settingsType,
      group: screen.group,
      rank: 1000 + index,
      copy: {
        labelKey: screen.labelKey,
        label: screen.label,
        ...(screen.descriptionKey
          ? { descriptionKey: screen.descriptionKey, description: screen.description }
          : {})
      },
      screen
    })
  })

  return SETTINGS_GROUPS
    .map(group => ({
      ...group,
      sections: sortSettingsSections(
        sections.filter(section => section.group === group.key)
      )
    }))
    .filter(group => keepEmpty || group.sections.length > 0)
}

export const SETTINGS_HUB_TASKS = [
  {
    key: 'drivers_reject',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_DRIVERS_REJECT',
    label: 'Let drivers reject assigned orders',
    configKey: 'allow_driver_reject_order'
  },
  {
    key: 'stores_reject',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_STORES_REJECT',
    label: 'Let stores reject incoming orders',
    configKey: 'reject_orders_enabled'
  },
  {
    key: 'driver_tips',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_DRIVER_TIPS',
    label: 'Change the driver tip amounts',
    configKey: 'driver_tip_options'
  },
  {
    key: 'driver_available',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_DRIVER_AVAILABLE',
    label: 'Let drivers mark themselves available or busy',
    configKey: 'available_status_enabled'
  },
  {
    key: 'preorder_window',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_PREORDER',
    label: 'Set how far ahead customers can schedule',
    configKey: 'max_days_preorder'
  },
  {
    key: 'auto_assign',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_AUTO_ASSIGN',
    label: 'Configure auto-assignment retries',
    configKey: 'autoassign_time_to_attempt_again'
  },
  {
    key: 'driver_assign',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_DRIVER_ASSIGN',
    label: 'Configure driver assignment rules',
    configKey: 'assign_driver_enabled'
  },
  {
    key: 'date_time',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_DATE_TIME',
    label: 'Change how dates and times look',
    configKey: 'dates_general_format'
  },
  {
    key: 'stripe_keys',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_STRIPE',
    label: 'Set the Stripe card keys',
    configKey: 'stripe_publishable'
  },
  {
    key: 'recaptcha',
    type: 'settings',
    labelKey: 'SETTINGS_TASK_RECAPTCHA',
    label: 'Protect login with reCAPTCHA',
    configKey: 'security_recaptcha_auth'
  }
]

export const findSettingsConfigLocation = (hub = [], configKey) => {
  if (!configKey) return null
  for (const group of hub) {
    for (const section of group.sections || []) {
      const configs = section.category?.configs || []
      if (configs.some(config => config.key === configKey)) {
        return { groupKey: group.key, sectionKey: section.key, configKey }
      }
    }
  }
  return null
}

export const findSettingsSectionLocation = (hub = [], sectionKey) => {
  if (!sectionKey) return null
  for (const group of hub) {
    const section = (group.sections || []).find(item => item.key === sectionKey)
    if (section) return { groupKey: group.key, sectionKey }
  }
  return null
}

export const isSettingsTaskVisible = (hub = [], task = {}) =>
  !!task.configKey && !!findSettingsConfigLocation(hub, task.configKey)

export const listVisibleSettingsTasks = (hub = []) =>
  SETTINGS_HUB_TASKS.filter(task => isSettingsTaskVisible(hub, task))

export const SETTINGS_SEARCH_ALIASES = {
  allow_driver_reject_order: ['reject', 'decline', 'refuse', 'rechazar'],
  reject_orders_enabled: ['reject', 'decline', 'refuse', 'rechazar', 'store', 'tienda'],
  dates_general_format: ['date', 'time', 'clock', 'fecha', 'hora', '24h'],
  driver_tip_options: ['tip', 'tips', 'propina', 'gratuity'],
  max_days_preorder: ['preorder', 'schedule', 'programar', 'anticipado'],
  security_recaptcha_auth: ['captcha', 'recaptcha', 'bot', 'robot', 'login'],
  available_status_enabled: ['available', 'busy', 'disponible', 'ocupado'],
  stripe_publishable: ['stripe', 'card', 'tarjeta'],
  stripe_secret: ['stripe', 'secret']
}

export const normalizeSettingsSearch = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const scoreSettingsField = (config, section, terms) => {
  const label = normalizeSettingsSearch(config.name || '')
  const description = normalizeSettingsSearch(config.description || '')
  const key = normalizeSettingsSearch(config.key)
  const aliases = (SETTINGS_SEARCH_ALIASES[config.key] || []).map(normalizeSettingsSearch)
  let score = 0
  const ok = terms.every(term => {
    if (aliases.some(alias => alias === term || alias.split(' ').includes(term))) {
      score += 3
      return true
    }
    if (label.includes(term)) {
      score += 2
      return true
    }
    if (description.includes(term) || key.includes(term)) {
      score += 1
      return true
    }
    return false
  })
  return ok ? score : 0
}

/**
 * Field and section search across the hub. Returns hits with type, path,
 * and score sorted by relevance then label.
 */
export const searchSettingsHub = (hub = [], query = '') => {
  const terms = normalizeSettingsSearch(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const hits = []
  hub.forEach(group => {
    group.sections.forEach(section => {
      const sectionLabel = normalizeSettingsSearch(section.copy?.label || section.category?.name || '')
      if (terms.every(term => sectionLabel.includes(term))) {
        hits.push({
          type: 'section',
          groupKey: group.key,
          groupLabel: group.label,
          section,
          score: 1
        })
      }
      ;(section.category?.configs || []).forEach(config => {
        const score = scoreSettingsField(config, section, terms)
        if (score > 0) {
          hits.push({
            type: 'config',
            groupKey: group.key,
            groupLabel: group.label,
            section,
            config,
            score
          })
        }
      })
    })
  })
  return hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const labelA = a.config?.name || a.section.copy?.label || ''
    const labelB = b.config?.name || b.section.copy?.label || ''
    return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' })
  })
}

/**
 * Resolves the selected group and section from hub data and URL params.
 * `category` may be a section key or a numeric category id.
 */
export const resolveSettingsHubSelection = (hub = [], { group, category } = {}) => {
  const groups = Array.isArray(hub) ? hub : []
  if (category) {
    const categoryId = String(category)
    for (const current of groups) {
      const section = current.sections.find(item =>
        item.key === category || String(item.id) === categoryId
      )
      if (section) return { group: current, section }
    }
  }
  const selectedGroup = groups.find(item => item.key === group) || groups[0] || null
  return {
    group: selectedGroup,
    section: selectedGroup?.sections?.[0] || null
  }
}
