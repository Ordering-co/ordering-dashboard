import { describe, expect, it } from 'vitest'

import { applyInlineOrderStatusToList } from '../inlineOrderStatusList'

const pendingStatuses = [0, 13]
const orders = [
  { id: 11, status: 0, customer: { name: 'A' } },
  { id: 12, status: 0, customer: { name: 'B' } }
]

describe('applyInlineOrderStatusToList', () => {
  it('keeps and updates the row when the new status stays in the active filter', () => {
    const source = orders.map(order => ({ ...order }))

    const next = applyInlineOrderStatusToList({
      orders: source,
      orderId: 11,
      newStatus: 13,
      visibleStatuses: pendingStatuses,
      updatedOrder: { id: 11, status: 13 }
    })

    expect(next).toEqual([
      { id: 11, status: 13, customer: { name: 'A' } },
      { id: 12, status: 0, customer: { name: 'B' } }
    ])
    expect(source[0].status).toBe(0)
  })

  it('treats string and number statuses as the same filter value', () => {
    expect(applyInlineOrderStatusToList({
      orders,
      orderId: 11,
      newStatus: '13',
      visibleStatuses: pendingStatuses
    })[0].status).toBe('13')
  })

  it('removes the row when the new status leaves the active filter', () => {
    expect(applyInlineOrderStatusToList({
      orders,
      orderId: 11,
      newStatus: 7,
      visibleStatuses: pendingStatuses
    })).toEqual([
      { id: 12, status: 0, customer: { name: 'B' } }
    ])
  })

  it('removes the row when there is no visible status list to match against', () => {
    expect(applyInlineOrderStatusToList({
      orders,
      orderId: 11,
      newStatus: 13,
      visibleStatuses: []
    })).toEqual([
      { id: 12, status: 0, customer: { name: 'B' } }
    ])
  })
})
