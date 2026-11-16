import { describe, expect, it } from 'vitest'

import { orderStatus } from '../orderStatus'
import { ORDER_STATUS_FAMILIES, getOrderStatusFamily, isOrderClosed } from '../orderStatusFamily'

// The same groups OrdersManage uses for its tabs (components/OrdersManage/index.js).
const TAB_GROUPS = {
  pending: [0, 13],
  inProgress: [7, 8, 4, 9, 3, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  completed: [1, 11, 15],
  cancelled: [2, 5, 6, 10, 12, 16, 17]
}

describe('order status families (C5)', () => {
  it('classifies every order status exactly once', () => {
    const codes = Object.values(ORDER_STATUS_FAMILIES).flat().sort((a, b) => a - b)
    expect(codes).toEqual(orderStatus.map(status => status.key).sort((a, b) => a - b))
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('agrees with the tabs the list already uses', () => {
    TAB_GROUPS.pending.forEach(code => expect(getOrderStatusFamily(code)).toBe('pending'))
    TAB_GROUPS.inProgress.forEach(code => expect(['progress', 'review']).toContain(getOrderStatusFamily(code)))
    TAB_GROUPS.completed.forEach(code => expect(getOrderStatusFamily(code)).toBe('done'))
    TAB_GROUPS.cancelled.forEach(code => expect(getOrderStatusFamily(code)).toBe('cancel'))
  })

  it('marks the step back as review, not as pending or progress', () => {
    expect(getOrderStatusFamily(14)).toBe('review')
  })

  it('reads string codes and never calls an unknown status done', () => {
    expect(getOrderStatusFamily('11')).toBe('done')
    expect(getOrderStatusFamily(99)).toBe('progress')
    expect(isOrderClosed(99)).toBe(false)
    expect(isOrderClosed(16)).toBe(true)
    expect(isOrderClosed(4)).toBe(false)
  })
})
