import { describe, expect, it } from 'vitest'

import { SIDEBAR_NAV_ORDER, orderSidebarItems } from '../sidebarNavOrder'

describe('orderSidebarItems', () => {
  it('puts delivery companies with groups, before status tools', () => {
    const items = [
      { pageName: 'drivers_time_display' },
      { pageName: 'drivers_companies' },
      { pageName: 'deliveries' },
      { pageName: 'drivers_groups' }
    ]
    expect(orderSidebarItems(items, SIDEBAR_NAV_ORDER.delivery).map(item => item.pageName))
      .toEqual(['deliveries', 'drivers_groups', 'drivers_companies', 'drivers_time_display'])
  })

  it('keeps unknown items after the known order', () => {
    const items = [
      { pageName: 'new_thing' },
      { pageName: 'orders' },
      { pageName: 'gift_cards' }
    ]
    expect(orderSidebarItems(items, SIDEBAR_NAV_ORDER.orders).map(item => item.pageName))
      .toEqual(['orders', 'gift_cards', 'new_thing'])
  })

  it('lists every delivery page name once', () => {
    const names = SIDEBAR_NAV_ORDER.delivery
    expect(new Set(names).size).toBe(names.length)
    expect(names.indexOf('drivers_companies')).toBeLessThan(names.indexOf('driver_store_status'))
    expect(names.indexOf('drivers_groups')).toBeLessThan(names.indexOf('drivers_companies'))
  })
})
