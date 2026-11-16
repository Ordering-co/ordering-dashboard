import { describe, expect, it } from 'vitest'
import {
  SETTINGS_INVERTED_VALUE_KEYS,
  getSettingsSelectOptions,
  getSettingsSwitchModel,
  toggleSettingsJsonArrayValue,
  toggleSettingsPipeValue
} from '../settingsSelectOptions'

// redesign settings B

const t = (_key, fallback) => fallback
// A translator that answers with the key, so a test sees which key the helper asked for.
const tKey = (key) => `<${key}>`

const yesNo = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]
const config = (overrides = {}) => ({ id: 1, key: 'some_flag', type: 2, value: '1', options: yesNo, ...overrides })

describe('getSettingsSelectOptions', () => {
  it('maps the API options to translated, capitalized labels', () => {
    const options = getSettingsSelectOptions({
      config: config({ options: [{ text: 'KILOMETERS_PER_HOUR', value: 'km' }, { text: 'MILES', value: 'mi' }] }),
      t
    })
    expect(options).toEqual([
      { value: 'km', label: 'Kilometers per hour' },
      { value: 'mi', label: 'Miles' }
    ])
  })

  it('asks the dictionary for the upper-case text of each option', () => {
    const options = getSettingsSelectOptions({ config: config(), t: tKey })
    expect(options.map(option => option.label)).toEqual(['<YES>', '<NO>'])
  })

  it('swaps the values by position when the config is inverted, keeping the labels', () => {
    const options = getSettingsSelectOptions({ config: config({ key: SETTINGS_INVERTED_VALUE_KEYS[0] }), t, invertValues: true })
    expect(options).toEqual([
      { value: '0', label: 'Yes' },
      { value: '1', label: 'No' }
    ])
  })

  it('gives terms_and_conditions fixed Yes/No options with true/false values', () => {
    const options = getSettingsSelectOptions({ config: config({ key: 'terms_and_conditions', options: [{ text: 'X', value: 'x' }] }), t })
    expect(options).toEqual([
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ])
  })

  it('adds a Custom option that holds the stored value when the config is customizable', () => {
    const options = getSettingsSelectOptions({ config: config({ customizable: true, value: '45' }), t })
    expect(options).toEqual([
      { value: '1', label: 'Yes' },
      { value: '0', label: 'No' },
      { value: '45', label: 'Custom', custom: true }
    ])
  })

  it('keeps the known order types for the order-type configs, with no addon gate (as main)', () => {
    const orderTypes = config({
      key: 'default_order_type',
      options: [{ text: 'delivery', value: 'delivery' }, { text: 'catering_delivery', value: 'catering_delivery' }, { text: 'reservation', value: 'reservation' }, { text: 'unknown', value: 'unknown' }]
    })
    expect(getSettingsSelectOptions({ config: orderTypes, t }).map(option => option.value)).toEqual(['delivery', 'catering_delivery', 'reservation'])
  })

  it('keeps a currency code in capitals, and capitalizes the other options as before', () => {
    const currency = config({ key: 'stripe_currency', options: [{ text: 'usd', value: 'usd' }, { text: 'MXN', value: 'mxn' }, { text: 'Eur', value: 'eur' }] })
    expect(getSettingsSelectOptions({ config: currency, t }).map(option => option.label)).toEqual(['USD', 'MXN', 'EUR'])
    // a three-letter word of another config is not a currency
    const other = config({ key: 'some_choice', options: [{ text: 'ALL', value: 'all' }, { text: 'OFF', value: 'off' }] })
    expect(getSettingsSelectOptions({ config: other, t }).map(option => option.label)).toEqual(['All', 'Off'])
  })

  it('returns nothing to list when the config has no options', () => {
    expect(getSettingsSelectOptions({ config: config({ options: undefined }), t })).toBeUndefined()
    expect(getSettingsSelectOptions({ config: null, t })).toBeNull()
  })
})

describe('getSettingsSwitchModel (strict rule)', () => {
  it('resolves a Yes/No config whose values are 1/0', () => {
    expect(getSettingsSwitchModel({ config: config({ value: '1' }) })).toEqual({ onValue: '1', offValue: '0', checked: true })
    expect(getSettingsSwitchModel({ config: config({ value: '0' }) })).toEqual({ onValue: '1', offValue: '0', checked: false })
  })

  it('resolves a Yes/No config whose values are true/false', () => {
    const options = [{ text: 'Yes', value: 'true' }, { text: 'No', value: 'false' }]
    expect(getSettingsSwitchModel({ config: config({ options, value: 'true' }) })).toEqual({ onValue: 'true', offValue: 'false', checked: true })
    expect(getSettingsSwitchModel({ config: config({ options, value: 'false' }) })).toEqual({ onValue: 'true', offValue: 'false', checked: false })
  })

  it('finds the on value by text, never by position', () => {
    const options = [{ text: 'NO', value: '1' }, { text: 'YES', value: '0' }]
    expect(getSettingsSwitchModel({ config: config({ options, value: '0' }) })).toEqual({ onValue: '0', offValue: '1', checked: true })
    expect(getSettingsSwitchModel({ config: config({ options, value: '1' }) })).toEqual({ onValue: '0', offValue: '1', checked: false })
  })

  it('ignores case and spaces in the option texts', () => {
    const options = [{ text: ' yEs ', value: '1' }, { text: 'N o', value: '0' }]
    expect(getSettingsSwitchModel({ config: config({ options }) })).toMatchObject({ onValue: '1', offValue: '0' })
  })

  it('works for terms_and_conditions with its fixed true/false options', () => {
    expect(getSettingsSwitchModel({ config: config({ key: 'terms_and_conditions', options: undefined, value: 'true' }) }))
      .toEqual({ onValue: 'true', offValue: 'false', checked: true })
    expect(getSettingsSwitchModel({ config: config({ key: 'terms_and_conditions', options: undefined, value: 'false' }) }))
      .toEqual({ onValue: 'true', offValue: 'false', checked: false })
  })

  it.each([
    ['true/false texts', [{ text: 'true', value: 'true' }, { text: 'false', value: 'false' }], 'true'],
    ['enable/disable texts', [{ text: 'enable', value: '1' }, { text: 'disable', value: '0' }], '1'],
    ['disabled/enabled texts', [{ text: 'disabled', value: '0' }, { text: 'enabled', value: '1' }], '1'],
    ['km/mi texts', [{ text: 'km', value: 'km' }, { text: 'mi', value: 'mi' }], 'km'],
    ['three options', [...yesNo, { text: 'MAYBE', value: '2' }], '1'],
    ['one option', [yesNo[0]], '1'],
    ['two yes texts', [{ text: 'YES', value: '1' }, { text: 'yes', value: '0' }], '1'],
    ['two options with the same value', [{ text: 'YES', value: '1' }, { text: 'NO', value: '1' }], '1']
  ])('is not a switch for %s', (_label, options, value) => {
    expect(getSettingsSwitchModel({ config: config({ options, value }) })).toBeNull()
  })

  it('is not a switch when the stored value is not one of the two option values', () => {
    expect(getSettingsSwitchModel({ config: config({ value: '' }) })).toBeNull()
    expect(getSettingsSwitchModel({ config: config({ value: 'maybe' }) })).toBeNull()
    expect(getSettingsSwitchModel({ config: config({ value: undefined }) })).toBeNull()
  })

  it('is not a switch when the config is customizable, inverted, an order-type list or the country filter', () => {
    expect(getSettingsSwitchModel({ config: config({ customizable: true }) })).toBeNull()
    expect(getSettingsSwitchModel({ config: config({ key: 'business_signup_enabled_default' }), invertValues: true })).toBeNull()
    expect(getSettingsSwitchModel({ config: config({ key: 'default_order_type' }) })).toBeNull()
    expect(getSettingsSwitchModel({ config: config({ key: 'country_autocomplete' }) })).toBeNull()
  })

  it('compares the stored value as text', () => {
    expect(getSettingsSwitchModel({ config: config({ value: 1 }) })).toMatchObject({ checked: true })
    expect(getSettingsSwitchModel({ config: config({ value: 0 }) })).toMatchObject({ checked: false })
  })
})

describe('checkbox value helpers', () => {
  it('adds and removes a pipe-separated value, appending in insertion order', () => {
    expect(toggleSettingsPipeValue('a|b', 'c', true)).toBe('a|b|c')
    expect(toggleSettingsPipeValue('a|b|c', 'b', false)).toBe('a|c')
    expect(toggleSettingsPipeValue('', 'a', true)).toBe('a')
    expect(toggleSettingsPipeValue('a', 'a', false)).toBe('')
  })

  it('does not duplicate a value that is already there, nor fail on one that is not', () => {
    expect(toggleSettingsPipeValue('a|b', 'a', true)).toBe('a|b')
    expect(toggleSettingsPipeValue('a|b', 'z', false)).toBe('a|b')
  })

  it('adds and removes an integer in a JSON array, appending in insertion order', () => {
    expect(toggleSettingsJsonArrayValue('[1,3]', '2', true)).toBe('[1,3,2]')
    expect(toggleSettingsJsonArrayValue('[1,2,3]', '2', false)).toBe('[1,3]')
    expect(toggleSettingsJsonArrayValue('', '5', true)).toBe('[5]')
    expect(toggleSettingsJsonArrayValue('[1]', '1', true)).toBe('[1]')
    expect(toggleSettingsJsonArrayValue('[1]', '9', false)).toBe('[1]')
  })
})
