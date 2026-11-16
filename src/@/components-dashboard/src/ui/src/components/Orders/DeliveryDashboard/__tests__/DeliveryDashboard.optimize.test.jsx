/* eslint-disable import/first */
import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ configs: {}, received: null }))
vi.mock('../../../../../../index', () => ({ useConfig: () => [{ configs: runtime.configs }] }))
vi.mock('../../OrdersDashboardList', () => ({ OrdersDashboardList: props => { runtime.received = props; return <div /> } }))
vi.mock('../../DeliveriesLocation', () => ({ DeliveriesLocation: () => <div /> }))
vi.mock('../../OrderStatusFilterBar', () => ({ OrderStatusFilterBar: () => <div /> }))
vi.mock('../../OrderStatusSubFilter', () => ({ OrderStatusSubFilter: () => <div />, CUSTOMER_PICKUP_STATUSES: [15, 17, 20, 21] }))
vi.mock('../styles', () => ({
  DeliveryDashboardContainer: ({ children }) => <div>{children}</div>,
  OrdersContainer: ({ children }) => <div>{children}</div>,
  FilterContainer: ({ children }) => <div>{children}</div>,
  WrapperOrderlist: ({ children }) => <div>{children}</div>,
  WrapperDeliveriesLocation: ({ children }) => <div>{children}</div>
}))

import { DeliveryDashboard } from '..'

describe('DeliveryDashboard optimized data forwarding', () => {
  beforeEach(() => { runtime.configs = {}; runtime.received = null })

  it('keeps propsToFetch absent when optimization is disabled', () => {
    render(<DeliveryDashboard marker='kept' driversList={{ drivers: [] }} />)
    expect(runtime.received).toMatchObject({ marker: 'kept', orderListView: 'card', isDelivery: true })
    expect(runtime.received).not.toHaveProperty('propsToFetch')
  })

  it('keeps the exact delivery field list when optimization is enabled', () => {
    runtime.configs = { optimize_order_data: { value: '1' } }
    render(<DeliveryDashboard marker='kept' driversList={{ drivers: [] }} />)
    expect(runtime.received.propsToFetch).toEqual([
      'app_id', 'business', 'business_id', 'created_at', 'customer', 'customer_id', 'delivery_type', 'driver_group_id', 'driver_id', 'driver', 'delivery_datetime', 'delivery_datetime_utc', 'external_id', 'eta_time', 'id', 'logistic_status', 'logistic_attemps', 'uuid', 'order_group', 'order_group_id', 'priority', 'summary', 'status', 'time_status', 'total', 'metadata', 'external_driver', 'external_driver_id', 'driver_company', 'driver_company_id'
    ])
  })
})
