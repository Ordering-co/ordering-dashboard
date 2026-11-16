// redesign settings-logs (; M-SL3): a stored value of a setting, named as the Settings hub names it.
import { describe, expect, it } from 'vitest'

import { describeSettingValue } from '../settingsLogValue'
import { getSettingsSelectOptions } from '../settingsSelectOptions'

const t = (key, fallback) => fallback ?? key

const YES_NO = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]

describe('describeSettingValue · nothing to say', () => {
  it('is null for null, undefined and an empty string (the caller says «None»)', () => {
    const config = { key: 'facebook_login_enabled', type: 2, options: YES_NO }
    expect(describeSettingValue({ config, value: null, t })).toBeNull()
    expect(describeSettingValue({ config, value: undefined, t })).toBeNull()
    expect(describeSettingValue({ config, value: '', t })).toBeNull()
  })

  it('is null for an object or an array (not a stored value of a setting)', () => {
    const config = { key: 'x', type: 2, options: YES_NO }
    expect(describeSettingValue({ config, value: { a: 1 }, t })).toBeNull()
    expect(describeSettingValue({ config, value: ['1'], t })).toBeNull()
  })

  it('keeps 0 as a value, not as nothing', () => {
    expect(describeSettingValue({ config: { key: 'x', type: 2, options: YES_NO }, value: 0, t })).toBe('No')
  })

  it('is the stored text when there is no config, or the config has no options', () => {
    expect(describeSettingValue({ value: '1', t })).toBe('1')
    expect(describeSettingValue({ config: null, value: 5, t })).toBe('5')
    expect(describeSettingValue({ config: { key: 'x', type: 2 }, value: '1', t })).toBe('1')
    expect(describeSettingValue({ config: { key: 'x', type: 2, options: [] }, value: '1', t })).toBe('1')
    expect(describeSettingValue({ config: { key: 'x', type: 2, options: 'nope' }, value: '1', t })).toBe('1')
  })
})

describe('describeSettingValue · type 2 (a choice)', () => {
  const config = { key: 'facebook_login_enabled', type: 2, options: YES_NO }

  it('names a yes/no value as the hub does', () => {
    expect(describeSettingValue({ config, value: '1', t })).toBe('Yes')
    expect(describeSettingValue({ config, value: '0', t })).toBe('No')
    // the same label the hub's select gives that value
    const hub = getSettingsSelectOptions({ config, t })
    expect(describeSettingValue({ config, value: '1', t })).toBe(hub.find(option => option.value === '1').label)
    expect(describeSettingValue({ config, value: '0', t })).toBe(hub.find(option => option.value === '0').label)
  })

  it('translates the labels through t, as the hub does', () => {
    const translate = (key, fallback) => (key === 'YES' ? 'Sí' : fallback)
    expect(describeSettingValue({ config, value: '1', t: translate })).toBe('Sí')
    expect(describeSettingValue({ config, value: '0', t: translate })).toBe('No')
  })

  it('reads a value that no option names as stored', () => {
    expect(describeSettingValue({ config, value: '7', t })).toBe('7')
    expect(describeSettingValue({ config, value: 'maybe', t })).toBe('maybe')
  })

  it('uses the hub inversion for an inverted key: «1» does not read as in the plain case', () => {
    const inverted = { key: 'business_signup_enabled_default', type: 2, options: YES_NO }
    const plain = { ...inverted, key: 'some_plain_key' }
    const hub = getSettingsSelectOptions({ config: { ...inverted, customizable: false }, t, invertValues: true })

    for (const value of ['1', '0']) {
      expect(describeSettingValue({ config: inverted, value, t })).toBe(hub.find(option => option.value === value).label)
    }
    expect(describeSettingValue({ config: plain, value: '1', t })).toBe('Yes')
    expect(describeSettingValue({ config: inverted, value: '1', t })).not.toBe(describeSettingValue({ config: plain, value: '1', t }))
    expect(describeSettingValue({ config: inverted, value: '0', t })).not.toBe(describeSettingValue({ config: plain, value: '0', t }))
  })

  it('applies the inversion to driver_signup_enabled_default too', () => {
    const inverted = { key: 'driver_signup_enabled_default', type: 2, options: YES_NO }
    expect(describeSettingValue({ config: inverted, value: '1', t })).toBe('No')
    expect(describeSettingValue({ config: inverted, value: '0', t })).toBe('Yes')
  })

  it('keeps the stored value for an inverted key that has not exactly two options', () => {
    const three = {
      key: 'business_signup_enabled_default',
      type: 2,
      options: [...YES_NO, { text: 'MAYBE', value: '2' }]
    }
    expect(describeSettingValue({ config: three, value: '1', t })).toBe('1')
    expect(describeSettingValue({ config: three, value: '2', t })).toBe('2')
    const one = { key: 'driver_signup_enabled_default', type: 2, options: [YES_NO[0]] }
    expect(describeSettingValue({ config: one, value: '1', t })).toBe('1')
  })

  it('never reads «Custom» for a customizable setting: its current value is the option label or the stored text', () => {
    const named = { key: 'x', type: 2, customizable: true, value: '1', options: YES_NO }
    expect(describeSettingValue({ config: named, value: '1', t })).toBe('Yes')
    const free = { key: 'x', type: 2, customizable: true, value: '45', options: YES_NO }
    expect(describeSettingValue({ config: free, value: '45', t })).toBe('45')
    expect(describeSettingValue({ config: free, value: '45', t })).not.toBe('Custom')
    // the caller's config is not touched
    expect(free.customizable).toBe(true)
  })
})

// redesign (owner decision 32 A; review finding 1): the hub reads a «Disable X» as «X» with its Yes/No swapped, but
// the log names the setting as the API does («Disabled rewards»), so its value must read as stored: «1» is Yes, not No
describe('describeSettingValue · «Disable X» settings the hub names positively', () => {
  it.each(['disabled_rewards', 'disable_delivery_priority', 'disable_companies_order_details', 'multi_business_checkout_remove_individual_buttons'])(
    '%s reads its stored Yes as Yes, beside its API name',
    (key) => {
      const config = { key, type: 2, options: YES_NO }
      expect(describeSettingValue({ config, value: '1', t })).toBe('Yes')
      expect(describeSettingValue({ config, value: '0', t })).toBe('No')
    }
  )
})

describe('describeSettingValue · currency codes', () => {
  it('names a currency in capitals, not «Usd»', () => {
    const config = { key: 'stripe_currency', type: 2, options: [{ text: 'usd', value: 'usd' }, { text: 'mxn', value: 'mxn' }] }
    expect(describeSettingValue({ config, value: 'usd', t })).toBe('USD')
    expect(describeSettingValue({ config, value: 'mxn', t })).toBe('MXN')
  })
})

describe('describeSettingValue · type 3 (a|b|c)', () => {
  const options = [
    { text: 'ID', value: 'id' },
    { text: 'BUSINESS', value: 'business' },
    { text: 'DRIVER', value: 'driver' }
  ]
  const config = { key: 'filter_order_options', type: 3, options }

  it('names each part by its option, driver included, as the hub checkboxes do', () => {
    expect(describeSettingValue({ config, value: 'id|business|driver', t })).toBe('id, business, driver')
  })

  it('writes each label by the hub rule: t(TEXT.toUpperCase(), text with spaces, lower case)', () => {
    const named = {
      key: 'x',
      type: 3,
      options: [{ text: 'Delivery_Time', value: 'delivery' }, { text: 'BUSINESS', value: 'business' }]
    }
    const translate = (key, fallback) => (key === 'BUSINESS' ? 'Negocio' : fallback)
    expect(describeSettingValue({ config: named, value: 'delivery|business', t })).toBe('delivery time, business')
    expect(describeSettingValue({ config: named, value: 'delivery|business', t: translate })).toBe('delivery time, Negocio')
  })

  it('keeps a part that no option names as stored', () => {
    expect(describeSettingValue({ config, value: 'id|gone|driver', t })).toBe('id, gone, driver')
    expect(describeSettingValue({ config, value: 'gone', t })).toBe('gone')
  })
})

describe('describeSettingValue · type 4 (a JSON list of ids)', () => {
  const options = [{ text: 'A', value: '1' }, { text: 'B', value: 2 }]
  const config = { key: 'some_list', type: 4, options }

  it('names each id by its option text, whether the option value is a string or a number', () => {
    expect(describeSettingValue({ config, value: '[1,2]', t })).toBe('A, B')
    expect(describeSettingValue({ config, value: '["1","2"]', t })).toBe('A, B')
  })

  it('keeps an id that no option names, and the raw text when the list cannot be read', () => {
    expect(describeSettingValue({ config, value: '[1,9]', t })).toBe('A, 9')
    expect(describeSettingValue({ config, value: 'not a list', t })).toBe('not a list')
    expect(describeSettingValue({ config, value: '[]', t })).toBe('[]')
  })

  it('leaves driver_tip_options as stored', () => {
    const tips = { key: 'driver_tip_options', type: 4, options }
    expect(describeSettingValue({ config: tips, value: '[1,2]', t })).toBe('[1,2]')
  })
})

describe('describeSettingValue · other types', () => {
  it('leaves type 1 (free text) and type 5 as stored', () => {
    const options = [{ text: 'A', value: '1' }]
    expect(describeSettingValue({ config: { key: 'x', type: 1, options }, value: '1', t })).toBe('1')
    expect(describeSettingValue({ config: { key: 'x', type: 5, options }, value: '1', t })).toBe('1')
    expect(describeSettingValue({ config: { key: 'x', type: 1 }, value: 'hello', t })).toBe('hello')
  })
})

// review R1 H4: «Export Push Notifications in Reports» (type 2) has four options that all say "0": a label picked from them would be a
// guess, so the stored value is shown
describe('describeSettingValue · options that share a value', () => {
  const t = (_key, fallback) => fallback
  const config = {
    key: 'export_push_notifications_reports',
    type: 2,
    options: [
      { text: 'ADMINISTRATOR', value: '0' },
      { text: 'BUSINESS_OWNER', value: '0' },
      { text: 'DRIVER', value: '0' },
      { text: 'CUSTOMER', value: '0' }
    ]
  }
  it('is the stored value when more than one option has it (type 2)', () => {
    expect(describeSettingValue({ config, value: '0', t })).toBe('0')
  })
  it('is the stored value of a pipe part that more than one option has (type 3)', () => {
    const pipe = { key: 'x', type: 3, options: [{ text: 'ALPHA', value: 'a' }, { text: 'BETA', value: 'a' }, { text: 'GAMMA', value: 'c' }] }
    expect(describeSettingValue({ config: pipe, value: 'a|c', t })).toBe('a, gamma')
  })
})
