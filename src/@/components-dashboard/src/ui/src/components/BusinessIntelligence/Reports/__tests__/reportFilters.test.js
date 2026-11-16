// redesign reports FC1 (D4, D5; auditor 7): the rules of the filters the page shares between the 21 reports.
import { describe, expect, it } from 'vitest'
import { ADVANCED_REPORTS, getAdvancedReport } from '../../../../../../utils/advancedReports'
import { defaultRange } from '../../../../../../utils/reportPeriods'
import {
  REPORT_FILTER_KEYS,
  REPORT_URL_PARAMS,
  barCountryCode,
  barFilters,
  clearedFilters,
  effectiveFilters,
  filtersFromSearch,
  filtersToSearch,
  findPeriodUnit,
  initialFilters,
  mergeBarFilters,
  nextCountryCode,
  withFilterParams
} from '../reportFilters'

const TODAY = '2026-10-10'
const ZONE = 'America/Bogota'
const report = (id) => getAdvancedReport(id)

// every filter set, so a leak of a hidden value is seen
const FULL = {
  from: '2026-10-03',
  to: '2026-10-10',
  businessIds: [1, 2],
  drivers_ids: [21],
  franchises_id: [10],
  driver_companies_ids: [4],
  driver_groups_ids: [5],
  delivery_types_ids: [1],
  app_ids: [7],
  timeZone: ZONE
}

describe('initialFilters (the defaults of main, AdvancedReports:27-40)', () => {
  it('is the last 7 days plus today (8 dates), no filter and the zone of the browser', () => {
    expect(initialFilters(TODAY, ZONE)).toEqual({
      ...defaultRange(TODAY),
      businessIds: null,
      drivers_ids: null,
      franchises_id: null,
      driver_companies_ids: null,
      driver_groups_ids: null,
      delivery_types_ids: null,
      app_ids: null,
      timeZone: ZONE
    })
    expect(initialFilters(TODAY, ZONE).from).toBe('2026-10-03')
    expect(initialFilters(TODAY, ZONE).to).toBe(TODAY)
  })

  it('has every key of the matrix of 00-common.md', () => {
    expect(REPORT_FILTER_KEYS).toEqual(['businessIds', 'drivers_ids', 'franchises_id', 'driver_companies_ids', 'driver_groups_ids', 'delivery_types_ids', 'app_ids'])
  })
})

describe('effectiveFilters (what is sent)', () => {
  it('keeps the filters of the pills the report has and sends null for the ones it does not (report 15: channel and zone only)', () => {
    expect(effectiveFilters(report(15), FULL, TODAY)).toEqual({
      from: '2026-10-03',
      to: '2026-10-10',
      businessIds: null,
      drivers_ids: null,
      franchises_id: null,
      driver_companies_ids: null,
      driver_groups_ids: null,
      delivery_types_ids: null,
      app_ids: [7],
      timeZone: ZONE
    })
  })

  it('report 13 sends stores and brand; report 21 sends group, driver and stores but not the brand', () => {
    const thirteen = effectiveFilters(report(13), FULL, TODAY)
    expect(thirteen).toMatchObject({ businessIds: [1, 2], franchises_id: [10], drivers_ids: null, driver_groups_ids: null, app_ids: null })
    const twentyOne = effectiveFilters(report(21), FULL, TODAY)
    expect(twentyOne).toMatchObject({ businessIds: [1, 2], drivers_ids: [21], driver_groups_ids: [5], franchises_id: null, app_ids: null, delivery_types_ids: null })
  })

  it('report 10 does not send the brand even though the page holds one (it does not narrow the stores)', () => {
    expect(effectiveFilters(report(10), FULL, TODAY)).toMatchObject({ businessIds: [1, 2], franchises_id: null })
  })

  it('report 8 is the only one that sends the order type; the delivery companies are never sent', () => {
    ADVANCED_REPORTS.forEach(item => {
      const sent = effectiveFilters(item, FULL, TODAY)
      expect(sent.delivery_types_ids !== null).toBe(item.pills.includes('orderType'))
      expect(sent.driver_companies_ids).toBeNull()
    })
  })

  it('an empty list is null, as the controllers do', () => {
    expect(effectiveFilters(report(13), { ...FULL, businessIds: [], franchises_id: [] }, TODAY)).toMatchObject({ businessIds: null, franchises_id: null })
  })

  it('report 7 asks for the one day of the schedule, whatever the range of the page is, and does not touch the page range', () => {
    const filters = { ...FULL }
    expect(effectiveFilters(report(7), filters, '2026-10-08')).toMatchObject({ from: '2026-10-08', to: '2026-10-08', timeZone: ZONE })
    expect(filters.from).toBe('2026-10-03')
    expect(effectiveFilters(report(13), filters, '2026-10-08')).toMatchObject({ from: '2026-10-03', to: '2026-10-10' })
  })

  it('never lets a report send a key it has no pill for, whatever the page holds', () => {
    ADVANCED_REPORTS.forEach(item => {
      const sent = effectiveFilters(item, FULL, TODAY)
      const allowed = {
        businessIds: 'stores',
        franchises_id: 'brand',
        drivers_ids: 'driver',
        driver_groups_ids: 'driverGroup',
        delivery_types_ids: 'orderType',
        app_ids: 'channel'
      }
      Object.entries(allowed).forEach(([key, pill]) => {
        if (!item.pills.includes(pill)) expect(sent[key], `${item.id} ${key}`).toBeNull()
      })
    })
  })
})

describe('what the bar of a report sees and writes back', () => {
  it('a report with stores but no brand (21, 10) does not narrow its stores by a brand it does not show', () => {
    expect(barFilters(report(21), FULL).franchises_id).toBeNull()
    expect(barFilters(report(10), FULL).franchises_id).toBeNull()
    expect(barFilters(report(13), FULL).franchises_id).toEqual([10])
    expect(barFilters(report(15), FULL)).toBe(FULL)
  })

  // redesign reports R1 (Q-02): this test was written for the wrong fix. It said «what the bar writes back keeps the hidden brand» and used it
  // to cover «Clear filters» too, so the brand outlived a clear (the clear of a report with no Brand pill, 21 and 10, left `franchises_id`).
  // An EDIT of the bar (a store, a zone) still keeps the brand it did not see, as below; «Clear filters» is not an edit of the bar: the page
  // clears with `clearedFilters` (next describe), and the bar no longer writes a patch for it.
  it('an edit of the bar keeps the hidden brand of the page (the value stays for the reports that have the pill)', () => {
    const next = { ...barFilters(report(21), FULL), businessIds: [3] }
    expect(mergeBarFilters(report(21), FULL, next)).toEqual({ ...FULL, businessIds: [3] })
    // a report that has the brand pill takes the bar's value, null included
    expect(mergeBarFilters(report(13), FULL, { ...FULL, franchises_id: null }).franchises_id).toBeNull()
  })

  it('the country only narrows the stores where the report has the Country pill', () => {
    expect(barCountryCode(report(13), 'CO')).toBe('CO')
    expect(barCountryCode(report(21), 'CO')).toBe('')
    expect(barCountryCode(report(15), 'CO')).toBe('')
  })
})

// redesign reports R1 (Q-02, D4): «Clear filters» is the defaults of ALL the filters, the ones of pills the report does not show too
describe('clearedFilters («Clear filters» of the page)', () => {
  it('nulls every filter key of the page, the hidden brand included, and puts the zone of the browser; from and to stay', () => {
    const cleared = clearedFilters(FULL, 'Europe/Madrid')
    expect(cleared).toEqual({ ...initialFilters(TODAY, 'Europe/Madrid'), from: '2026-10-03', to: '2026-10-10' })
    REPORT_FILTER_KEYS.forEach(key => expect(cleared[key], key).toBeNull())
    expect(cleared.timeZone).toBe('Europe/Madrid')
  })

  it('keeps the range it was given (a custom one included) and does not change what it was handed', () => {
    const current = { ...FULL, from: '2026-09-01', to: '2026-09-15' }
    const cleared = clearedFilters(current, ZONE)
    expect(cleared).toMatchObject({ from: '2026-09-01', to: '2026-09-15' })
    expect(current.franchises_id).toEqual([10])
    expect(cleared).not.toBe(current)
  })

  it('what a report without the Brand pill cleared is not sent by the next one (21 clears, 13 sends no brand)', () => {
    const cleared = clearedFilters(FULL, ZONE)
    expect(effectiveFilters(report(13), cleared, TODAY).franchises_id).toBeNull()
    expect(barFilters(report(13), cleared).franchises_id).toBeNull()
  })
})

describe('nextCountryCode (handleChangeCode of main, AdvancedReports:42-45)', () => {
  it('the same code takes the country away, another one replaces it', () => {
    expect(nextCountryCode('CO', 'CO')).toBe('')
    expect(nextCountryCode('CO', 'US')).toBe('US')
    expect(nextCountryCode('', 'CO')).toBe('CO')
  })
})

describe('findPeriodUnit (how the API grouped the answer)', () => {
  it('reads the unit of the first label of a period anywhere in the answer', () => {
    expect(findPeriodUnit({ axis: { x: { labels: ['Week 2026-39', 'Week 2026-40'] } } })).toBe('week')
    expect(findPeriodUnit([{ header: [{ name: 'Store' }, { name: 'Day 2026-10-03', colspan: 2 }] }])).toBe('day')
    expect(findPeriodUnit({ dataset: { data: [{ x: 'Hour 2026-10-05 09:00', y: 1 }] } })).toBe('hour')
    expect(findPeriodUnit({ labels: ['Month 2026-08'] })).toBe('month')
    expect(findPeriodUnit({ labels: ['Year 2025'] })).toBe('year')
  })

  it('is null with no labels, with a label it does not know, or with no answer', () => {
    expect(findPeriodUnit(null)).toBeNull()
    expect(findPeriodUnit(undefined)).toBeNull()
    expect(findPeriodUnit({ dataset: [{ label: 'Orders', data: [{ x: 'Quarter 3', y: 1 }] }] })).toBeNull()
    expect(findPeriodUnit([])).toBeNull()
  })

  it('is not slowed down by a very long answer', () => {
    const rows = Array.from({ length: 50000 }, (_, index) => ({ id: index, name: `Store ${index}` }))
    expect(findPeriodUnit(rows)).toBeNull()
  })
})

// redesign (row 3, D-29): the period and the filters of a report travel in the address
describe('filtersToSearch (what the address carries for a report)', () => {
  const MADRID = 'Europe/Madrid'

  it('report 13: the period, the stores and the brand it has, the country and a zone that is not the browser\'s', () => {
    expect(filtersToSearch(report(13), { ...FULL, timeZone: MADRID }, 'CO', TODAY, ZONE)).toEqual({
      from: '2026-10-03',
      to: '2026-10-10',
      stores: '1,2',
      brands: '10',
      country: 'CO',
      zone: MADRID
    })
  })

  it('leaves out the zone when it is the browser\'s, and the country when there is none', () => {
    const params = filtersToSearch(report(13), FULL, '', TODAY, ZONE)
    expect(params).not.toHaveProperty('zone')
    expect(params).not.toHaveProperty('country')
  })

  it('treats Europe/Kiev and Europe/Kyiv as the same zone', () => {
    expect(filtersToSearch(report(13), { ...FULL, timeZone: 'Europe/Kyiv' }, '', TODAY, 'Europe/Kiev')).not.toHaveProperty('zone')
  })

  it('report 7 carries the day, not the range, and its group and driver', () => {
    expect(filtersToSearch(report(7), { ...FULL, timeZone: MADRID }, 'CO', '2026-10-08', ZONE)).toEqual({
      day: '2026-10-08',
      groups: '5',
      drivers: '21',
      zone: MADRID
    })
  })

  it('carries only what that report uses: no brand for 21, no country for 15, channels for 15, types for 8', () => {
    expect(filtersToSearch(report(21), FULL, 'CO', TODAY, ZONE)).toEqual({ from: '2026-10-03', to: '2026-10-10', stores: '1,2', groups: '5', drivers: '21' })
    expect(filtersToSearch(report(15), FULL, 'CO', TODAY, ZONE)).toEqual({ from: '2026-10-03', to: '2026-10-10', channels: '7' })
    expect(filtersToSearch(report(8), FULL, '', TODAY, ZONE)).toEqual({ from: '2026-10-03', to: '2026-10-10', stores: '1,2', brands: '10', types: '1' })
  })

  it('writes no empty list, and only keys of REPORT_URL_PARAMS', () => {
    const params = filtersToSearch(report(13), { ...FULL, businessIds: [], franchises_id: null }, '', TODAY, ZONE)
    expect(params).toEqual({ from: '2026-10-03', to: '2026-10-10' })
    ADVANCED_REPORTS.forEach(item => {
      Object.keys(filtersToSearch(item, { ...FULL, timeZone: MADRID }, 'CO', TODAY, ZONE)).forEach(key => expect(REPORT_URL_PARAMS).toContain(key))
    })
  })
})

describe('withFilterParams (the address, with the filters of one report)', () => {
  it('replaces the filter params, keeps the id and the params that are not filters', () => {
    expect(withFilterParams('?id=13&from=2020-01-01&utm=x&stores=9', { from: '2026-10-03', stores: '1,2' }))
      .toBe('?id=13&utm=x&from=2026-10-03&stores=1%2C2')
  })

  it('with no params takes every filter out (the catalog)', () => {
    expect(withFilterParams('?id=13&from=2026-10-03&to=2026-10-10&zone=Europe%2FMadrid', {})).toBe('?id=13')
    expect(withFilterParams('?from=2026-10-03', {})).toBe('')
  })
})

describe('filtersFromSearch (a fresh load with the params)', () => {
  const defaults = initialFilters(TODAY, ZONE)

  it('without params it is today\'s defaults', () => {
    expect(filtersFromSearch('?id=13', TODAY, ZONE, report(13))).toEqual({ filters: defaults, countryCode: '', scheduleDay: TODAY })
    expect(filtersFromSearch('', TODAY, ZONE, null)).toEqual({ filters: defaults, countryCode: '', scheduleDay: TODAY })
  })

  it('starts from the period, the ids, the country and the zone of the address', () => {
    const { filters, countryCode, scheduleDay } = filtersFromSearch('?id=13&from=2026-09-01&to=2026-09-30&stores=1,2&brands=10&country=co&zone=Europe/Madrid', TODAY, ZONE, report(13))
    expect(filters).toEqual({ ...defaults, from: '2026-09-01', to: '2026-09-30', businessIds: [1, 2], franchises_id: [10], timeZone: 'Europe/Madrid' })
    expect(countryCode).toBe('CO')
    expect(scheduleDay).toBe(TODAY)
  })

  it('report 7 reads the day, and keeps the page range at its default', () => {
    const { filters, scheduleDay } = filtersFromSearch('?id=7&day=2026-10-01&from=2026-09-01&to=2026-09-30&groups=5&drivers=21,22', TODAY, ZONE, report(7))
    expect(scheduleDay).toBe('2026-10-01')
    expect(filters).toEqual({ ...defaults, driver_groups_ids: [5], drivers_ids: [21, 22] })
  })

  it('reads types and channels where the report has them', () => {
    expect(filtersFromSearch('?id=8&types=1,3', TODAY, ZONE, report(8)).filters.delivery_types_ids).toEqual([1, 3])
    expect(filtersFromSearch('?id=15&channels=7', TODAY, ZONE, report(15)).filters.app_ids).toEqual([7])
  })

  it('ignores a param the report has no pill for (the address of 21 cannot start a brand or a country)', () => {
    const { filters, countryCode } = filtersFromSearch('?id=21&brands=10&country=CO&types=1&stores=3', TODAY, ZONE, report(21))
    expect(filters).toEqual({ ...defaults, businessIds: [3] })
    expect(countryCode).toBe('')
  })

  // countries.code is free text (api-core takes up to 255 characters), so the address takes whatever code the pill wrote
  it('takes a country code of any length the API takes, and drops a blank or too long one', () => {
    const country = (code) => filtersFromSearch(`?id=13&country=${encodeURIComponent(code)}`, TODAY, ZONE, report(13)).countryCode
    expect(country('USA')).toBe('USA')
    expect(country('es-cn')).toBe('ES-CN')
    expect(country('A'.repeat(255))).toBe('A'.repeat(255))
    expect(country('A'.repeat(256))).toBe('')
    expect(country('   ')).toBe('')
  })

  it('anything invalid falls back to the default of its own, and unknown params are ignored', () => {
    const { filters, countryCode, scheduleDay } = filtersFromSearch('?id=13&from=2026-13-40&to=2026-09-30&stores=1,a&brands=&country=%20%20&zone=Mars/Base&foo=1', TODAY, ZONE, report(13))
    expect(filters).toEqual(defaults)
    expect(countryCode).toBe('')
    expect(scheduleDay).toBe(TODAY)
  })

  it('a list of ids with one invalid id is ignored whole; a repeated id counts once; zero, negative and decimals are invalid', () => {
    expect(filtersFromSearch('?id=13&stores=2,2,1', TODAY, ZONE, report(13)).filters.businessIds).toEqual([2, 1])
    ;['0', '-3', '1.5', '1,', 'x'].forEach(value => {
      expect(filtersFromSearch(`?id=13&stores=${value}`, TODAY, ZONE, report(13)).filters.businessIds, value).toBeNull()
    })
  })

  it('a range needs both dates and from not after to, else both are the default', () => {
    expect(filtersFromSearch('?id=13&from=2026-09-01', TODAY, ZONE, report(13)).filters).toMatchObject({ from: defaults.from, to: defaults.to })
    expect(filtersFromSearch('?id=13&from=2026-09-30&to=2026-09-01', TODAY, ZONE, report(13)).filters).toMatchObject({ from: defaults.from, to: defaults.to })
    expect(filtersFromSearch('?id=13&from=2026-02-30&to=2026-03-01', TODAY, ZONE, report(13)).filters).toMatchObject({ from: defaults.from, to: defaults.to })
  })

  it('an invalid day for report 7 is today', () => {
    expect(filtersFromSearch('?id=7&day=yesterday', TODAY, ZONE, report(7)).scheduleDay).toBe(TODAY)
  })

  it('is the inverse of filtersToSearch for every report', () => {
    ADVANCED_REPORTS.forEach(item => {
      const filters = { ...FULL, timeZone: 'Europe/Madrid' }
      const params = filtersToSearch(item, filters, 'CO', '2026-10-08', ZONE)
      const back = filtersFromSearch(`?${new URLSearchParams(params)}`, TODAY, ZONE, item)
      expect(filtersToSearch(item, back.filters, back.countryCode, back.scheduleDay, ZONE), `report ${item.id}`).toEqual(params)
    })
  })
})
