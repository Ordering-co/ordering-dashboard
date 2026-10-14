import { describe, expect, it } from 'vitest'

import {
  applySettingsConfigCopy,
  DATE_TIME_PRESETS,
  findConfigsByKeys,
  formatWithDateTokens,
  getActiveCustomBlocks,
  getConfigToggleValues,
  getCustomBlockId,
  getSettingsFocusId,
  SETTINGS_CONFIG_EFFECT,
  getDateTimeCompanionValues,
  getDateTimeFormats,
  getDateTimePreview,
  getLeftoverSettingsConfigs,
  isSettingsCustomBlockMaster,
  getPreorderTypeRows,
  getSettingsType6TypeLabel,
  getSettingsType6Unit,
  getRecaptchaSubmitErrorCodes,
  getRecaptchaValidation,
  getVisibleRecaptchaKeys,
  getSettingsFieldDependency,
  getSettingsInputPresentation,
  getVisibleSettingsConfigs,
  isSettingsConfigVisible,
  isSettingsCredentialFilled,
  isSettingsDependencyMet,
  isSettingsValueDirty,
  mergeSettingsChanges,
  isSettingsToggleOn,
  normalizeRecaptchaType,
  persistRecaptchaType,
  resolveSettingsFocusKey,
  isConfigOn,
  isCustomBlockConfig,
  isDateTimePreset,
  MULTI_CHECKOUT_DISCOUNT_KEYS,
  parseReservationSettingValue,
  parseType6Value,
  SETTINGS_FIELD_DEPENDENCIES,
  updateReservationSettingValue,
  updateType6Value
} from '../settingsCustomSections'

const sampleDate = new Date(2026, 8, 14, 14, 30, 0)

describe('custom block membership', () => {
  it('maps known keys to their blocks', () => {
    expect(getCustomBlockId('dates_general_format')).toBe('date_time')
    expect(getCustomBlockId('security_recaptcha_auth')).toBe('recaptcha')
    expect(getCustomBlockId('location_validation_enabled_status_3')).toBe('location_checks')
    expect(getCustomBlockId('max_days_preorder')).toBe('preorder_window')
    expect(getCustomBlockId('onesignal_orderingapp_id')).toBe('onesignal')
    expect(getCustomBlockId('notification_toast')).toBe('order_alerts')
    expect(getCustomBlockId(MULTI_CHECKOUT_DISCOUNT_KEYS[0])).toBe('multi_checkout')
    expect(getCustomBlockId('reservation_setting')).toBe('reservation')
    expect(isCustomBlockConfig('reject_orders_enabled')).toBe(false)
    expect(isCustomBlockConfig('reservation_setting')).toBe(true)
    expect(getLeftoverSettingsConfigs([
      { key: 'reservation_setting' },
      { key: 'reservation_enabled' }
    ]).map(config => config.key)).toEqual(['reservation_enabled'])
  })

  it('returns active blocks in display order', () => {
    expect(getActiveCustomBlocks([
      { key: 'notification_toast' },
      { key: 'dates_general_format' },
      { key: 'unknown' }
    ])).toEqual(['date_time', 'order_alerts'])
  })

  it('keeps leftover configs out of custom blocks', () => {
    const leftover = getLeftoverSettingsConfigs([
      { key: 'dates_general_format' },
      { key: 'reject_orders_enabled' }
    ])
    expect(leftover.map(config => config.key)).toEqual(['reject_orders_enabled'])
  })

  it('marks leftover enable switches that unlock a custom block', () => {
    expect(isSettingsCustomBlockMaster('checkout_multi_business_enabled')).toBe(true)
    expect(isSettingsCustomBlockMaster('preorder_status_enabled')).toBe(true)
    expect(isSettingsCustomBlockMaster('reservation_enabled')).toBe(true)
    expect(isSettingsCustomBlockMaster('facebook_login_enabled')).toBe(false)
    expect(isSettingsCustomBlockMaster('notification_in_app_enabled')).toBe(false)
  })
})

describe('recaptcha visibility', () => {
  it('shows only the matching version keys', () => {
    expect(normalizeRecaptchaType('v3')).toBe('both')
    expect(normalizeRecaptchaType('v3_only')).toBe('v3')
    expect(persistRecaptchaType('v3')).toBe('v3_only')
    expect(persistRecaptchaType('both')).toBe('v3')
    expect(getVisibleRecaptchaKeys('v2')).toContain('security_recaptcha_site_key')
    expect(getVisibleRecaptchaKeys('v2')).not.toContain('security_recaptcha_site_key_v3')
    expect(getVisibleRecaptchaKeys('v3_only')).toContain('security_recaptcha_site_key_v3')
    expect(getVisibleRecaptchaKeys('v3_only')).not.toContain('security_recaptcha_site_key')
    expect(getVisibleRecaptchaKeys('v3')).toContain('security_recaptcha_site_key')
    expect(getVisibleRecaptchaKeys('v3')).toContain('security_recaptcha_site_key_v3')
    expect(getVisibleRecaptchaKeys('both')).toContain('security_recaptcha_site_key')
    expect(getVisibleRecaptchaKeys('both')).toContain('security_recaptcha_site_key_v3')
  })

  it('requires the keys for the selected version', () => {
    expect(getRecaptchaValidation({
      type: 'v2',
      configs: [{ key: 'security_recaptcha_site_key', value: '' }]
    }).isValid).toBe(false)
    expect(getRecaptchaValidation({
      type: 'v3_only',
      configs: [
        { key: 'security_recaptcha_site_key_v3', value: 'site' },
        { key: 'security_recaptcha_secret_key_v3', value: 'secret' },
        { key: 'security_recaptcha_score_v3', value: '1.4' }
      ]
    }).errors.security_recaptcha_score_v3).toBe('SETTINGS_RECAPTCHA_SCORE_RANGE')
    expect(getRecaptchaValidation({
      type: 'both',
      configs: [
        { key: 'security_recaptcha_site_key', value: 'v2-site' },
        { key: 'security_recaptcha_secret_key', value: 'v2-secret' },
        { key: 'security_recaptcha_site_key_v3', value: 'v3-site' },
        { key: 'security_recaptcha_secret_key_v3', value: 'v3-secret' },
        { key: 'security_recaptcha_score_v3', value: '0.5' }
      ]
    }).isValid).toBe(true)
    expect(getRecaptchaSubmitErrorCodes({
      type: 'v2',
      configs: [{ key: 'security_recaptcha_auth', value: '1' }]
    })).toEqual(['SETTINGS_RECAPTCHA_ENABLE_INVALID'])
    expect(getRecaptchaSubmitErrorCodes({
      type: 'v3_only',
      configs: [
        { key: 'security_recaptcha_site_key_v3', value: 'site' },
        { key: 'security_recaptcha_secret_key_v3', value: 'secret' },
        { key: 'security_recaptcha_score_v3', value: '2' }
      ]
    })).toEqual(['SETTINGS_RECAPTCHA_SCORE_RANGE'])
    expect(getRecaptchaSubmitErrorCodes({
      type: 'v2',
      configs: [
        { key: 'security_recaptcha_auth', value: '0' },
        { key: 'security_recaptcha_site_key', value: '' }
      ]
    })).toEqual([])
  })
})

describe('date companions', () => {
  it('derives format_time and the yearless moment format from the general format', () => {
    expect(getDateTimeFormats('YYYY-MM-DD HH:mm:ss')).toMatchObject({
      is12Hours: false,
      preorderDateFormat: 'MM-DD'
    })
    expect(getDateTimeCompanionValues('YYYY-MM-DD HH:mm:ss')).toEqual({
      format_time: '24',
      dates_moment_format: 'MM-DD HH:mm:ss'
    })
    expect(getDateTimeCompanionValues('MM/DD/YYYY hh:mm A')).toEqual({
      format_time: '12',
      dates_moment_format: 'MM/DD hh:mm A'
    })
  })
})

describe('date preview', () => {
  it('formats presets and scheduled dates without the year', () => {
    expect(isDateTimePreset(DATE_TIME_PRESETS[0])).toBe(true)
    expect(formatWithDateTokens('MM/DD/YYYY hh:mm A', sampleDate)).toBe('09/14/2026 02:30 PM')
    expect(getDateTimePreview('YYYY-MM-DD HH:mm:ss', sampleDate)).toEqual({
      date: '2026-09-14',
      time: '14:30:00',
      scheduled: '09-14'
    })
    expect(getDateTimePreview('DD MMM YYYY HH:mm', sampleDate).scheduled).toBe('14 Sep')
  })
})

describe('type 6 values', () => {
  it('parses, updates and builds preorder rows', () => {
    const value = 'delivery,15|pickup,10|catering_delivery,20'
    expect(parseType6Value(value)).toEqual([
      { type: 'delivery', value: '15' },
      { type: 'pickup', value: '10' },
      { type: 'catering_delivery', value: '20' }
    ])
    expect(updateType6Value(value, 'pickup', '12')).toBe('delivery,15|pickup,12|catering_delivery,20')
    expect(getPreorderTypeRows(value, { includeCatering: false }).map(row => row.type))
      .not.toContain('catering_delivery')
    expect(getPreorderTypeRows(value, { includeCatering: true }).find(row => row.type === 'catering_delivery').value)
      .toBe('20')
  })

  it('picks Days, Minutes or Value from the leftover type 6 key', () => {
    expect(getSettingsType6Unit('preorder_minimum_days')).toEqual({
      labelKey: 'SETTINGS_PREORDER_DAYS',
      label: 'Days'
    })
    expect(getSettingsType6Unit('preorder_lead_time')).toEqual({
      labelKey: 'MINUTES',
      label: 'Minutes'
    })
    expect(getSettingsType6Unit('preorder_slot_interval')).toEqual({
      labelKey: 'MINUTES',
      label: 'Minutes'
    })
    expect(getSettingsType6Unit('preorder_time_range')).toEqual({
      labelKey: 'MINUTES',
      label: 'Minutes'
    })
    expect(getSettingsType6Unit('unknown_type6')).toEqual({
      labelKey: 'SETTINGS_TYPE6_VALUE',
      label: 'Value'
    })
  })

  it('labels leftover type 6 rows without smashed translation keys', () => {
    expect(getSettingsType6TypeLabel('delivery')).toEqual({
      labelKey: 'DELIVERY',
      label: 'Delivery'
    })
    expect(getSettingsType6TypeLabel('eatin')).toEqual({
      labelKey: 'EAT_IN',
      label: 'Eat in'
    })
    expect(getSettingsType6TypeLabel('custom_slot')).toEqual({
      labelKey: 'SETTINGS_ORDER_TYPE_custom_slot',
      label: 'custom slot'
    })
  })
})

describe('reservation setting JSON', () => {
  const stored = '{"min_guests_reservation":1,"max_guests_reservation":4,"min_time_reserve_minutes":5,"max_time_reserve_days":2,"late_arrival_hold_minutes":15,"max_reservation_sites":2,"allow_preorder_reservation":true,"extra_flag":9}'

  it('parses the stored JSON and keeps unknown keys on update', () => {
    expect(parseReservationSettingValue(stored).extra_flag).toBe(9)
    const next = updateReservationSettingValue(stored, 'min_guests_reservation', '3')
    expect(JSON.parse(next)).toMatchObject({
      min_guests_reservation: 3,
      max_guests_reservation: 4,
      extra_flag: 9,
      allow_preorder_reservation: true
    })
  })

  it('does not throw on empty or invalid JSON', () => {
    expect(parseReservationSettingValue('')).toEqual({})
    expect(parseReservationSettingValue('not-json')).toEqual({})
    expect(() => updateReservationSettingValue('not-json', 'max_reservation_sites', '2')).not.toThrow()
    expect(JSON.parse(updateReservationSettingValue('not-json', 'allow_preorder_reservation', '1')).allow_preorder_reservation).toBe(true)
  })
})

describe('focus ids and effect copy', () => {
  it('builds a stable focus id and on/off copy for curated keys', () => {
    expect(getSettingsFocusId('allow_driver_reject_order')).toBe('settings-focus-allow_driver_reject_order')
    expect(SETTINGS_CONFIG_EFFECT.allow_driver_reject_order.help)
      .toBe('When on, a driver can tap Reject after an order is assigned. When off, they must take it.')
  })
})

describe('toggle helpers and copy', () => {
  it('reads yes/no options from arrays or JSON', () => {
    const config = {
      value: 'true',
      options: '[{"text":"YES","value":"true"},{"text":"NO","value":"false"}]'
    }
    expect(getConfigToggleValues(config)).toEqual({ on: 'true', off: 'false' })
    expect(isConfigOn(config)).toBe(true)
  })

  it('applies the copy dictionary', () => {
    const copied = applySettingsConfigCopy({
      key: 'security_recaptcha_auth',
      name: 'API name'
    }, (key, fallback) => fallback)
    expect(copied.name).toBe('Login')
  })

  it('finds configs by key list', () => {
    expect(findConfigsByKeys([{ key: 'a' }, { key: 'b' }], ['b', 'c']).map(config => config.key)).toEqual(['b'])
  })
})

describe('dependent fields (progressive disclosure)', () => {
  const facebookOff = [
    { id: 1, key: 'facebook_login_enabled', value: '0' },
    { id: 2, key: 'facebook_id', value: 'app-id' },
    { id: 3, key: 'facebook_secret', value: 'shh' }
  ]
  const facebookOn = facebookOff.map(config => (
    config.key === 'facebook_login_enabled' ? { ...config, value: '1' } : config
  ))

  it('normalizes toggle values regardless of the stored format', () => {
    expect(isSettingsToggleOn('1')).toBe(true)
    expect(isSettingsToggleOn('true')).toBe(true)
    expect(isSettingsToggleOn(' YES ')).toBe(true)
    expect(isSettingsToggleOn(1)).toBe(true)
    expect(isSettingsToggleOn('0')).toBe(false)
    expect(isSettingsToggleOn('false')).toBe(false)
    expect(isSettingsToggleOn('')).toBe(false)
    expect(isSettingsToggleOn(null)).toBe(false)
    expect(isSettingsToggleOn(undefined)).toBe(false)
  })

  it('exposes the dependency for a dependent key and null otherwise', () => {
    expect(getSettingsFieldDependency('facebook_id')).toEqual({ key: 'facebook_login_enabled' })
    expect(getSettingsFieldDependency('whatsapp_support_phone')).toEqual({ key: 'whatsapp_support_enabled' })
    expect(getSettingsFieldDependency('email_smtp_host')).toEqual({ key: 'email_smtp_use_default', on: false })
    expect(getSettingsFieldDependency('facebook_login_enabled')).toBeNull()
    expect(getSettingsFieldDependency(undefined)).toBeNull()
  })

  it('ignores prototype keys coming from the focus query string', () => {
    expect(getSettingsFieldDependency('constructor')).toBeNull()
    expect(getSettingsFieldDependency('__proto__')).toBeNull()
    expect(getSettingsFieldDependency('hasOwnProperty')).toBeNull()
    expect(resolveSettingsFocusKey('constructor', facebookOff)).toBe('constructor')
  })

  it('hides dependents while the on/off master is off and shows them when on', () => {
    expect(isSettingsConfigVisible(facebookOff[1], facebookOff)).toBe(false)
    expect(isSettingsConfigVisible(facebookOff[2], facebookOff)).toBe(false)
    expect(isSettingsConfigVisible(facebookOn[1], facebookOn)).toBe(true)
    expect(isSettingsConfigVisible(facebookOn[0], facebookOn)).toBe(true)
    expect(getVisibleSettingsConfigs(facebookOff).map(config => config.key)).toEqual(['facebook_login_enabled'])
    expect(getVisibleSettingsConfigs(facebookOn).map(config => config.key))
      .toEqual(['facebook_login_enabled', 'facebook_id', 'facebook_secret'])
  })

  it('supports inverted masters (SMTP fields show when "use default" is off)', () => {
    const useDefault = [
      { id: 1, key: 'email_smtp_use_default', value: '1' },
      { id: 2, key: 'email_smtp_host', value: 'smtp.example.com' }
    ]
    const custom = useDefault.map(config => (
      config.key === 'email_smtp_use_default' ? { ...config, value: '0' } : config
    ))
    expect(isSettingsConfigVisible(useDefault[1], useDefault)).toBe(false)
    expect(isSettingsConfigVisible(custom[1], custom)).toBe(true)
  })

  it('discloses by mode value (stripe sandbox vs live keys)', () => {
    const sandbox = [
      { id: 1, key: 'stripe_sandbox', value: '1' },
      { id: 2, key: 'stripe_publishable', value: 'pk_live' },
      { id: 3, key: 'stripe_secret', value: 'sk_live' },
      { id: 4, key: 'stripe_publishable_sandbox', value: 'pk_test' },
      { id: 5, key: 'stripe_secret_sandbox', value: 'sk_test' }
    ]
    const live = sandbox.map(config => (
      config.key === 'stripe_sandbox' ? { ...config, value: '0' } : config
    ))
    expect(getVisibleSettingsConfigs(sandbox).map(config => config.key))
      .toEqual(['stripe_sandbox', 'stripe_publishable_sandbox', 'stripe_secret_sandbox'])
    expect(getVisibleSettingsConfigs(live).map(config => config.key))
      .toEqual(['stripe_sandbox', 'stripe_publishable', 'stripe_secret'])
  })

  it('matches explicit value lists for non-boolean masters', () => {
    const configs = [{ key: 'mode', value: ' b ' }]
    expect(isSettingsDependencyMet({ key: 'mode', values: ['a', 'b'] }, configs)).toBe(true)
    expect(isSettingsDependencyMet({ key: 'mode', values: ['c'] }, configs)).toBe(false)
    expect(isSettingsDependencyMet(null, configs)).toBe(true)
  })

  it('fails open when the master is not part of the category configs', () => {
    const orphan = [{ id: 2, key: 'facebook_id', value: 'app-id' }]
    expect(isSettingsConfigVisible(orphan[0], orphan)).toBe(true)
    expect(getVisibleSettingsConfigs(orphan).map(config => config.key)).toEqual(['facebook_id'])
  })

  it('handles masters stored as true/false strings', () => {
    const terms = [
      { id: 1, key: 'terms_and_conditions', value: 'true' },
      { id: 2, key: 'terms_and_conditions_url', value: 'https://example.com/terms' }
    ]
    expect(isSettingsConfigVisible(terms[1], terms)).toBe(true)
    expect(isSettingsConfigVisible(terms[1], [{ ...terms[0], value: 'false' }, terms[1]])).toBe(false)
  })

  it('keeps the focus key when the field is visible', () => {
    expect(resolveSettingsFocusKey('facebook_id', facebookOn)).toBe('facebook_id')
    expect(resolveSettingsFocusKey('facebook_login_enabled', facebookOff)).toBe('facebook_login_enabled')
    expect(resolveSettingsFocusKey('unknown_key', facebookOff)).toBe('unknown_key')
    expect(resolveSettingsFocusKey('', facebookOff)).toBe('')
  })

  it('redirects the focus to the master when the field is hidden', () => {
    expect(resolveSettingsFocusKey('facebook_secret', facebookOff)).toBe('facebook_login_enabled')
    const sandboxOn = [
      { id: 1, key: 'stripe_sandbox', value: '1' },
      { id: 2, key: 'stripe_publishable', value: '' }
    ]
    expect(resolveSettingsFocusKey('stripe_publishable', sandboxOn)).toBe('stripe_sandbox')
  })

  it('keeps every dependency pointing at a key that is not itself', () => {
    Object.entries(SETTINGS_FIELD_DEPENDENCIES).forEach(([dependent, dependency]) => {
      expect(dependency.key).toBeTruthy()
      expect(dependency.key).not.toBe(dependent)
    })
  })

  it('does not list masters that are hidden or excluded from the hub', () => {
    const masters = new Set(Object.values(SETTINGS_FIELD_DEPENDENCIES).map(dependency => dependency.key))
    expect(masters.has('facebook_login')).toBe(false)
    expect(masters.has('security_recaptcha_type')).toBe(false)
  })

  it('detects instructional placeholders stored as values', () => {
    const config = { id: 2, key: 'facebook_id', type: 1, name: 'Facebook Application ID', value: 'Add your Facebook ID' }

    expect(isSettingsCredentialFilled(config)).toBe(false)
    expect(isSettingsCredentialFilled({ ...config, value: 'Facebook Application ID' })).toBe(false)
    expect(isSettingsCredentialFilled({ ...config, value: '1234567890' })).toBe(true)
    expect(isSettingsCredentialFilled({ ...config, value: '' })).toBe(false)
  })

  it('presents instructional stored text as a placeholder with an empty value', () => {
    const placeholder = { key: 'facebook_id', name: 'Facebook Application ID', value: 'Add your Facebook ID' }
    const real = { key: 'facebook_id', name: 'Facebook Application ID', value: '1234567890' }
    const blank = { key: 'facebook_id', name: 'Facebook Application ID', value: '' }

    expect(getSettingsInputPresentation(placeholder)).toEqual({ value: '', placeholder: 'Add your Facebook ID' })
    expect(getSettingsInputPresentation(real)).toEqual({ value: '1234567890', placeholder: 'Facebook Application ID' })
    expect(getSettingsInputPresentation(blank)).toEqual({ value: '', placeholder: 'Facebook Application ID' })
  })
})

describe('settings save dirty check', () => {
  const item = { id: 2, key: 'facebook_id', value: 'ghost-app-id' }

  it('treats only exact String() inequality as dirty', () => {
    expect(isSettingsValueDirty('ghost-app-id', 'ghost-app-id')).toBe(false)
    expect(isSettingsValueDirty('next', 'ghost-app-id')).toBe(true)
    expect(isSettingsValueDirty('ghost-app-id ', 'ghost-app-id')).toBe(true)
    expect(isSettingsValueDirty(1, '1')).toBe(false)
  })

  it('adds a dirty field and drops it when the value matches the snapshot', () => {
    const dirty = mergeSettingsChanges([], item, 'next', 'ghost-app-id')
    expect(dirty).toEqual([{ ...item, value: 'next' }])

    const stillDirty = mergeSettingsChanges(dirty, item, 'later', 'ghost-app-id')
    expect(stillDirty).toEqual([{ ...item, value: 'later' }])

    expect(mergeSettingsChanges(stillDirty, item, 'ghost-app-id', 'ghost-app-id')).toEqual([])
  })
})

describe('getSettingsBlockFocusId', () => {
  it('anchors fields without their own id on their custom block', async () => {
    const { getSettingsBlockFocusId } = await import('../settingsCustomSections')
    expect(getSettingsBlockFocusId('notification_toast')).toMatch(/^settings-block-/)
    expect(getSettingsBlockFocusId('not_a_block_key')).toBe('')
  })
})
