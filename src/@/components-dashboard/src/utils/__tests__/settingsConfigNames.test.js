import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { SETTINGS_CONFIG_NAMES, SETTINGS_POSITIVE_LABEL_KEYS } from '../settingsConfigNames'
import { SETTINGS_CONFIG_COPY, SETTINGS_CONFIG_EFFECT, applySettingsConfigCopy, getSettingsConfigCopy } from '../settingsCustomSections'
import { getSettingsSelectOptions, getSettingsSwitchModel } from '../settingsSelectOptions'
import { buildSettingsHub, searchSettingsHub } from '../settingsIa'
import { seedSettingsI18n } from '../settingsI18nSeed'

// redesign (owner decision 32 A, 2026-10-21; ): the dashboard's names for the settings the API sends in
// Title Case and jargon. Presentation only: keys and stored values do not change, and an unmapped setting keeps its API name.
const catalog = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/translations.json'), 'utf8'))
const locales = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n/config.json'), 'utf8')).supportedLocales
const t = (_key, fallback) => fallback

// words that keep their capital inside a sentence-case name: acronyms and product names
const PROPER = new Set(['ID', 'GPS', 'ETA', 'Mapbox', 'Stripe', 'Connect'])

describe('SETTINGS_CONFIG_NAMES (owner decision 32 A)', () => {
  const entries = Object.entries(SETTINGS_CONFIG_NAMES)

  it('names what the T10 audit cites', () => {
    expect(SETTINGS_CONFIG_NAMES.preorder_minimum_days.label).toBe('Set minimum preorder days')
    expect(SETTINGS_CONFIG_NAMES.preorder_lead_time.label).toBe('Define order lead time')
    expect(SETTINGS_CONFIG_NAMES.validation_phone_number_lib.label).toBe('International phone validation')
  })

  // the Platform fee & driver tips name the map skipped («Driver Tip Configuration»); its effect help stays
  it('names driver_tip_options in sentence case', () => {
    expect(SETTINGS_CONFIG_NAMES.driver_tip_options.label).toBe('Driver tip options')
  })

  it('is sentence case, with no internal number and no «Disable»', () => {
    const wrong = entries.filter(([, { label }]) => {
      const words = label.split(/[\s-]+/).slice(1)
      return /\d/.test(label) ||
        /^disable/i.test(label) ||
        label[0] !== label[0].toUpperCase() ||
        words.some(word => /^[A-Z]/.test(word) && !PROPER.has(word.replace(/[^A-Za-z]/g, '')))
    })
    expect(wrong).toEqual([])
  })

  it('does not rename a setting the hub copy already names', () => {
    expect(entries.filter(([key]) => SETTINGS_CONFIG_COPY[key]).map(([key]) => key)).toEqual([])
  })

  it('seeds every name literally and has it in the catalog in every locale', () => {
    const seeded = new Map()
    seedSettingsI18n((key, fallback) => { seeded.set(key, fallback) })
    expect(entries.filter(([, { labelKey, label }]) => seeded.get(labelKey) !== label).map(([key]) => key)).toEqual([])
    const missing = entries.filter(([, { labelKey, label }]) =>
      catalog[labelKey]?.en !== label || locales.some(locale => !catalog[labelKey]?.[locale]))
    expect(missing.map(([key]) => key)).toEqual([])
  })

  it('is what the hub reads; it changes the name and nothing that is sent', () => {
    const config = { id: 9, key: 'preorder_minimum_days', name: 'Set Minimum Preorder Days', description: 'Set the minimum preorder days in advance', value: 'delivery|1', type: 6 }
    expect(getSettingsConfigCopy(config)).toBe(SETTINGS_CONFIG_NAMES.preorder_minimum_days)
    const shown = applySettingsConfigCopy(config, t)
    // (Z F3): the description is the map's too
    expect(shown).toEqual({ ...config, name: 'Set minimum preorder days', description: 'How many days in advance customers must schedule an order.' })
  })

  it('names the two checkout field screens the audit cites in sentence case, in every locale', () => {
    expect(catalog.CART_CUSTOMER_FIELDS.en).toBe('Cart and customer fields')
    expect(catalog.GUEST_CHECKOUT_FIELDS.en).toBe('Guest checkout fields')
    const source = readFileSync(resolve(process.cwd(), 'src/@/components-dashboard/src/ui/src/components/Settings/CheckoutFieldsSetting/index.js'), 'utf8')
    expect(source).toContain("t('CART_CUSTOMER_FIELDS', 'Cart and customer fields')")
  })

  // (Z F3): under the dashboard's names, the API's English descriptions stayed. Every mapped setting has a description
  // of its own in every locale, except where the hub already gives the setting an effect help (SETTINGS_CONFIG_EFFECT wins).
  it('gives every mapped setting a description of its own, seeded literally and in the catalog in every locale', () => {
    const seeded = new Map()
    seedSettingsI18n((key, fallback) => { seeded.set(key, fallback) })
    const own = entries.filter(([key]) => !SETTINGS_CONFIG_EFFECT[key])
    expect(own.filter(([, entry]) => !entry.help || !entry.helpKey).map(([key]) => key)).toEqual([])
    expect(own.filter(([key, { helpKey }]) => helpKey !== `SETTINGS_NAME_${key.toUpperCase()}_HELP`).map(([key]) => key)).toEqual([])
    expect(own.filter(([, { helpKey, help }]) => seeded.get(helpKey) !== help).map(([key]) => key)).toEqual([])
    const missing = own.filter(([, { helpKey, help }]) =>
      catalog[helpKey]?.en !== help || locales.some(locale => !catalog[helpKey]?.[locale]))
    expect(missing.map(([key]) => key)).toEqual([])
  })

  it('writes each description as a sentence, not as the API\'s «Enable or disable …»', () => {
    const wrong = entries.filter(([, { help }]) => help && (!/^[A-Z]/.test(help) || !/\.$/.test(help) || /enable or disable/i.test(help)))
    expect(wrong.map(([key]) => key)).toEqual([])
  })

  it('shows the description translated, and changes nothing that is sent', () => {
    const config = { id: 4, key: 'guest_checkout_enabled', name: 'Allow Guest Checkout', description: 'Allow customers to purchase without an account', value: '1', type: 2 }
    const es = { SETTINGS_NAME_GUEST_CHECKOUT_ENABLED_HELP: catalog.SETTINGS_NAME_GUEST_CHECKOUT_ENABLED_HELP?.es }
    const shown = applySettingsConfigCopy(config, (key, fallback) => es[key] || fallback)
    expect(shown.description).toBe(catalog.SETTINGS_NAME_GUEST_CHECKOUT_ENABLED_HELP?.es)
    expect(shown.description).toBeTruthy()
    expect([shown.key, shown.value, shown.id, shown.type]).toEqual([config.key, config.value, config.id, config.type])
  })

  // review R2: the API (and Z's name) said «export push notifications in reports»; the setting is a list of roles
  // that get a push when a new message arrives on an order (api-core Notifications::message)
  it('names and describes the order-message push setting after what it does', () => {
    expect(SETTINGS_CONFIG_NAMES.order_messages_send_to_push_notification.label).toBe('Push notifications for order messages')
    expect(SETTINGS_CONFIG_NAMES.order_messages_send_to_push_notification.help).toBe('The roles that get a push notification when a new message arrives on an order.')
    expect(catalog.SETTINGS_NAME_ORDER_MESSAGES_SEND_TO_PUSH_NOTIFICATION.es).not.toMatch(/export/i)
  })

  // review R3: the status is the order's, not the driver's or the place's
  it('says the radius setting updates the order status', () => {
    expect(SETTINGS_CONFIG_NAMES.min_distance_driver_radio.help).toMatch(/order status\.$/)
    expect(catalog.SETTINGS_NAME_MIN_DISTANCE_DRIVER_RADIO_HELP.es).toContain('estado del pedido')
  })

  it('keeps the effect help where the hub already has one', () => {
    const shown = applySettingsConfigCopy({ key: 'assign_driver_enabled', name: 'Enable Admin to Assign Drivers', description: 'x' }, t)
    expect(shown.description).toBe(SETTINGS_CONFIG_EFFECT.assign_driver_enabled.help)
  })

  it('leaves a setting that is not in the map as the API names it', () => {
    const config = { key: 'some_plugin_key', name: 'Some Plugin Key', value: '1' }
    expect(applySettingsConfigCopy(config, t)).toBe(config)
  })
})

describe('«Disable X» shown as «X» (owner decision 32 A)', () => {
  const disable = { key: 'disable_delivery_priority', name: 'Disable Delivery Priority', value: '1', options: [{ text: 'yes', value: '1' }, { text: 'no', value: '0' }] }

  it('lists only Yes/No settings that are named positively', () => {
    SETTINGS_POSITIVE_LABEL_KEYS.forEach(key => expect(SETTINGS_CONFIG_NAMES[key]).toBeTruthy())
    expect(SETTINGS_CONFIG_NAMES.disable_delivery_priority.label).toBe('Delivery priority')
  })

  it('words the phone validation help after its options, Enable and Disable (review finding 2)', () => {
    expect(SETTINGS_CONFIG_NAMES.validation_phone_number_lib.help).toBe('When enabled, international phone numbers must be valid. Disable it to allow non-local formats.')
    expect(catalog.SETTINGS_NAME_VALIDATION_PHONE_NUMBER_LIB_HELP.en).toBe(SETTINGS_CONFIG_NAMES.validation_phone_number_lib.help)
  })

  it('says with an example what goes in the default country of phone numbers', () => {
    expect(SETTINGS_CONFIG_NAMES.default_country_code.help).toBe('The country selected by default in phone number fields. Enter its two-letter code in capital letters, like US, CA or MX, not the dialing prefix (+1).')
    locales.forEach(locale => {
      expect(catalog.SETTINGS_NAME_DEFAULT_COUNTRY_CODE_HELP[locale]).toContain('US, CA')
      expect(catalog.SETTINGS_NAME_DEFAULT_COUNTRY_CODE_HELP[locale]).toContain('+1')
      expect(catalog.SETTINGS_DEFAULT_COUNTRY_CODE_INVALID[locale]).toContain('US, CA')
    })
  })

  it('uses the name\'s word for driver companies in its help (review finding 4)', () => {
    expect(catalog.SETTINGS_NAME_DISABLE_COMPANIES_ORDER_DETAILS_HELP.es).toContain('empresas de repartidores')
    expect(catalog.SETTINGS_NAME_DISABLE_COMPANIES_ORDER_DETAILS_HELP.it).toContain('aziende degli autisti')
    expect(catalog.SETTINGS_NAME_DISABLE_COMPANIES_ORDER_DETAILS_HELP.fr).toContain('sociétés de livreurs')
  })

  it('gives each positive name a help that reads the same way, instead of the API «Disable …» one', () => {
    ;[...SETTINGS_POSITIVE_LABEL_KEYS, 'validation_phone_number_lib'].forEach(key => {
      const shown = applySettingsConfigCopy({ key, name: 'Disable Something', description: 'Disable something.' }, t)
      expect(shown.description).toBe(SETTINGS_CONFIG_NAMES[key].help)
      expect(shown.description).not.toMatch(/^disable/i)
    })
  })

  it('the switch is on for the stored No and writes the stored values as they are', () => {
    expect(getSettingsSwitchModel({ config: disable })).toEqual({ onValue: '0', offValue: '1', checked: false })
    expect(getSettingsSwitchModel({ config: { ...disable, value: '0' } })).toEqual({ onValue: '0', offValue: '1', checked: true })
  })

  it('a select reads «No» for the stored Yes, and keeps each value', () => {
    expect(getSettingsSelectOptions({ config: disable, t })).toEqual([
      { value: '1', label: 'No' },
      { value: '0', label: 'Yes' }
    ])
  })

  it('does not touch the options of any other Yes/No setting', () => {
    const other = { ...disable, key: 'hidden_driver_eta_time' }
    expect(getSettingsSwitchModel({ config: other })).toEqual({ onValue: '1', offValue: '0', checked: true })
    expect(getSettingsSelectOptions({ config: other, t })).toEqual([
      { value: '1', label: 'Yes' },
      { value: '0', label: 'No' }
    ])
  })
})

describe('hub search by the new name and by the old one (owner decision 32 A)', () => {
  const category = (key, overrides = {}) => ({ id: key, key, name: key, rank: 1, configs: [], ...overrides })
  const hub = buildSettingsHub({
    categoryLists: {
      key_addon: [category('addon_catering', {
        configs: [{ key: 'preorder_minimum_days', name: 'Set Minimum Preorder Days', rank: 1 }]
      })],
      key_enterprise: [category('enterprise_delivery_driver_permissions_and_controls', {
        configs: [{ key: 'location_validation_enabled_status_26', name: 'Location Validation Status 26', rank: 1 }]
      })]
    }
  })
  const found = (query, key, options) => searchSettingsHub(hub, query, options).some(hit => hit.config?.key === key)

  it('finds a mapped setting by its API name and by the name the hub shows, translated too', () => {
    expect(found('Set Minimum Preorder Days', 'preorder_minimum_days')).toBe(true)
    expect(found('set minimum preorder days', 'preorder_minimum_days')).toBe(true)
    const es = { SETTINGS_NAME_PREORDER_MINIMUM_DAYS: 'Días mínimos de pedido anticipado' }
    expect(found('mínimos anticipado', 'preorder_minimum_days', { t: (key, fallback) => es[key] || fallback })).toBe(true)
  })

  // (Z F3): the description the hub shows is searched too, with the API one
  it('finds a mapped setting by a word of the description the hub shows, translated too, and of the API one', () => {
    const withDescription = buildSettingsHub({
      categoryLists: {
        key_addon: [category('addon_catering', {
          configs: [{ key: 'preorder_minimum_days', name: 'Set Minimum Preorder Days', description: 'Set the minimum preorder days in advance', rank: 1 }]
        })]
      }
    })
    const hit = (query, options) => searchSettingsHub(withDescription, query, options).some(item => item.config?.key === 'preorder_minimum_days')
    expect(hit('schedule')).toBe(true)
    expect(hit('minimum preorder days in advance')).toBe(true)
    const es = { SETTINGS_NAME_PREORDER_MINIMUM_DAYS_HELP: 'Cuántos días de antelación deben programar los clientes un pedido.' }
    expect(hit('antelación', { t: (key, fallback) => es[key] || fallback })).toBe(true)
  })

  it('finds a location check by the name its block shows, and by the API one', () => {
    expect(found('waiting for the customer', 'location_validation_enabled_status_26')).toBe(true)
    expect(found('Location Validation Status 26', 'location_validation_enabled_status_26')).toBe(true)
  })
})
