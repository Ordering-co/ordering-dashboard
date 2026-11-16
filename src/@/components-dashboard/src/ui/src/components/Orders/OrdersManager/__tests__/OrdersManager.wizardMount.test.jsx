/* eslint-disable import/first */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ host: null, controls: null }))

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  OrdersManage: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../../utils', () => ({ learnOptionsValues: () => [], addQueryToUrl: vi.fn() }))
vi.mock('../../../../hooks/useListingSearchSeed', () => ({ useListingSearchSeed: () => null }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: 1280 }) }))
vi.mock('../../../../styles', () => ({ IconButton: () => null }))
vi.mock('../../../Shared', () => ({ Alert: () => null, LearnDropDown: () => null }))
vi.mock('../../OrderDetails', () => ({ OrderDetails: () => <div data-testid='order-details' /> }))
vi.mock('../../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))
vi.mock('../../WizardOrders', () => ({ WizardOrders: () => null }))
vi.mock('../../GoogleMapsApiKeySettingButton', () => ({ GoogleMapsApiKeySettingButton: () => null }))
vi.mock('../../OrderNotification', () => ({ OrderNotification: () => null }))
vi.mock('../../WebsocketStatus', () => ({ WebsocketStatus: () => null }))
vi.mock('../../OrdersFilterBar', () => ({ OrdersFilterBar: () => <div data-testid='filter-bar' /> }))
vi.mock('../../OrdersDashboard', () => ({ OrdersDashboard: () => <div data-testid='orders-list' /> }))
// The controls (where the button is drawn, in one branch or another) must sit inside the host.
vi.mock('../../OrdersDashboardControls', () => ({
  OrdersDashboardControls: (props) => { runtime.controls = props; return <div data-testid='header-actions' /> }
}))
vi.mock('../../CreateCustomOrder', () => ({
  CreateCustomOrderProvider: (props) => {
    runtime.host = props
    return <div data-testid='create-host'>{props.children}</div>
  }
}))

import { OrdersManager } from '..'

const baseProps = {
  isUseQuery: true,
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { inProgress: [] },
  handleSelectedSubOrderStatus: vi.fn(),
  handleOrdersStatusGroupFilter: vi.fn(),
  handleChangeMultiOrdersStatus: vi.fn(),
  handleDeleteMultiOrders: vi.fn(),
  multiOrderUpdateStatus: 'completed',
  handleChangeFilterValues: vi.fn(),
  handleChangeSearch: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  setDetailsOrder: vi.fn(),
  onOrderRedirect: vi.fn(),
  driversList: { drivers: [] },
  selectedOrderIds: [],
  filterValues: { cities: [1] },
  searchValue: '',
  allowColumns: {},
  setAllowColumns: vi.fn()
}

const mount = (props = {}) => render(
  <MemoryRouter initialEntries={['/orders?status=inProgress']}>
    <OrdersManager {...baseProps} {...props} />
  </MemoryRouter>
)

// redesign F6c (Q2-08)
describe('OrdersManager · create-order form host', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    runtime.host = null
    runtime.controls = null
  })

  it('hosts the form above the page head and the list, so no branch of the head owns it', () => {
    mount()
    const host = screen.getByTestId('create-host')
    expect(within(host).getByTestId('header-actions')).toBeInTheDocument()
    expect(within(host).getByTestId('orders-list')).toBeInTheDocument()
    expect(runtime.host.disabled).toBe(false)
  })

  it('hands the host and the head the same way of opening the order a custom order created', () => {
    mount()
    expect(typeof runtime.host.handleOpenCustomOrderDetail).toBe('function')
    expect(runtime.host.handleOpenCustomOrderDetail).toBe(runtime.controls.handleOpenCustomOrderDetail)
  })

  it('does not host it in a manager embedded in another page (lateral bars), which never had the form', () => {
    mount({ isSelectedOrders: true })
    expect(runtime.host.disabled).toBe(true)
  })
})
