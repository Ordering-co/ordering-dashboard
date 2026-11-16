/* eslint-disable import/first */
// redesign F2 (C18): the orders manager is the surface that opts every dropdown of /orders, of the order panel
// and of the create-order wizard in to the one anatomy, through SelectSurfaceContext.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

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
vi.mock('../../OrderDetails', async () => {
  const { useContext } = await import('react')
  const { SelectSurfaceContext } = await import('../../../Shared/UI/selectPlacement')
  return { OrderDetails: () => <div data-testid='details-surface'>{String(useContext(SelectSurfaceContext).fitTrigger)}</div> }
})
vi.mock('../../WizardOrders', async () => {
  const { useContext } = await import('react')
  const { SelectSurfaceContext } = await import('../../../Shared/UI/selectPlacement')
  return { WizardOrders: () => <div data-testid='wizard-surface'>{String(useContext(SelectSurfaceContext).fitTrigger)}</div> }
})
vi.mock('../../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))
vi.mock('../../GoogleMapsApiKeySettingButton', () => ({ GoogleMapsApiKeySettingButton: () => null }))
vi.mock('../../OrderNotification', () => ({ OrderNotification: () => null }))
vi.mock('../../WebsocketStatus', () => ({ WebsocketStatus: () => null }))
vi.mock('../../OrdersFilterBar', async () => {
  const { useContext } = await import('react')
  const { SelectSurfaceContext } = await import('../../../Shared/UI/selectPlacement')
  return { OrdersFilterBar: () => <div data-testid='filter-surface'>{String(useContext(SelectSurfaceContext).fitTrigger)}</div> }
})
// redesign F6c: OrdersManager hosts the create-order form (CreateCustomOrderProvider); this suite is not about it.
vi.mock('../../CreateCustomOrder', () => ({ CreateCustomOrderProvider: ({ children }) => <>{children}</> }))
vi.mock('../../OrdersDashboardControls', () => ({ OrdersDashboardControls: () => null }))
vi.mock('../../OrdersDashboard', () => ({ OrdersDashboard: () => <div /> }))

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

describe('OrdersManager select surface (C18)', () => {
  it('opts the list, the order panel and the wizard in to the one dropdown anatomy', () => {
    window.scrollTo = vi.fn()
    render(
      <MemoryRouter initialEntries={['/orders?status=inProgress&id=5']}>
        <OrdersManager {...baseProps} />
      </MemoryRouter>
    )
    expect(screen.getByTestId('filter-surface')).toHaveTextContent('true')
    expect(screen.getByTestId('details-surface')).toHaveTextContent('true')
    expect(screen.getByTestId('wizard-surface')).toHaveTextContent('true')
  })
})
