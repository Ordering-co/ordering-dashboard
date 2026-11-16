// redesign UC-B3 (decisions 2 and 3; M-C7): the pure helpers of the customers filter bar. The sign-up date values are pinned
// against what the controller (K/UsersFilter) produces today for the same dates, so the list asks the API for the same thing.
import React from 'react'
import { act, render } from '@testing-library/react'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token' }] }))

import { USERS_FILTER_INITIAL_VALUES, UsersFilter } from '../../../../../../components/UsersFilter'
import {
  activeFilterChips,
  clearFilterKey,
  completeFilterValues,
  hasActiveFilters,
  rangeToValues,
  sheetActiveCount,
  signUpPresetToValues
} from '../customerFilters'

const INITIAL = JSON.parse(JSON.stringify(USERS_FILTER_INITIAL_VALUES))
const TEXTS = {
  CUSTOMERS_RANGE_TODAY: 'Today',
  CUSTOMERS_RANGE_YESTERDAY: 'Yesterday',
  CUSTOMERS_RANGE_LAST_7_DAYS: 'Last 7 days',
  CUSTOMERS_RANGE_LAST_30_DAYS: 'Last 30 days'
}
const t = (key, text) => TEXTS[key] ?? text
const formatDate = (day) => dayjs(day, 'YYYY-MM-DD').format('DD-MM-YYYY')
const LEVELS = { loading: false, levels: [{ id: 4, name: 'Gold' }, { id: 5, name: 'Silver' }] }
const chipsOf = (values) => activeFilterChips(values, { t, loyaltyLevels: LEVELS, formatDate })
const withValues = (changes) => ({ ...INITIAL, ...changes })

describe('activeFilterChips', () => {
  it('has no chip for the initial values, for an empty object or for nothing', () => {
    expect(chipsOf(INITIAL)).toEqual([])
    expect(chipsOf({})).toEqual([])
    expect(chipsOf(undefined)).toEqual([])
  })

  it.each([
    ['id', { id: '12' }, 'ID: 12'],
    ['externalId', { externalId: '98' }, 'External ID: 98'],
    ['name', { name: 'Ana' }, 'Name: Ana'],
    ['lastname', { lastname: 'Ruiz' }, 'Last name: Ruiz'],
    ['email', { email: 'ana@' }, 'Email: ana@'],
    ['ordersCount', { ordersCount: { value: '3', condition: 'gt' } }, 'Amount of orders: > 3'],
    ['phoneVerified', { phoneVerified: true }, 'Phone verified: Yes'],
    ['emailVerified', { emailVerified: false }, 'Email verified: No'],
    ['loyaltyLevel', { loyaltyLevel: 4 }, 'Loyalty level: Gold']
  ])('draws one chip for %s, keyed by it', (key, change, label) => {
    expect(chipsOf(withValues(change))).toEqual([{ key, label }])
  })

  it.each([
    ['eq', '='],
    ['gt', '>'],
    ['lt', '<'],
    ['ge', '>='],
    ['le', '<=']
  ])('writes the %s operator of the amount of orders as «%s»', (condition, symbol) => {
    expect(chipsOf(withValues({ ordersCount: { value: '0', condition } }))[0].label).toBe(`Amount of orders: ${symbol} 0`)
  })

  it('an amount of orders with no number is not a filter', () => {
    expect(chipsOf(withValues({ ordersCount: { value: '', condition: 'gt' } }))).toEqual([])
  })

  it('falls back to the id of a loyalty level it does not know yet (levels still loading)', () => {
    expect(chipsOf(withValues({ loyaltyLevel: 9 }))[0].label).toBe('Loyalty level: 9')
    expect(activeFilterChips(withValues({ loyaltyLevel: 4 }), { t, loyaltyLevels: { loading: true, levels: [] }, formatDate })[0].label).toBe('Loyalty level: 4')
  })

  it('writes a sign-up preset with its name and a range in the project format', () => {
    expect(chipsOf(withValues({ dateType: 'last7', deliveryFromDatetime: '2026-10-02 00:00:00' }))).toEqual([
      { key: 'dateType', label: 'Sign up date: Last 7 days' }
    ])
    expect(chipsOf(withValues({ dateType: 'term', deliveryFromDatetime: '2026-10-01 00:00:00', deliveryEndDatetime: '2026-10-05 23:59:59' }))).toEqual([
      { key: 'dateType', label: 'Sign up date: 01-10-2026 – 05-10-2026' }
    ])
    expect(chipsOf(withValues({ dateType: 'term', deliveryFromDatetime: '2026-10-01 00:00:00' }))[0].label).toBe('Sign up date: From 01-10-2026')
    expect(chipsOf(withValues({ dateType: 'term', deliveryEndDatetime: '2026-10-05 23:59:59' }))[0].label).toBe('Sign up date: To 05-10-2026')
  })

  it('«Any» and a custom range with no days are not filters', () => {
    expect(chipsOf(withValues({ dateType: 'default' }))).toEqual([])
    expect(chipsOf(withValues({ dateType: 'term' }))).toEqual([])
  })

  // M-C7: the keys only the command palette can seed are never invisible
  it('draws the keys only ⌘K can seed', () => {
    expect(chipsOf(withValues({ cellphone: '555' }))).toEqual([{ key: 'cellphone', label: 'Phone number: 555' }])
    expect(chipsOf(withValues({ countryPhoneCode: '1' }))).toEqual([{ key: 'countryPhoneCode', label: 'Country phone code: +1' }])
    expect(chipsOf(withValues({ enabled: false }))).toEqual([{ key: 'enabled', label: 'Status: Inactive' }])
    expect(chipsOf(withValues({ enabled: true }))).toEqual([{ key: 'enabled', label: 'Status: Active' }])
    expect(chipsOf(withValues({ cityIds: [10, 11] }))).toEqual([{ key: 'cityIds', label: 'Cities: 2' }])
    expect(chipsOf(withValues({ userType: 9 }))).toEqual([{ key: 'userType', label: 'User type: Call center agent' }])
  })

  it('keeps the order of the bar: the sheet fields, the pills, then the seeded keys', () => {
    const keys = chipsOf(withValues({
      userType: 3,
      loyaltyLevel: 4,
      dateType: 'today',
      deliveryFromDatetime: '2026-10-09 00:00:00',
      emailVerified: true,
      phoneVerified: true,
      ordersCount: { value: '1', condition: 'eq' },
      email: 'a',
      id: '1'
    })).map(chip => chip.key)
    expect(keys).toEqual(['id', 'email', 'ordersCount', 'phoneVerified', 'emailVerified', 'dateType', 'loyaltyLevel', 'userType'])
  })
})

describe('clearFilterKey', () => {
  const FULL = withValues({
    id: '1',
    name: 'Ana',
    ordersCount: { value: '3', condition: 'lt' },
    phoneVerified: true,
    loyaltyLevel: 4,
    dateType: 'term',
    deliveryFromDatetime: '2026-10-01 00:00:00',
    deliveryEndDatetime: '2026-10-05 23:59:59',
    cityIds: [1]
  })

  it('puts one key back to its initial value and leaves a complete object', () => {
    const next = clearFilterKey(FULL, 'name')
    expect(next).toEqual({ ...FULL, name: null })
    expect(Object.keys(next).sort()).toEqual(Object.keys(INITIAL).sort())
  })

  it('clears the three date keys together, whichever of them names the chip', () => {
    const dates = { dateType: null, deliveryFromDatetime: null, deliveryEndDatetime: null }
    expect(clearFilterKey(FULL, 'dateType')).toEqual({ ...FULL, ...dates })
    expect(clearFilterKey(FULL, 'deliveryFromDatetime')).toEqual({ ...FULL, ...dates })
    expect(clearFilterKey(FULL, 'deliveryEndDatetime')).toEqual({ ...FULL, ...dates })
  })

  it('puts the amount of orders back to an empty number and the = operator', () => {
    expect(clearFilterKey(FULL, 'ordersCount').ordersCount).toEqual({ value: '', condition: 'eq' })
  })

  it('empties the city list, and completes a partial object', () => {
    expect(clearFilterKey(FULL, 'cityIds').cityIds).toEqual([])
    expect(clearFilterKey({ name: 'Ana' }, 'name')).toEqual(INITIAL)
  })

  it('does not share its objects with the initial values or with the input', () => {
    const next = clearFilterKey(FULL, 'name')
    next.ordersCount.value = '9'
    next.cityIds.push(7)
    expect(FULL.ordersCount.value).toBe('3')
    expect(USERS_FILTER_INITIAL_VALUES.ordersCount.value).toBe('')
    expect(USERS_FILTER_INITIAL_VALUES.cityIds).toEqual([])
  })
})

describe('completeFilterValues', () => {
  it('merges the initial values, the current ones and the change, in that order', () => {
    expect(completeFilterValues({ name: 'Ana' }, { email: 'a@' })).toEqual({ ...INITIAL, name: 'Ana', email: 'a@' })
    expect(completeFilterValues(undefined, undefined)).toEqual(INITIAL)
  })

  it('never lets an undefined through: the controller turns every key that is not null into a condition', () => {
    const next = completeFilterValues({ deliveryEndDatetime: undefined, phoneVerified: undefined }, { name: undefined })
    expect(Object.values(next).includes(undefined)).toBe(false)
    expect(next.deliveryEndDatetime).toBeNull()
    expect(next.name).toBeNull()
  })
})

describe('hasActiveFilters', () => {
  it('is false with nothing narrowing', () => {
    expect(hasActiveFilters({ searchValue: '', orderFilterValue: null, multiFilterValues: INITIAL })).toBe(false)
    expect(hasActiveFilters({ searchValue: null, orderFilterValue: null, multiFilterValues: {} })).toBe(false)
    expect(hasActiveFilters({})).toBe(false)
  })

  it('is true with a search (blank spaces do not count)', () => {
    expect(hasActiveFilters({ searchValue: 'ana', orderFilterValue: null, multiFilterValues: INITIAL })).toBe(true)
    expect(hasActiveFilters({ searchValue: '   ', orderFilterValue: null, multiFilterValues: INITIAL })).toBe(false)
  })

  it('is true with any Orders option but All, 0 included', () => {
    ;[0, 1, 5].forEach(orderFilterValue => {
      expect(hasActiveFilters({ searchValue: '', orderFilterValue, multiFilterValues: INITIAL })).toBe(true)
    })
  })

  it('is true with one multi filter value', () => {
    expect(hasActiveFilters({ searchValue: '', orderFilterValue: null, multiFilterValues: withValues({ emailVerified: false }) })).toBe(true)
  })
})

describe('sheetActiveCount', () => {
  it('counts the fields of the sheet that hold a value, and none of the pills', () => {
    expect(sheetActiveCount(INITIAL)).toBe(0)
    expect(sheetActiveCount(withValues({ id: '1', name: 'Ana', ordersCount: { value: '2', condition: 'ge' } }))).toBe(3)
    expect(sheetActiveCount(withValues({ phoneVerified: true, loyaltyLevel: 4, dateType: 'today', deliveryFromDatetime: '2026-10-09 00:00:00' }))).toBe(0)
  })
})

// ---- the sign-up values equal what the controller writes today ----------------------------------------------------------
describe('sign-up values · same as K/UsersFilter', () => {
  let controller
  const Capture = (props) => {
    controller = props
    return null
  }
  const mountController = () => {
    render(<UsersFilter UIComponent={Capture} />)
  }

  beforeEach(() => {
    // Friday 9 October 2026, 15:30 local; only the clock is faked
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 9, 15, 30, 0) })
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ error: false, result: [] }) })))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const FIELDS = ['dateType', 'deliveryFromDatetime', 'deliveryEndDatetime']
  const dateFields = (values) => Object.fromEntries(FIELDS.map(key => [key, values[key]]))

  it.each(['default', 'today', 'yesterday', 'last7', 'last30', 'term'])('preset «%s» writes what handleChangeDateType writes', async (preset) => {
    mountController()
    await act(async () => { controller.handleChangeDateType(preset) })
    expect(signUpPresetToValues(preset)).toEqual(dateFields(controller.filterValues))
  })

  it('a preset sets only the start, as today, and the end stays empty', () => {
    expect(signUpPresetToValues('last30')).toEqual({ dateType: 'last30', deliveryFromDatetime: '2026-09-09 00:00:00', deliveryEndDatetime: null })
  })

  it('a preset clears a stale end left by a custom range', async () => {
    mountController()
    await act(async () => { controller.handleChangeDateType('term') })
    await act(async () => { controller.handleChangeEndDate('2026-10-05 23:59:59') })
    // the controller keeps that end under «Today»; the bar must not (the chip would say «Today» and the list would stop at 5 Oct)
    await act(async () => { controller.handleChangeDateType('today') })
    expect(controller.filterValues.deliveryEndDatetime).toBe('2026-10-05 23:59:59')
    expect(signUpPresetToValues('today').deliveryEndDatetime).toBeNull()
  })

  it('takes the clock from the argument when it is given', () => {
    expect(signUpPresetToValues('today', dayjs('2026-01-31 18:00:00'))).toEqual({ dateType: 'today', deliveryFromDatetime: '2026-01-31 00:00:00', deliveryEndDatetime: null })
  })

  it('a range writes what the date selector writes today: term, the start at 00:00:00 and the end at 23:59:59', async () => {
    mountController()
    await act(async () => { controller.handleChangeDateType('term') })
    await act(async () => { controller.handleChangeFromDate('2026-10-01 00:00:00') })
    await act(async () => { controller.handleChangeEndDate('2026-10-05 23:59:59') })
    expect(rangeToValues('2026-10-01', '2026-10-05')).toEqual(dateFields(controller.filterValues))
  })

  it('an open range writes only the side it has, and no days is «Any»', () => {
    expect(rangeToValues('2026-10-01', null)).toEqual({ dateType: 'term', deliveryFromDatetime: '2026-10-01 00:00:00', deliveryEndDatetime: null })
    expect(rangeToValues(null, '2026-10-05')).toEqual({ dateType: 'term', deliveryFromDatetime: null, deliveryEndDatetime: '2026-10-05 23:59:59' })
    expect(rangeToValues(null, null)).toEqual({ dateType: 'default', deliveryFromDatetime: null, deliveryEndDatetime: null })
  })
})
