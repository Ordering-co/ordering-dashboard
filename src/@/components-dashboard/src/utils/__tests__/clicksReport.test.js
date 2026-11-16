import { describe, expect, it } from 'vitest'
import { toCsv } from '../businessReports'
import { normalizeTimezone } from '../index'
import {
  CLICK_TYPES,
  buildClicksParams,
  clickRows,
  clicksCsv,
  clicksFileName,
  clicksFilters,
  clicksTotal,
  shownClickTypes
} from '../clicksReport'

// redesign ecommerce FC (D5, D7, D8): the data of the clicks report

const defaultT = (_key, fallback) => fallback

/**
 * `EcommerceAnalitycs.paramsForAPI` of main (components/EcommerceAnalitycs/index.js:36-46), copied as the
 * reference. `filterList` is the shape of main: `from`/`to` already carry the time of day.
 */
const mainParams = (filterList) => {
  let params = `timezone=${normalizeTimezone(filterList?.timeZone)}`
  if (filterList?.from) params = `${params}&from=${filterList?.from}`
  if (filterList?.to) params = `${params}&to=${filterList?.to}`
  if (filterList?.userIds) params = `${params}&drivers=${filterList?.userIds?.toString()}`
  if (filterList?.businessIds && filterList?.businessIds.length > 0) params = `${params}&businesses=${filterList?.businessIds?.toString()}`
  if (filterList?.app_id && filterList.app_id !== 'all') params = `${params}&app_id=${filterList?.app_id}`
  if (filterList?.driver_groups_ids) params = `${params}&driver_groups_ids=${JSON.stringify(filterList?.driver_groups_ids)}`
  if (filterList?.franchises_id) params = `${params}&franchises_id=${JSON.stringify(filterList?.franchises_id)}`
  return params
}

// What the controller of main would hold for the same page filters (from/to as the calendar writes them)
const asMain = ({ from, to, ...rest }) => ({
  from: from ? `${from} 00:00:00` : null,
  to: to ? `${to} 23:59:59` : null,
  userIds: null,
  driver_groups_ids: null,
  franchises_id: null,
  businessIds: null,
  app_id: 'all',
  ...rest
})

describe('CLICK_TYPES', () => {
  it('has the keys of the API in the order of main', () => {
    expect(CLICK_TYPES).toEqual(['Business', 'Product', 'Category'])
  })
})

describe('buildClicksParams', () => {
  const CASES = [
    {
      name: 'period and zone only',
      filters: { from: '2026-10-03', to: '2026-10-10', timeZone: 'America/Mexico_City' }
    },
    {
      name: 'brand and channel',
      filters: { from: '2026-10-03', to: '2026-10-10', timeZone: 'Europe/Madrid', franchises_id: [4, 7], app_id: 12 }
    },
    {
      name: 'stores from the country, channel all, renamed zone',
      filters: { from: '2026-10-10', to: '2026-10-10', timeZone: 'Europe/Kiev', businessIds: [3, 1, 2], app_id: 'all' }
    },
    {
      name: 'everything at once',
      filters: { from: '2026-09-01', to: '2026-09-30', timeZone: 'America/Bogota', businessIds: [9], app_id: 5, franchises_id: [1] }
    },
    {
      name: 'no period, empty stores',
      filters: { from: '', to: '', timeZone: 'America/Bogota', businessIds: [], franchises_id: null }
    }
  ]

  CASES.forEach(({ name, filters }) => {
    it(`is the string of main: ${name}`, () => {
      expect(buildClicksParams(filters)).toBe(mainParams(asMain(filters)))
    })
  })

  it('writes the parts in the order of main', () => {
    expect(buildClicksParams({
      from: '2026-10-03',
      to: '2026-10-10',
      timeZone: 'America/Bogota',
      businessIds: [9, 8],
      app_id: 5,
      franchises_id: [1, 2]
    })).toBe(
      'timezone=America/Bogota&from=2026-10-03 00:00:00&to=2026-10-10 23:59:59' +
      '&businesses=9,8&app_id=5&franchises_id=[1,2]'
    )
  })

  it('never sends drivers or driver groups', () => {
    const params = buildClicksParams({
      from: '2026-10-03',
      to: '2026-10-10',
      timeZone: 'America/Bogota',
      drivers_ids: [1],
      userIds: [1],
      driver_groups_ids: [2]
    })
    expect(params).not.toContain('drivers')
    expect(params).not.toContain('driver_groups_ids')
  })

  it('does not fail without filters', () => {
    expect(() => buildClicksParams()).not.toThrow()
  })

  //
  it('ends with the country of the stores when there is one', () => {
    expect(buildClicksParams({ from: '2026-10-03', to: '2026-10-10', timeZone: 'America/Bogota', country_code: 'US' }))
      .toBe('timezone=America/Bogota&from=2026-10-03 00:00:00&to=2026-10-10 23:59:59&country_code=US')
    expect(buildClicksParams({ timeZone: 'America/Bogota', country_code: '' })).not.toContain('country')
    // countries.code is free text: it travels encoded
    expect(buildClicksParams({ timeZone: 'America/Bogota', country_code: 'A&B=C D' })).toBe('timezone=America/Bogota&country_code=A%26B%3DC%20D')
  })
})

describe('clicksFilters', () => {
  it('keeps the filters of this report and drops the stores of the other reports (D5)', () => {
    expect(clicksFilters({
      from: '2026-10-03',
      to: '2026-10-10',
      timeZone: 'America/Bogota',
      franchises_id: [4],
      app_id: 'all',
      businessIds: [1, 2],
      drivers_ids: [7],
      driver_groups_ids: [3]
    })).toEqual({
      from: '2026-10-03',
      to: '2026-10-10',
      timeZone: 'America/Bogota',
      franchises_id: [4],
      app_id: 'all',
      businessIds: null
    })
  })

  // the country travels only when the page has one chosen
  it('carries the country it is given, and none without it', () => {
    expect(clicksFilters({ from: '2026-10-03' }, 'US')).toMatchObject({ country_code: 'US' })
    expect(clicksFilters({ from: '2026-10-03' })).not.toHaveProperty('country_code')
    expect(clicksFilters({ from: '2026-10-03' }, '')).not.toHaveProperty('country_code')
  })
})

// (option B): no client records clicks on categories yet
describe('shownClickTypes', () => {
  it('leaves Category out while it has no rows, and keeps it once it has', () => {
    expect(shownClickTypes({ Business: [], Product: [], Category: [] })).toEqual(['Business', 'Product'])
    expect(shownClickTypes({ Business: [], Product: [], Category: [{ id: 1, name: 'Drinks', value: 2 }] })).toEqual(CLICK_TYPES)
    expect(shownClickTypes({})).toEqual(['Business', 'Product'])
  })
})

describe('clickRows', () => {
  const data = {
    click: {
      Business: [
        { object_id: 11, name: 'A', total: '3' },
        { object_id: 12, name: 'B', total: 10 },
        { object_id: 13, name: 'C', total: '3' },
        { name: 'D', total: 'x' }
      ]
    }
  }

  it('sorts by total descending, stable on ties, and normalizes the rows', () => {
    expect(clickRows(data, 'Business')).toEqual([
      { id: 12, name: 'B', value: 10 },
      { id: 11, name: 'A', value: 3 },
      { id: 13, name: 'C', value: 3 },
      { id: 3, name: 'D', value: 0 }
    ])
  })

  it('returns a copy and leaves the answer as it came', () => {
    const before = JSON.stringify(data)
    const rows = clickRows(data, 'Business')
    rows.reverse()
    expect(JSON.stringify(data)).toBe(before)
    expect(clickRows(data, 'Business')).not.toBe(rows)
  })

  it('returns [] without the key, with empty data or with an array', () => {
    expect(clickRows(data, 'Category')).toEqual([])
    expect(clickRows({ click: {} }, 'Business')).toEqual([])
    expect(clickRows({}, 'Business')).toEqual([])
    expect(clickRows([], 'Business')).toEqual([])
    expect(clickRows(null, 'Business')).toEqual([])
    expect(clickRows(undefined, 'Business')).toEqual([])
    expect(clickRows({ click: { Business: null } }, 'Business')).toEqual([])
  })

  it('keeps repeated names as separate rows with their own id', () => {
    const rows = clickRows({ click: { Product: [{ object_id: 1, name: 'Cola', total: 2 }, { object_id: 2, name: 'Cola', total: 5 }] } }, 'Product')
    expect(rows.map(row => row.id)).toEqual([2, 1])
  })
})

describe('clicksTotal', () => {
  it('adds the values', () => {
    expect(clicksTotal([{ value: 2 }, { value: 5 }, { value: 0 }])).toBe(7)
    expect(clicksTotal([])).toBe(0)
  })
})

describe('clicksCsv', () => {
  it('uses the literal header of main and the rows name/value', () => {
    const rows = [{ id: 1, name: 'Cafe, Centro', value: 4 }, { id: 2, name: 'Bar', value: 1 }]
    expect(clicksCsv('Business', rows, defaultT)).toBe(
      toCsv(['CLICKS OF BUSINESS', 'Clicks'], [['Cafe, Centro', 4], ['Bar', 1]])
    )
    expect(clicksCsv('Business', rows, defaultT)).toBe('CLICKS OF BUSINESS, Clicks\n"Cafe, Centro",4,\nBar,1,\n')
  })

  it('does not translate the header but does translate the column', () => {
    const t = (key, fallback) => (key === 'CLICKS' ? 'Clics' : fallback)
    expect(clicksCsv('Product', [], t)).toBe('CLICKS OF PRODUCT, Clics\n')
  })
})

describe('clicksFileName', () => {
  it('builds clicks_<type>_<ts>.csv', () => {
    expect(clicksFileName('Category', 1760000000000)).toBe('clicks_category_1760000000000.csv')
  })

  it('defaults to the current time', () => {
    expect(clicksFileName('Business')).toMatch(/^clicks_business_\d+\.csv$/)
  })
})
