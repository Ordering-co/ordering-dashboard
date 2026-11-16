/* eslint-disable import/first */
import React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ configs: {}, received: null }))
vi.mock('../../../../../index', () => ({ useConfig: () => [{ configs: runtime.configs }] }))
vi.mock('../OrdersDashboardList', () => ({ OrdersDashboardList: props => { runtime.received = props; return <div /> } }))
vi.mock('./styles', () => ({ OrdersManageContainer: ({ children }) => <div>{children}</div> }))

import { OrdersDashboard } from '.'

describe('OrdersDashboard optimized data forwarding', () => {
  beforeEach(() => { runtime.configs = {}; runtime.received = null })

  it('keeps propsToFetch absent when optimization is disabled', () => {
    render(<OrdersDashboard marker='kept' />)
    expect(runtime.received).toMatchObject({ marker: 'kept', orderListView: 'table' })
    expect(runtime.received).not.toHaveProperty('propsToFetch')
  })

  it('keeps the exact optimized field list when enabled', () => {
    runtime.configs = { optimize_order_data: { value: '1' } }
    render(<OrdersDashboard marker='kept' />)
    expect(runtime.received.propsToFetch).toHaveLength(32)
    expect(runtime.received.propsToFetch).toEqual(expect.arrayContaining(['app_id', 'customer_id', 'driver_company_id', 'assignable_driver_groups']))
  })
})
