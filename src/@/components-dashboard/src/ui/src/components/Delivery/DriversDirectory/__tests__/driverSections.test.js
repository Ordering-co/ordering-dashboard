// redesign DL-B3 (decision 1): the sections of the driver panel and the map from main's `?tab=` keys.
import { describe, expect, it } from 'vitest'

import { DRIVER_SECTIONS, LEGACY_TABS, MANAGER_SECTIONS, driverSectionIds, sectionFromTab } from '../driverSections'

describe('driverSections', () => {
  it('lists the seven sections of main in the same order', () => {
    expect(DRIVER_SECTIONS).toEqual(['profile', 'driver_group', 'saved_places', 'schedule', 'logs', 'advanced_logs', 'push_tokens'])
  })

  it('Advanced logs is only for level 0 (as the former drivers menu)', () => {
    const without = ['profile', 'driver_group', 'saved_places', 'schedule', 'logs', 'push_tokens']
    expect(driverSectionIds({ level: 0 })).toEqual(DRIVER_SECTIONS)
    for (const level of [1, 2, 5, undefined, null, '0']) {
      expect(driverSectionIds({ level })).toEqual(without)
    }
    expect(driverSectionIds()).toEqual(without)
    expect(driverSectionIds({})).toEqual(without)
  })

  // main, the Stripe Connect tab of the driver detail, after Push tokens
  it('Stripe Connect is listed after Push tokens only for a driver admin (level 0) with payouts on', () => {
    expect(driverSectionIds({ level: 0, stripeConnect: true })).toEqual([...DRIVER_SECTIONS, 'stripe_connect'])
    expect(driverSectionIds({ level: 0, role: 'drivers', stripeConnect: true }).at(-1)).toBe('stripe_connect')
    expect(driverSectionIds({ level: 0, stripeConnect: true }).indexOf('stripe_connect'))
      .toBe(driverSectionIds({ level: 0, stripeConnect: true }).indexOf('push_tokens') + 1)
  })

  it('Stripe Connect is never listed without the flag, for any level, or for a driver manager', () => {
    expect(driverSectionIds({ level: 0 })).toEqual(DRIVER_SECTIONS)
    expect(driverSectionIds({ level: 0, stripeConnect: false })).toEqual(DRIVER_SECTIONS)
    for (const level of [1, 2, 5, undefined, null, '0']) {
      expect(driverSectionIds({ level, stripeConnect: true })).not.toContain('stripe_connect')
    }
    for (const level of [0, 2, 5, undefined]) {
      expect(driverSectionIds({ level, role: 'managers', stripeConnect: true })).toEqual(MANAGER_SECTIONS)
    }
  })

  it('keeps DRIVER_SECTIONS as the seven of the nav: Stripe Connect is not URL-only for anyone', () => {
    expect(DRIVER_SECTIONS).not.toContain('stripe_connect')
  })

  it('does not hand out the array it keeps', () => {
    expect(driverSectionIds({ level: 0 })).not.toBe(DRIVER_SECTIONS)
  })
})

describe('sectionFromTab', () => {
  it('a known section passes through', () => {
    for (const id of DRIVER_SECTIONS) expect(sectionFromTab(id)).toBe(id)
  })

  it('?tab=stripe_connect (main\'s key, ) is kept; the panel decides if the user may see it', () => {
    expect(sectionFromTab('stripe_connect')).toBe('stripe_connect')
  })

  it('the URL-only tabs of main stay reachable and are the panel\'s to handle', () => {
    expect(LEGACY_TABS).toEqual(['orders', 'metafields', 'personalization'])
    for (const tab of LEGACY_TABS) expect(sectionFromTab(tab)).toBe(tab)
  })

  it('nothing, an unknown key or a non-string is profile', () => {
    for (const tab of [undefined, null, '', 'nope', 'PROFILE', 'overview', 'wallet', 42, {}, ['logs']]) {
      expect(sectionFromTab(tab)).toBe('profile')
    }
  })

  it('does not read keys of Object.prototype', () => {
    expect(sectionFromTab('constructor')).toBe('profile')
    expect(sectionFromTab('__proto__')).toBe('profile')
  })
})
