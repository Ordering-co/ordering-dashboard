import { describe, expect, it } from 'vitest'

import {
  SETTINGS_HUB_PATH,
  SETTINGS_LEGACY_REDIRECTS,
  buildSettingsPath,
  getSettingsRedirectPath,
  isSettingsHubPath
} from '../settingsRedirects'

describe('buildSettingsPath', () => {
  it('builds the hub path with optional query params', () => {
    expect(buildSettingsPath()).toBe('/settings')
    expect(buildSettingsPath({ group: 'orders' })).toBe('/settings?group=orders')
    expect(buildSettingsPath({ group: 'orders', category: 'addon_catering', q: 'tip' }))
      .toBe('/settings?group=orders&category=addon_catering&q=tip')
    expect(buildSettingsPath({ group: 'developers', category: 'developers', id: 'plugins' }))
      .toBe('/settings?group=developers&category=developers&id=plugins')
    expect(buildSettingsPath({
      group: 'drivers',
      category: 'enterprise_delivery_driver_assignment_and_scheduling',
      focus: 'allow_driver_reject_order'
    })).toBe('/settings?group=drivers&category=enterprise_delivery_driver_assignment_and_scheduling&focus=allow_driver_reject_order')
    expect(buildSettingsPath({ view: 'tasks' })).toBe('/settings?view=tasks')
  })
})

describe('getSettingsRedirectPath', () => {
  it('maps every legacy path to the hub', () => {
    Object.keys(SETTINGS_LEGACY_REDIRECTS).forEach(path => {
      const target = getSettingsRedirectPath(path)
      expect(target.startsWith(SETTINGS_HUB_PATH)).toBe(true)
    })
    expect(getSettingsRedirectPath('/all-settings')).toBe('/settings')
    expect(getSettingsRedirectPath('/settings/language')).toBe('/settings?group=languages&category=language_manager')
    expect(getSettingsRedirectPath('/catering')).toBe('/settings?group=orders&category=addon_catering')
    expect(getSettingsRedirectPath('/loyalty/rewards-programs')).toBe('/settings?group=payments&category=addon_points_and_levels')
    expect(getSettingsRedirectPath('/settings/logs')).toBeNull()
  })

  it('keeps an incoming category or group from the old URL', () => {
    expect(getSettingsRedirectPath('/all-settings', '?category=user_information'))
      .toBe('/settings?category=user_information')
    expect(getSettingsRedirectPath('/settings/basic', '?category=12'))
      .toBe('/settings?group=platform&category=12')
  })
})

describe('isSettingsHubPath', () => {
  it('matches only the hub path', () => {
    expect(isSettingsHubPath('/settings')).toBe(true)
    expect(isSettingsHubPath('/settings/logs')).toBe(false)
    expect(isSettingsHubPath('/all-settings')).toBe(false)
  })
})
