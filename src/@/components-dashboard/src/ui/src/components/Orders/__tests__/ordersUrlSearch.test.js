import { describe, expect, it } from 'vitest'

import { getOrdersUrlSearchState } from '../ordersUrlSearch'

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
