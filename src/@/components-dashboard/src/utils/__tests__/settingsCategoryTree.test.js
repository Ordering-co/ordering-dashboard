import { describe, expect, it } from 'vitest'

import {
  buildSettingsCategoriesFetchUrl,
  buildSettingsCategoryLists
} from '../settingsCategoryTree'

const category = ({ id, key, parent = null, rank = 1, configs = [] }) => ({
  id,
  key,
  parent_category_id: parent,
  rank,
  name: key,
  configs
})

describe('buildSettingsCategoriesFetchUrl', () => {
  it('asks for the full catalog in one request', () => {
    expect(buildSettingsCategoriesFetchUrl('https://apiv4.ordering.co/v400/en/demo'))
      .toBe('https://apiv4.ordering.co/v400/en/demo/config_categories?version=v2&orderBy=rank')
  })
})

describe('buildSettingsCategoryLists', () => {
  const catalog = [
    category({ id: 1, key: 'key_basic', parent: null, rank: 1 }),
    category({ id: 2, key: 'key_pro', parent: null, rank: 2 }),
    category({ id: 3, key: 'key_plugin', parent: null, rank: 3 }),
    category({ id: 10, key: 'basic_platform', parent: 1, rank: 2, configs: [{ key: 'front' }] }),
    category({ id: 11, key: 'basic_maps', parent: 1, rank: 1 }),
    category({ id: 12, key: 'google_maps', parent: 11, rank: 1, configs: [{ key: 'google_maps_api_key' }] }),
    category({ id: 20, key: 'email_configs', parent: 2, rank: 1 }),
    category({ id: 30, key: 'plugin_stripe', parent: 3, rank: 1 }),
    category({ id: 40, key: 'store_reservation', parent: null, rank: 1, configs: [{ key: 'addon_reservation' }] })
  ]

  it('builds parent trees and standalone categories from one flat list', () => {
    const lists = buildSettingsCategoryLists({
      categories: catalog,
      parentKeys: ['key_basic', 'key_pro', 'key_plugin', 'key_enterprise'],
      standaloneKeys: ['store_reservation']
    })

    expect(lists.key_enterprise).toEqual([])
    expect(lists.key_basic.map(item => item.key)).toEqual(['basic_maps', 'basic_platform'])
    expect(lists.key_basic[0].children[0].key).toBe('google_maps')
    expect(lists.key_basic[0].children[0].configs).toEqual([{ key: 'google_maps_api_key' }])
    expect(lists.key_pro.map(item => item.key)).toEqual(['email_configs'])
    expect(lists.key_plugin.map(item => item.key)).toEqual(['plugin_stripe'])
    expect(lists.store_reservation).toHaveLength(1)
    expect(lists.store_reservation[0].key).toBe('store_reservation')
  })

  it('accepts string parent ids from the API', () => {
    const lists = buildSettingsCategoryLists({
      categories: [
        category({ id: '1', key: 'key_basic', parent: null }),
        category({ id: '10', key: 'basic_maps', parent: '1' })
      ],
      parentKeys: ['key_basic'],
      standaloneKeys: []
    })
    expect(lists.key_basic.map(item => item.key)).toEqual(['basic_maps'])
  })

  it('does not loop when two categories point at each other', () => {
    const lists = buildSettingsCategoryLists({
      categories: [
        category({ id: 1, key: 'key_basic', parent: null }),
        category({ id: 10, key: 'left', parent: 11 }),
        category({ id: 11, key: 'right', parent: 10 })
      ],
      parentKeys: ['key_basic'],
      standaloneKeys: ['left']
    })
    expect(lists.left[0].children[0].key).toBe('right')
    expect(lists.left[0].children[0].children[0].key).toBe('left')
    expect(lists.left[0].children[0].children[0].children).toEqual([])
  })

  it('returns empty lists when the catalog is empty', () => {
    expect(buildSettingsCategoryLists({
      categories: [],
      parentKeys: ['key_basic'],
      standaloneKeys: ['store_reservation']
    })).toEqual({
      key_basic: [],
      store_reservation: []
    })
  })
})
