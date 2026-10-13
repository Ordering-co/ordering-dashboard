import { describe, expect, it } from 'vitest'

import {
  SETTINGS_ADDON_CATEGORY_FLAGS,
  SETTINGS_CATEGORY_COPY,
  SETTINGS_CATEGORY_GROUPS,
  SETTINGS_FALLBACK_GROUP_KEY,
  SETTINGS_GROUPS,
  SETTINGS_HIDDEN_CONFIG_KEYS,
  SETTINGS_PARENT_GROUPS,
  SETTINGS_REHOMED_CONFIGS,
  SETTINGS_SPECIAL_SCREENS,
  SETTINGS_HUB_TASKS,
  buildSettingsHub,
  collectRehomedConfigs,
  findSettingsConfigLocation,
  findSettingsSectionLocation,
  filterSettingsCategories,
  filterSettingsConfigs,
  flattenSettingsCategories,
  getSettingsCategoryCopy,
  getSettingsGroup,
  getSettingsGroupKey,
  isDeliveryCompanyPluginCategory,
  isSettingsAddonCategoryVisible,
  isSettingsCategoryExcludedFromHub,
  isSettingsCategoryHidden,
  isSettingsConfigHidden,
  listVisibleSettingsTasks,
  resolveSettingsHubSelection,
  searchSettingsHub,
  sortSettingsSections
} from '../settingsIa'

const groupKeys = SETTINGS_GROUPS.map(group => group.key)

/**
 * Snapshot of the API catalog (api-core upsert_config_categories_and_configs)
 * used to prove every real category resolves to a group.
 */
const CATALOG = {
  key_basic: ['basic_platform', 'basic_maps', 'basic_order_types', 'stripe', 'dashboard_theme'],
  basic_platform: [
    'platform_currency_settings',
    'platform_date_time_formats',
    'platform_distance_measurement_settings',
    'platform_fee_tip_settings',
    'platform_miscellaneous_settings',
    'platform_product_order_settings',
    'platform_registration_terms_settings'
  ],
  basic_maps: ['google_maps'],
  key_pro: ['pro_preorder', 'pro_guest_checkout', 'email_configs', 'notification', 'pro_advanced_login', 'pro_white_labeling', 'pro_payments', 'pro_integrations'],
  pro_advanced_login: ['facebook', 'google', 'apple_login', 'twilio', 'pro_advanced_login_other'],
  pro_white_labeling: ['ordering_support'],
  pro_payments: ['global_apple_pay', 'global_google_pay'],
  pro_integrations: ['google_analytics', 'facebook_pixel', 'intercom'],
  key_enterprise: ['enterprise_platform_settings', 'enterprise_orders_management', 'enterprise_delivery', 'enterprise_orders_slas', 'enterprise_security', 'enterprise_integrations', 'enterprise_kiosk'],
  enterprise_delivery: [
    'enterprise_delivery_driver_permissions_and_controls',
    'enterprise_delivery_driver_assignment_and_scheduling',
    'enterprise_delivery_auto_assignment_penalties',
    'enterprise_delivery_offline_functionality',
    'enterprise_delivery_order_and_status_management'
  ],
  enterprise_security: ['recaptcha', 'auth_attempts', 'generate_code', 'forgot_password_rate'],
  enterprise_integrations: ['segment', 'spoonity'],
  key_addon: ['addon_points_and_levels', 'addon_cash_wallet_and_refunds', 'addon_gift_cards', 'addon_multi_business_checkout', 'addon_catering', 'addon_stripe_connect', 'addon_delivery_companies', 'addon_appointments'],
  addon_appointments: ['professional_signup'],
  standalone: ['store_reservation']
}

const allCatalogKeys = Object.values(CATALOG).flat()

const category = (key, overrides = {}) => ({ id: key.length, key, name: key, rank: 1, configs: [], ...overrides })

describe('SETTINGS_GROUPS', () => {
  it('has unique keys and translation keys', () => {
    expect(new Set(groupKeys).size).toBe(groupKeys.length)
    const labelKeys = SETTINGS_GROUPS.map(group => group.labelKey)
    expect(new Set(labelKeys).size).toBe(labelKeys.length)
  })

  it('lists Platform first', () => {
    expect(groupKeys[0]).toBe('platform')
  })

  it('ends with the fallback group and has no leftover Add-ons group', () => {
    expect(groupKeys[groupKeys.length - 1]).toBe(SETTINGS_FALLBACK_GROUP_KEY)
    expect(groupKeys).not.toContain('addons')
  })

  it('every mapped group exists', () => {
    Object.values(SETTINGS_CATEGORY_GROUPS).forEach(groupKey => expect(groupKeys).toContain(groupKey))
    Object.values(SETTINGS_PARENT_GROUPS).forEach(groupKey => expect(groupKeys).toContain(groupKey))
    SETTINGS_SPECIAL_SCREENS.forEach(screen => expect(groupKeys).toContain(screen.group))
  })
})

describe('getSettingsGroupKey', () => {
  it('resolves every catalog category to a real group (never the fallback)', () => {
    allCatalogKeys
      .filter(key => key !== 'dashboard_theme')
      .forEach(key => {
        const groupKey = getSettingsGroupKey({ categoryKey: key })
        expect(groupKeys).toContain(groupKey)
        expect(groupKey, key).not.toBe(SETTINGS_FALLBACK_GROUP_KEY)
      })
  })

  it('uses the parent map for dynamic plugin categories', () => {
    expect(getSettingsGroupKey({ categoryKey: 'some_new_plugin', parentKey: 'key_plugin' })).toBe('developers')
    expect(getSettingsGroupKey({ categoryKey: 'addon_new_thing', parentKey: 'key_addon' })).toBe(SETTINGS_FALLBACK_GROUP_KEY)
  })

  it('falls back to "more" for unknown categories', () => {
    expect(getSettingsGroupKey({ categoryKey: 'unknown' })).toBe(SETTINGS_FALLBACK_GROUP_KEY)
    expect(getSettingsGroupKey()).toBe(SETTINGS_FALLBACK_GROUP_KEY)
  })

  it('places the decided sections where the plan says', () => {
    expect(getSettingsGroupKey({ categoryKey: 'platform_date_time_formats' })).toBe('platform')
    expect(getSettingsGroupKey({ categoryKey: 'recaptcha' })).toBe('security')
    expect(getSettingsGroupKey({ categoryKey: 'enterprise_delivery_driver_permissions_and_controls' })).toBe('drivers')
    expect(getSettingsGroupKey({ categoryKey: 'addon_delivery_companies' })).toBe('drivers')
    expect(getSettingsGroupKey({ categoryKey: 'addon_multi_business_checkout' })).toBe('orders')
    expect(getSettingsGroupKey({ categoryKey: 'addon_catering' })).toBe('orders')
    expect(getSettingsGroupKey({ categoryKey: 'addon_appointments' })).toBe('orders')
    expect(getSettingsGroupKey({ categoryKey: 'professional_signup' })).toBe('orders')
    expect(getSettingsGroupKey({ categoryKey: 'store_reservation' })).toBe('orders')
    expect(getSettingsGroupKey({ categoryKey: 'addon_points_and_levels' })).toBe('payments')
    expect(getSettingsGroupKey({ categoryKey: 'addon_cash_wallet_and_refunds' })).toBe('payments')
    expect(getSettingsGroupKey({ categoryKey: 'addon_gift_cards' })).toBe('payments')
    expect(getSettingsGroupKey({ categoryKey: 'addon_stripe_connect' })).toBe('payments')
    expect(getSettingsGroupKey({ categoryKey: 'enterprise_orders_slas' })).toBe('orders')
    expect(getSettingsGroupKey({ categoryKey: 'notification' })).toBe('notifications')
    expect(getSettingsGroupKey({ categoryKey: 'ordering_support' })).toBe('dashboard')
  })
})

describe('getSettingsGroup', () => {
  it('returns the group object or the fallback', () => {
    expect(getSettingsGroup('payments').label).toBe('Payments')
    expect(getSettingsGroup('nope').key).toBe(SETTINGS_FALLBACK_GROUP_KEY)
  })
})

describe('hide rules', () => {
  it('hides the superseded config keys from the consolidation decisions', () => {
    const superseded = [
      'general_hour_format', 'dates_moment_format', 'format_time', 'time_format',
      'distance_unit_km', 'facebook_login', 'drivers_availability_enabled',
      'wallet_enabled', 'onesignal_default_enabled', 'support_section'
    ]
    superseded.forEach(key => expect(isSettingsConfigHidden({ key }), key).toBe(true))
  })

  it('keeps the surviving keys visible', () => {
    const surviving = [
      'dates_general_format', 'distance_unit', 'facebook_login_enabled', 'available_status_enabled',
      'reject_orders_enabled', 'allow_driver_reject_order', 'max_days_preorder', 'preorder_maximum_days',
      'wallet_cash_enabled', 'wallet_credit_point_enabled', 'notification_toast', 'ordering_support_widget',
      'onesignal_dashboardweb_id', 'security_recaptcha_auth'
    ]
    surviving.forEach(key => expect(isSettingsConfigHidden({ key }), key).toBe(false))
    expect(SETTINGS_HIDDEN_CONFIG_KEYS).not.toContain('dates_general_format')
  })

  it('keeps the schools toggle off the Settings hub', () => {
    expect(SETTINGS_CATEGORY_GROUPS.schools).toBeUndefined()
    expect(Object.values(SETTINGS_CATEGORY_GROUPS)).not.toContain('schools')
  })

  it('hides legacy categories everywhere and dashboard_theme from the hub only', () => {
    expect(isSettingsCategoryHidden({ key: 'cloudinary' })).toBe(true)
    expect(isSettingsCategoryHidden({ key: 'dashboard_theme' })).toBe(false)
    expect(isSettingsCategoryExcludedFromHub({ key: 'dashboard_theme' })).toBe(true)
    expect(isSettingsCategoryExcludedFromHub({ key: 'stripe' })).toBe(false)
  })

  it('flags delivery company plugin categories', () => {
    expect(isDeliveryCompanyPluginCategory({ key: 'doordash_drive_integration' })).toBe(true)
    expect(isDeliveryCompanyPluginCategory({ key: 'uber_direct_integration' })).toBe(true)
    expect(isDeliveryCompanyPluginCategory({ key: 'custom_order' })).toBe(false)
  })

  it('rehomes notification_toast and preorder_maximum_days into their task sections', () => {
    expect(SETTINGS_REHOMED_CONFIGS.notification_toast).toBe('notification')
    expect(SETTINGS_REHOMED_CONFIGS.preorder_maximum_days).toBe('pro_preorder')
  })
})

describe('filterSettingsConfigs', () => {
  it('drops hidden keys, ignores null entries and sorts by rank', () => {
    const configs = [
      { key: 'b', rank: '2' },
      null,
      { key: 'format_time', rank: 0 },
      { key: 'a', rank: 1 },
      { key: 'c' }
    ]
    expect(filterSettingsConfigs(configs).map(config => config.key)).toEqual(['c', 'a', 'b'])
    expect(filterSettingsConfigs()).toEqual([])
    expect(filterSettingsConfigs(null)).toEqual([])
  })

  it('keeps rehomed configs only on their target category', () => {
    const configs = [
      { key: 'preorder_maximum_days', rank: 1 },
      { key: 'max_days_preorder', rank: 2 }
    ]
    expect(filterSettingsConfigs(configs, { categoryKey: 'addon_catering' }).map(config => config.key))
      .toEqual(['max_days_preorder'])
    expect(filterSettingsConfigs(configs, { categoryKey: 'pro_preorder' }).map(config => config.key))
      .toEqual(['preorder_maximum_days', 'max_days_preorder'])
  })
})

describe('isSettingsAddonCategoryVisible', () => {
  it('shows every category, including addons, with no flag', () => {
    expect(SETTINGS_ADDON_CATEGORY_FLAGS).toEqual({})
    expect(isSettingsAddonCategoryVisible({ key: 'stripe' }, {})).toBe(true)
    expect(isSettingsAddonCategoryVisible({ key: 'addon_catering' }, {})).toBe(true)
    expect(isSettingsAddonCategoryVisible({ key: 'addon_catering' }, { addon_catering: { value: '0' } })).toBe(true)
    expect(isSettingsAddonCategoryVisible({ key: 'store_reservation' }, {})).toBe(true)
  })
})

describe('filterSettingsCategories', () => {
  it('applies category, hub, plugin and addon rules and cleans configs', () => {
    const categories = [
      category('stripe', { configs: [{ key: 'stripe_secret', rank: 2 }, { key: 'time_format', rank: 1 }] }),
      category('cloudinary'),
      category('dashboard_theme'),
      category('addon_catering'),
      category('addon_gift_cards'),
      null
    ]
    const result = filterSettingsCategories({
      categories,
      parentKey: 'key_basic',
      configs: { addon_gift_cards: { value: '1' } }
    })
    expect(result.map(item => item.key)).toEqual(['stripe', 'addon_catering', 'addon_gift_cards'])
    expect(result[0].configs.map(config => config.key)).toEqual(['stripe_secret'])
  })

  it('filters delivery company plugins only under key_plugin', () => {
    const categories = [category('doordash_drive_integration'), category('custom_order')]
    expect(filterSettingsCategories({ categories, parentKey: 'key_plugin' }).map(item => item.key)).toEqual(['custom_order'])
    expect(filterSettingsCategories({ categories, parentKey: 'key_addon' }).map(item => item.key)).toEqual(['doordash_drive_integration', 'custom_order'])
  })

  it('handles missing input', () => {
    expect(filterSettingsCategories()).toEqual([])
  })

  it('overlays live values from the config dictionary onto catalog configs', () => {
    const categories = [
      category('facebook', {
        configs: [
          { id: 851, key: 'facebook_login_enabled', value: '1', rank: 1 },
          { id: 852, key: 'facebook_id', value: 'catalog-id', rank: 2 }
        ]
      })
    ]
    const result = filterSettingsCategories({
      categories,
      parentKey: 'key_basic',
      configs: {
        facebook_login_enabled: { id: 851, value: '0' }
      }
    })
    expect(result[0].configs.find(config => config.key === 'facebook_login_enabled').value).toBe('0')
    expect(result[0].configs.find(config => config.key === 'facebook_id').value).toBe('catalog-id')
  })
})

describe('getSettingsCategoryCopy', () => {
  it('prefers the copy dictionary', () => {
    expect(getSettingsCategoryCopy({ key: 'pro_white_labeling', name: 'White Label' })).toEqual({
      labelKey: 'SETTINGS_SECTION_EMAIL_SENDER',
      label: 'Email sender & SMTP'
    })
  })

  it('falls back to the API name with a derived translation key', () => {
    expect(getSettingsCategoryCopy({ key: 'some_plugin', name: 'Some plugin' })).toEqual({
      labelKey: 'CATEGORY_SOME_PLUGIN',
      label: 'Some plugin'
    })
    expect(getSettingsCategoryCopy()).toEqual({ labelKey: 'CATEGORY_', label: '' })
  })

  it('has unique translation keys in the dictionary', () => {
    const labelKeys = Object.values(SETTINGS_CATEGORY_COPY).map(copy => copy.labelKey)
    expect(new Set(labelKeys).size).toBe(labelKeys.length)
  })
})

describe('buildSettingsHub', () => {
  const categoryLists = {
    key_basic: [
      category('basic_order_types', { rank: 3 }),
      category('stripe', { rank: 4 }),
      category('dashboard_theme', { rank: 5 })
    ],
    key_pro: [category('notification', { rank: 4 }), category('pro_preorder', { rank: 1 })],
    key_plugin: [category('doordash_drive_integration'), category('zapier', { name: 'Zapier' })],
    key_addon: [category('addon_catering'), category('addon_gift_cards')],
    store_reservation: [category('store_reservation')]
  }
  const configs = { addon_gift_cards: { value: '1' }, addon_reservation: { value: '1' } }

  it('groups categories and special screens in A-Z label order', () => {
    const hub = buildSettingsHub({ categoryLists, configs })
    const orders = hub.find(group => group.key === 'orders')
    expect(orders.sections.map(section => section.copy.label)).toEqual([
      'Catering',
      'Checkout form fields',
      'Guest checkout fields',
      'Order types',
      'Reservations',
      'Scheduled orders'
    ])
    expect(orders.sections.map(section => section.key)).toEqual([
      'addon_catering',
      'user_information',
      'checkout_fields',
      'basic_order_types',
      'store_reservation',
      'pro_preorder'
    ])
    expect(orders.sections.find(section => section.key === 'user_information').type).toBe('screen')
  })

  it('drops excluded categories and delivery plugins, and keeps addon sections', () => {
    const hub = buildSettingsHub({ categoryLists, configs })
    const allKeys = hub.flatMap(group => group.sections.map(section => section.key))
    expect(allKeys).not.toContain('dashboard_theme')
    expect(allKeys).not.toContain('doordash_drive_integration')
    expect(allKeys).toContain('addon_catering')
    expect(allKeys).toContain('addon_gift_cards')
    expect(allKeys).toContain('store_reservation')
    expect(allKeys).toContain('zapier')
  })

  it('sends unknown plugins to Apps & developers with the API name', () => {
    const hub = buildSettingsHub({ categoryLists, configs })
    const developers = hub.find(group => group.key === 'developers')
    const zapier = developers.sections.find(section => section.key === 'zapier')
    expect(zapier.copy).toEqual({ labelKey: 'CATEGORY_ZAPIER', label: 'Zapier' })
  })

  it('keeps API & integrations copy on the special screen', () => {
    const hub = buildSettingsHub({ categoryLists, configs })
    const developers = hub.find(group => group.key === 'developers')
    const api = developers.sections.find(section => section.key === 'developers')
    expect(api.copy).toEqual({
      labelKey: 'API_AND_INTEGRATIONS',
      label: 'API & integrations',
      descriptionKey: 'SETTINGS_DEVELOPERS_HELP',
      description: 'Plugins, webhooks, API keys and MCP keys for this project.'
    })
  })

  it('lists API usage limits as a screen in Apps & developers', () => {
    const hub = buildSettingsHub({ categoryLists, configs })
    const developers = hub.find(group => group.key === 'developers')
    const usage = developers.sections.find(section => section.key === 'api_usage')
    expect(usage.type).toBe('screen')
    expect(usage.copy.labelKey).toBe('API_USAGE_LIMITS')
    expect(usage.copy.descriptionKey).toBe('SETTINGS_API_USAGE_HELP')
  })

  it('removes empty groups unless asked to keep them', () => {
    const hub = buildSettingsHub({ categoryLists, configs })
    expect(hub.find(group => group.key === SETTINGS_FALLBACK_GROUP_KEY)).toBeUndefined()
    const full = buildSettingsHub({ categoryLists, configs, keepEmpty: true })
    expect(full.map(group => group.key)).toEqual(groupKeys)
  })

  it('works with no data', () => {
    const hub = buildSettingsHub()
    const keys = hub.map(group => group.key)
    expect(keys).toContain('orders')
    expect(hub.every(group => group.sections.every(section => section.type === 'screen'))).toBe(true)
  })

  it('flattens nested children and skips empty parent folders', () => {
    const hub = buildSettingsHub({
      categoryLists: {
        key_basic: [
          category('basic_platform', {
            configs: [],
            children: [
              category('platform_date_time_formats', { rank: 1, configs: [{ key: 'dates_general_format', rank: 1 }] })
            ]
          })
        ]
      }
    })
    const platform = hub.find(group => group.key === 'platform')
    expect(platform.sections.map(section => section.key)).toEqual(['platform_date_time_formats'])
  })

  it('rehomes notification_toast from dashboard_theme into notification', () => {
    const hub = buildSettingsHub({
      categoryLists: {
        key_basic: [category('dashboard_theme', {
          configs: [{ key: 'notification_toast', name: 'Toast', rank: 1 }]
        })],
        key_pro: [category('notification', { configs: [{ key: 'onesignal_dashboardweb_id', rank: 1 }] })]
      }
    })
    const notifications = hub.find(group => group.key === 'notifications')
    const section = notifications.sections.find(item => item.key === 'notification')
    expect(section.category.configs.map(config => config.key)).toEqual([
      'onesignal_dashboardweb_id',
      'notification_toast'
    ])
  })

  it('rehomes preorder_maximum_days from catering into scheduled orders', () => {
    const hub = buildSettingsHub({
      categoryLists: {
        key_pro: [category('pro_preorder', { configs: [{ key: 'max_days_preorder', rank: 1 }] })],
        key_addon: [category('addon_catering', {
          configs: [
            { key: 'preorder_maximum_days', rank: 2 },
            { key: 'preorder_minimum_days', rank: 1 }
          ]
        })]
      },
      configs: { addon_catering: { value: '1' } }
    })
    const orders = hub.find(group => group.key === 'orders')
    const scheduled = orders.sections.find(item => item.key === 'pro_preorder')
    const catering = hub.find(group => group.key === 'orders')?.sections.find(item => item.key === 'addon_catering')
    expect(scheduled.category.configs.map(config => config.key)).toEqual([
      'max_days_preorder',
      'preorder_maximum_days'
    ])
    expect(catering.category.configs.map(config => config.key)).toEqual(['preorder_minimum_days'])
  })
})

describe('flattenSettingsCategories and rehome helpers', () => {
  it('walks nested children', () => {
    const tree = [category('parent', { children: [category('child')] })]
    expect(flattenSettingsCategories(tree).map(item => item.key)).toEqual(['parent', 'child'])
    expect(flattenSettingsCategories()).toEqual([])
  })

  it('collects rehomed configs from excluded categories', () => {
    const rehomed = collectRehomedConfigs({
      key_basic: [category('dashboard_theme', {
        configs: [{ key: 'notification_toast', rank: 1 }, { key: 'dashboard_title', rank: 2 }]
      })]
    })
    expect(rehomed.notification.map(config => config.key)).toEqual(['notification_toast'])
  })
})

describe('resolveSettingsHubSelection', () => {
  const hub = buildSettingsHub({
    categoryLists: {
      key_basic: [category('stripe', { id: 44, rank: 1 })]
    }
  })

  it('finds a section by key or numeric id', () => {
    expect(resolveSettingsHubSelection(hub, { category: 'stripe' }).group.key).toBe('payments')
    expect(resolveSettingsHubSelection(hub, { category: '44' }).section.key).toBe('stripe')
  })

  it('falls back to the named group or the first group', () => {
    expect(resolveSettingsHubSelection(hub, { group: 'orders' }).group.key).toBe('orders')
    expect(resolveSettingsHubSelection(hub, {}).group.key).toBe('orders')
    expect(resolveSettingsHubSelection([], {}).group).toBeNull()
  })

  it('opens a former Add-ons section from its category, even with a stale group', () => {
    const fullHub = buildSettingsHub({
      categoryLists: {
        key_addon: [category('addon_catering'), category('addon_gift_cards')]
      },
      configs: { addon_catering: { value: '1' }, addon_gift_cards: { value: '1' } }
    })
    expect(resolveSettingsHubSelection(fullHub, { group: 'addons', category: 'addon_catering' }).group.key).toBe('orders')
    expect(resolveSettingsHubSelection(fullHub, { group: 'addons', category: 'addon_gift_cards' }).group.key).toBe('payments')
  })
})

describe('sortSettingsSections', () => {
  it('sorts by visible label, ignoring API rank and case', () => {
    const sections = [
      { key: 'b', rank: 1, copy: { label: 'Scheduled orders' } },
      { key: 'a', rank: 9, copy: { label: 'catering' } },
      { key: 'c', rank: 2, copy: { label: 'Reservations' } }
    ]
    expect(sortSettingsSections(sections).map(section => section.key)).toEqual(['a', 'c', 'b'])
    expect(sortSettingsSections()).toEqual([])
  })
})

describe('listVisibleSettingsTasks', () => {
  it('hides a Settings task when its field is not in the hub', () => {
    const hub = buildSettingsHub({ categoryLists: { key_basic: [category('stripe')] } })
    expect(listVisibleSettingsTasks(hub).map(task => task.key))
      .not.toContain('driver_assign')
    expect(listVisibleSettingsTasks(hub).map(task => task.key))
      .not.toContain('drivers_reject')
  })

  it('shows a Settings task when its field is present', () => {
    const hub = buildSettingsHub({
      categoryLists: {
        key_enterprise: [category('enterprise_delivery_driver_assignment_and_scheduling', {
          configs: [{ key: 'assign_driver_enabled', rank: 1 }]
        })]
      }
    })
    const tasks = listVisibleSettingsTasks(hub)
    expect(tasks.some(task => task.key === 'driver_assign')).toBe(true)
    expect(findSettingsSectionLocation(hub, 'enterprise_delivery_driver_assignment_and_scheduling')).toEqual({
      groupKey: 'drivers',
      sectionKey: 'enterprise_delivery_driver_assignment_and_scheduling'
    })
    expect(findSettingsConfigLocation(hub, 'assign_driver_enabled')).toEqual({
      groupKey: 'drivers',
      sectionKey: 'enterprise_delivery_driver_assignment_and_scheduling',
      configKey: 'assign_driver_enabled'
    })
  })

  it('lists the curated tasks in spec order', () => {
    expect(SETTINGS_HUB_TASKS.map(task => task.configKey)).toEqual([
      'allow_driver_reject_order',
      'reject_orders_enabled',
      'driver_tip_options',
      'available_status_enabled',
      'max_days_preorder',
      'autoassign_time_to_attempt_again',
      'assign_driver_enabled',
      'dates_general_format',
      'stripe_publishable',
      'security_recaptcha_auth'
    ])
  })
})

describe('searchSettingsHub', () => {
  const hub = buildSettingsHub({
    categoryLists: {
      key_basic: [category('stripe', {
        name: 'Card Payments',
        description: 'Stripe keys',
        configs: [{ key: 'stripe_publishable', name: 'Publishable key', rank: 1 }]
      })]
    }
  })

  it('returns field hits with a path, not only the parent section', () => {
    const hits = searchSettingsHub(hub, 'publishable')
    expect(hits.map(hit => hit.type)).toEqual(['config'])
    expect(hits[0].config.key).toBe('stripe_publishable')
    expect(hits[0].section.key).toBe('stripe')
    expect(hits[0].groupKey).toBe('payments')
  })

  it('matches aliases such as rechazar on reject_orders_enabled', () => {
    const full = buildSettingsHub({
      categoryLists: {
        key_basic: [category('enterprise_orders_management', {
          configs: [{ key: 'reject_orders_enabled', name: 'Allow businesses to reject orders', rank: 1 }]
        })]
      }
    })
    const hits = searchSettingsHub(full, 'rechazar')
    expect(hits.some(hit => hit.config?.key === 'reject_orders_enabled')).toBe(true)
  })

  it('still returns a section when the query matches the section label', () => {
    const hits = searchSettingsHub(hub, 'card payments')
    expect(hits.some(hit => hit.type === 'section' && hit.section.key === 'stripe')).toBe(true)
  })

  it('returns nothing for an empty or unmatched query', () => {
    expect(searchSettingsHub(hub, '')).toEqual([])
    expect(searchSettingsHub(hub, 'zzz-not-there')).toEqual([])
  })
})
