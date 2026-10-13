import { describe, expect, it } from 'vitest'
import * as analytics from '../analytics'

describe('orders listing analytics', () => {
  it('attributes the shared listing to its actual dashboard module', () => {
    expect(analytics.getOrdersAnalyticsModule({ isMessagesView: true, isDelivery: false })).toBe('messages')
    expect(analytics.getOrdersAnalyticsModule({ isMessagesView: false, isDelivery: true })).toBe('delivery')
    expect(analytics.getOrdersAnalyticsModule({ isMessagesView: false, isDelivery: false })).toBe('orders')
  })
})
