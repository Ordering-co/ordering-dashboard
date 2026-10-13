import { describe, expect, it } from 'vitest'

import {
  getSettingsCategoryKeysToFetch,
  getSettingsGuestOrderTypeValues,
  getSettingsOrderTypeValues,
  getSettingsSitesWhere,
  getSettingsStandaloneCategoryKeys,
  shouldHideUpsellingConfig
} from '../settingsAccess'

const planOffConfigs = {
  plan_pro: { value: false },
  plan_enterprise: { value: false }
}

describe('getSettingsOrderTypeValues', () => {
  it('always includes the former pro and enterprise types', () => {
    expect(getSettingsOrderTypeValues()).toEqual([
      'delivery',
      'pickup',
      'eatin',
      'curbside',
      'drivethru',
      'seatdelivery',
      'catering_delivery',
      'catering_pickup',
      'reservation'
    ])
    expect(getSettingsOrderTypeValues({ configs: planOffConfigs })).toEqual(getSettingsOrderTypeValues())
  })

  it('includes catering and reservation without an addon flag', () => {
    expect(getSettingsOrderTypeValues({})).toEqual([
      'delivery',
      'pickup',
      'eatin',
      'curbside',
      'drivethru',
      'seatdelivery',
      'catering_delivery',
      'catering_pickup',
      'reservation'
    ])
  })
})

describe('getSettingsGuestOrderTypeValues', () => {
  it('always includes the former pro and enterprise ids', () => {
    expect(getSettingsGuestOrderTypeValues()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(getSettingsGuestOrderTypeValues({ configs: planOffConfigs })).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })
})

describe('shouldHideUpsellingConfig', () => {
  it('does not hide upselling with plan or PostHog gates', () => {
    expect(shouldHideUpsellingConfig()).toBe(false)
    expect(shouldHideUpsellingConfig({ configs: {} })).toBe(false)
  })
})

describe('getSettingsSitesWhere', () => {
  it('does not plan-filter sites', () => {
    expect(getSettingsSitesWhere()).toBe(null)
  })
})

describe('getSettingsCategoryKeysToFetch', () => {
  it('always fetches every parent key, including addons', () => {
    const expected = [
      { key: 'key_basic', enabled: true },
      { key: 'key_pro', enabled: true },
      { key: 'key_enterprise', enabled: true },
      { key: 'key_plugin', enabled: true },
      { key: 'key_addon', enabled: true }
    ]
    expect(getSettingsCategoryKeysToFetch()).toEqual(expected)
    expect(getSettingsCategoryKeysToFetch({ configs: planOffConfigs })).toEqual(expected)
  })
})

describe('getSettingsStandaloneCategoryKeys', () => {
  it('returns a copy of the standalone category keys', () => {
    const keys = getSettingsStandaloneCategoryKeys()
    expect(keys).toEqual(['store_reservation'])
    keys.push('mutated')
    expect(getSettingsStandaloneCategoryKeys()).toEqual(['store_reservation'])
  })
})
