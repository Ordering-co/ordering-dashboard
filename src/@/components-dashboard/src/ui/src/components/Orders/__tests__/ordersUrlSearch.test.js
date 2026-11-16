import { describe, expect, it } from 'vitest'

import { getOrdersUrlFilterPatch, getOrdersUrlSearchState } from '../ordersUrlSearch'

describe('getOrdersUrlSearchState', () => {
  it('opens the detail sidebar when id is present', () => {
    expect(getOrdersUrlSearchState('?id=123&status=pending')).toEqual({
      orderId: '123',
      isDetailOpen: true,
      statusGroup: 'pending'
    })
  })

  it('closes the detail sidebar when id is missing', () => {
    expect(getOrdersUrlSearchState('?status=inProgress')).toEqual({
      orderId: null,
      isDetailOpen: false,
      statusGroup: 'inProgress'
    })
  })

  it('closes the detail sidebar when id is empty', () => {
    expect(getOrdersUrlSearchState('?id=')).toEqual({
      orderId: null,
      isDetailOpen: false,
      statusGroup: null
    })
  })

  it('reads a valid status group from the query', () => {
    expect(getOrdersUrlSearchState('?status=completed').statusGroup).toBe('completed')
    expect(getOrdersUrlSearchState('?status=cancelled').statusGroup).toBe('cancelled')
  })

  it('ignores an unknown status value', () => {
    expect(getOrdersUrlSearchState('?status=all').statusGroup).toBe(null)
  })
})

// (D-22): /orders and /deliveries open already filtered from ?business= / ?unassigned= / ?late=
describe('getOrdersUrlFilterPatch', () => {
  it('returns an empty object when no filter param is present', () => {
    expect(getOrdersUrlFilterPatch('')).toEqual({})
    expect(getOrdersUrlFilterPatch()).toEqual({})
    expect(getOrdersUrlFilterPatch('?status=pending&id=5')).toEqual({})
  })

  it('reads one business id', () => {
    expect(getOrdersUrlFilterPatch('?business=12')).toEqual({ businessIds: [12] })
  })

  it('reads a comma separated list of business ids as numbers', () => {
    expect(getOrdersUrlFilterPatch('?business=12,15,3')).toEqual({ businessIds: [12, 15, 3] })
  })

  it('ignores the invalid business ids and keeps the valid ones', () => {
    expect(getOrdersUrlFilterPatch('?business=12,abc,0,-4,1.5,,7')).toEqual({ businessIds: [12, 7] })
  })

  it('leaves businessIds out when none is valid', () => {
    expect(getOrdersUrlFilterPatch('?business=abc')).toEqual({})
    expect(getOrdersUrlFilterPatch('?business=')).toEqual({})
    expect(getOrdersUrlFilterPatch('?business=0')).toEqual({})
  })

  it('reads unassigned=1 as assigned: 1', () => {
    expect(getOrdersUrlFilterPatch('?unassigned=1')).toEqual({ assigned: 1 })
  })

  it('ignores unassigned with any other value', () => {
    expect(getOrdersUrlFilterPatch('?unassigned=0')).toEqual({})
    expect(getOrdersUrlFilterPatch('?unassigned=true')).toEqual({})
    expect(getOrdersUrlFilterPatch('?unassigned=')).toEqual({})
  })

  it('reads late=1 as timeStatus: delayed', () => {
    expect(getOrdersUrlFilterPatch('?late=1')).toEqual({ timeStatus: 'delayed' })
  })

  it('ignores late with any other value', () => {
    expect(getOrdersUrlFilterPatch('?late=0')).toEqual({})
    expect(getOrdersUrlFilterPatch('?late=yes')).toEqual({})
  })

  it('combines the three params and ignores the others', () => {
    expect(getOrdersUrlFilterPatch('?status=inProgress&id=9&business=12&unassigned=1&late=1')).toEqual({
      businessIds: [12],
      assigned: 1,
      timeStatus: 'delayed'
    })
  })

  it('keeps reading id and status exactly as before', () => {
    expect(getOrdersUrlSearchState('?id=9&status=inProgress&business=12&unassigned=1&late=1')).toEqual({
      orderId: '9',
      isDetailOpen: true,
      statusGroup: 'inProgress'
    })
  })
})
