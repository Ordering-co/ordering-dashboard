import { describe, expect, it } from 'vitest'

import {
  credentialsComplete,
  groupOf,
  pluginConfigs,
  providerName,
  providerStatus,
  statusFamily,
  statusLabel,
  storesCount
} from '../providerData'
import { STATUS_FAMILIES } from '../../../Shared/Product'

// redesign DS-B2 (decision 6 | M-DS1, M-DS5): what the providers list reads from a company (`driver_companies` row) and from the
// configs dictionary the app already loaded (`useConfig()` → `configState.configs`: one object per key, `{ id?, key, value }`).
const t = (_key, fallback) => fallback

const uberGroup = { id: 100, enabled: true }
const uber = { id: 34, name: 'Uber Direct', enabled: true, plugin_id: 364, plugin: { id: 364, key: 'uber_direct_integration' }, driver_groups: [uberGroup] }

// The dictionary as ConfigContext gives it: rows with a numeric id come from the API; the ones without come from the app's
// own defaults (`customConfigs`) and never belong to a plugin.
const dictionary = (overrides = {}) => ({
  max_days_preorder: { key: 'max_days_preorder', value: 6 },
  uber_direct_integration_client_id: { id: 11, key: 'uber_direct_integration_client_id', value: 'abc' },
  uber_direct_integration_client_secret: { id: 12, key: 'uber_direct_integration_client_secret', value: 'xyz' },
  doordash_drive_integration_developer_id: { id: 21, key: 'doordash_drive_integration_developer_id', value: '' },
  ...overrides
})

describe('groupOf', () => {
  it('is the first driver group of the company, or null', () => {
    expect(groupOf(uber)).toBe(uberGroup)
    expect(groupOf({ driver_groups: [] })).toBeNull()
    expect(groupOf({})).toBeNull()
    expect(groupOf(null)).toBeNull()
    expect(groupOf(undefined)).toBeNull()
  })
})

describe('providerName', () => {
  it('cleans the name and falls back to «#id» for a nameless company', () => {
    expect(providerName({ id: 3, name: '  Uber   Direct ' })).toBe('Uber Direct')
    expect(providerName({ id: 3, name: '' })).toBe('#3')
    expect(providerName({ id: 3 })).toBe('#3')
  })
})

describe('pluginConfigs', () => {
  it('picks the dictionary values with a numeric id whose key contains the plugin key (the selection of getPluginInformation)', () => {
    const picked = pluginConfigs(dictionary(), 'uber_direct_integration')
    expect(picked.map(config => config.key)).toEqual(['uber_direct_integration_client_id', 'uber_direct_integration_client_secret'])
  })

  it('ignores the rows without a numeric id, even if their key matches (the app defaults)', () => {
    const configs = {
      uber_direct_integration_x: { key: 'uber_direct_integration_x', value: '' },
      uber_direct_integration_y: { id: '7', key: 'uber_direct_integration_y', value: '' },
      uber_direct_integration_z: { id: 8, key: 'uber_direct_integration_z', value: '' }
    }
    expect(pluginConfigs(configs, 'uber_direct_integration').map(config => config.id)).toEqual([8])
  })

  it('matches as an ilike %key% does: anywhere in the key and ignoring case', () => {
    const configs = { a: { id: 1, key: 'X_UBER_Direct_Y', value: '' }, b: { id: 2, key: 'doordash', value: '' } }
    expect(pluginConfigs(configs, 'uber_direct').map(config => config.id)).toEqual([1])
  })

  it('is empty without a plugin key, a dictionary, or matching keys; it tolerates null entries', () => {
    expect(pluginConfigs(dictionary(), '')).toEqual([])
    expect(pluginConfigs(dictionary(), undefined)).toEqual([])
    expect(pluginConfigs(dictionary(), null)).toEqual([])
    expect(pluginConfigs(undefined, 'uber')).toEqual([])
    expect(pluginConfigs(null, 'uber')).toEqual([])
    expect(pluginConfigs({}, 'uber')).toEqual([])
    expect(pluginConfigs({ a: null, b: { id: 1, key: 'uber', value: 'x' } }, 'uber')).toHaveLength(1)
    expect(pluginConfigs(dictionary(), 'lalamove')).toEqual([])
  })
})

describe('credentialsComplete', () => {
  it('is true when every visible config has a value', () => {
    expect(credentialsComplete(pluginConfigs(dictionary(), 'uber_direct_integration'))).toBe(true)
  })

  it('is false with one visible config empty', () => {
    const configs = pluginConfigs(dictionary({ uber_direct_integration_client_secret: { id: 12, key: 'uber_direct_integration_client_secret', value: '' } }), 'uber_direct_integration')
    expect(credentialsComplete(configs)).toBe(false)
  })

  it('with no configs it is true, as main (nothing to fill)', () => {
    expect(credentialsComplete([])).toBe(true)
    expect(credentialsComplete(undefined)).toBe(true)
    expect(credentialsComplete(null)).toBe(true)
  })

  // main compares with `!== ''`: a null (or 0) is a value that was stored
  it('only the empty string is a missing value', () => {
    expect(credentialsComplete([{ id: 1, key: 'a', value: null }, { id: 2, key: 'b', value: 0 }, { id: 3, key: 'c', value: false }])).toBe(true)
    expect(credentialsComplete([{ id: 1, key: 'a', value: ' ' }])).toBe(true)
  })

  // The Settings hub hides a field whose master is off: it cannot be filled, so it cannot hold the provider back.
  // (Stand-in plugin: the dependency table of settingsCustomSections knows the facebook pair; none of the delivery plugins.)
  it('an empty config hidden by its master does not count; a visible empty one does', () => {
    const off = [
      { id: 1, key: 'facebook_login_enabled', value: '0' },
      { id: 2, key: 'facebook_id', value: '' },
      { id: 3, key: 'facebook_secret', value: '' }
    ]
    expect(credentialsComplete(off)).toBe(true)
    const on = off.map(config => (config.key === 'facebook_login_enabled' ? { ...config, value: '1' } : config))
    expect(credentialsComplete(on)).toBe(false)
  })
})

describe('providerStatus', () => {
  const configs = dictionary()

  it('no plugin_id: not installed, whatever else the company has', () => {
    expect(providerStatus({ ...uber, plugin_id: null }, { configs })).toBe('not_installed')
    expect(providerStatus({ id: 1, plugin_id: undefined, driver_groups: [] }, { configs })).toBe('not_installed')
    expect(providerStatus({ ...uber, plugin_id: null, driver_groups: [] }, { configs })).toBe('not_installed')
  })

  it('installed with no group: group missing (before the credentials are looked at)', () => {
    expect(providerStatus({ ...uber, driver_groups: [] }, { configs })).toBe('group_missing')
    expect(providerStatus({ ...uber, driver_groups: undefined }, { configs: dictionary({ uber_direct_integration_client_id: { id: 11, key: 'uber_direct_integration_client_id', value: '' } }) })).toBe('group_missing')
  })

  it('with a visible credential empty: credentials incomplete', () => {
    const incomplete = dictionary({ uber_direct_integration_client_id: { id: 11, key: 'uber_direct_integration_client_id', value: '' } })
    expect(providerStatus(uber, { configs: incomplete })).toBe('credentials_incomplete')
    // a paused provider with incomplete credentials still reads as incomplete: it is what stops it from working
    expect(providerStatus({ ...uber, enabled: false }, { configs: incomplete })).toBe('credentials_incomplete')
  })

  it('an empty credential of ANOTHER plugin does not count', () => {
    expect(providerStatus(uber, { configs })).toBe('active') // doordash_drive_integration_developer_id is empty in the dictionary
  })

  it('complete: active when enabled, paused when not', () => {
    expect(providerStatus(uber, { configs })).toBe('active')
    expect(providerStatus({ ...uber, enabled: false }, { configs })).toBe('paused')
    expect(providerStatus({ ...uber, enabled: undefined }, { configs })).toBe('paused')
  })

  it('without a dictionary or options it does not throw: no configs means nothing to fill (as main)', () => {
    expect(providerStatus(uber, {})).toBe('active')
    expect(providerStatus(uber)).toBe('active')
    expect(providerStatus(uber, { configs: {} })).toBe('active')
  })

  it('a company with no plugin object but with plugin_id has no configs to check', () => {
    expect(providerStatus({ ...uber, plugin: null }, { configs: dictionary() })).toBe('active')
  })
})

describe('statusLabel and statusFamily', () => {
  const STATUSES = ['not_installed', 'group_missing', 'credentials_incomplete', 'active', 'paused']

  it('says the five words of decision 6, with their keys', () => {
    const keys = {}
    const spy = (key, fallback) => { keys[fallback] = key; return fallback }
    expect(STATUSES.map(status => statusLabel(status, spy))).toEqual(['Not installed', 'Group missing', 'Credentials incomplete', 'Active', 'Paused'])
    // «Active» is the catalog's own (ACTIVE); the rest are this page's
    expect(keys).toEqual({
      'Not installed': 'DELIVERY_SERVICES_STATUS_NOT_INSTALLED',
      'Group missing': 'DELIVERY_SERVICES_STATUS_GROUP_MISSING',
      'Credentials incomplete': 'DELIVERY_SERVICES_STATUS_CREDENTIALS_INCOMPLETE',
      Active: 'ACTIVE',
      Paused: 'DELIVERY_SERVICES_STATUS_PAUSED'
    })
  })

  it('maps each status to a family Product/Status knows', () => {
    expect(STATUSES.map(statusFamily)).toEqual(['pending', 'review', 'review', 'done', 'cancel'])
    STATUSES.forEach(status => expect(STATUS_FAMILIES).toContain(statusFamily(status)))
  })

  it('an unknown status is a throw, not a silent default', () => {
    expect(() => statusLabel('nope', t)).toThrow()
    expect(() => statusFamily('nope')).toThrow()
  })
})

describe('storesCount', () => {
  const info = (groups) => ({ loading: false, error: null, groups })

  it('is the length of the business list the one request returned for the company group', () => {
    expect(storesCount(uber, info({ 100: { id: 100, business: [{ id: 1 }, { id: 2 }, { id: 3 }], enabled: true } }))).toBe(3)
    expect(storesCount(uber, info({ 100: { id: 100, business: [], enabled: true } }))).toBe(0)
  })

  it('is null when it cannot say: no group, no info, the group is not in the answer, or business is not a list', () => {
    expect(storesCount({ ...uber, driver_groups: [] }, info({ 100: { business: [{}] } }))).toBeNull()
    expect(storesCount(uber, undefined)).toBeNull()
    expect(storesCount(uber, { loading: true })).toBeNull()
    expect(storesCount(uber, info({}))).toBeNull()
    expect(storesCount(uber, info({ 7: { business: [{}] } }))).toBeNull()
    expect(storesCount(uber, info({ 100: { id: 100 } }))).toBeNull()
    expect(storesCount(uber, info({ 100: { business: 'x' } }))).toBeNull()
  })
})
