/* eslint-disable import/first */
// redesign W1-5 (T1-5-4): /all-in-one, what the page hands down and what it draws.
//  - P8: the page keeps its own sub-bar controls and never hands the bulk handlers to the list, so the list draws no second
//    SelectionBar. It was implicit (it depended on three props not being passed); now a test reads the mount.
//  - «Export filtered» (defect of main): the page passed no `ordersStatusGroup` / `selectedSubOrderStatus` to the controls, so the
//    tab picker started empty and the export threw a TypeError. It passes them, as /orders does.
//  - Two `Alert`s read the same state (defect of main): «One order is required» opened two dialogs at once. One dialog, with «Accept».
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ header: null, controls: null, exportProps: null, dashboard: null }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {} }],
  useSession: () => [{ user: { level: 0 } }],
  useApi: () => [{ project: 'demo' }],
  OrdersManage: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
// The Product alert reads the catalog for the messages the API sends as keys; here it has none.
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))
vi.mock('../../../utils', async () => ({
  ...(await vi.importActual('../../../utils')),
  learnOptionsValues: () => []
}))
vi.mock('~/analytics/useTrackedLoadState', () => ({ useTrackedLoadState: () => {} }))

// The neighbours of the page: this suite is about what AllInOne wires, not about them.
vi.mock('../OrdersContentHeader', () => ({ OrdersContentHeader: (props) => { runtime.header = props; return <div data-testid='header' /> } }))
vi.mock('../OrderNotification', () => ({ OrderNotificationSlot: () => null }))
vi.mock('../AllInOne/DriversManager', () => ({ DriversManager: () => <div data-testid='drivers-manager' /> }))
vi.mock('../DriversLocation', () => ({ DriversLocation: () => <div data-testid='drivers-map' /> }))
vi.mock('../OrderStatusFilterBar', async (importOriginal) => ({
  ...(await importOriginal()),
  OrderStatusFilterBar: () => <div data-testid='status-tabs' />
}))
vi.mock('../OrderStatusSubFilter', async (importOriginal) => ({
  ...(await importOriginal()),
  OrderStatusSubFilter: () => <div data-testid='sub-filter' />
}))
vi.mock('../OrderDetails', () => ({ OrderDetails: () => null }))
vi.mock('../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))
vi.mock('../WizardOrders', () => ({ WizardOrders: () => null }))
// The sub-bar controls are real; what they put on screen is mocked at the leaves.
vi.mock('../CreateCustomOrder', () => ({ CreateCustomOrder: () => <button type='button'>Create custom order</button> }))
vi.mock('../OrdersExportCSV', () => ({ OrdersExportCSV: (props) => { runtime.exportProps = props; return <button type='button'>Export</button> } }))
vi.mock('../OrderDelete', () => ({ OrderDelete: () => <button type='button'>Delete</button> }))
vi.mock('../OrderStatusTypeSelector', () => ({ OrderStatusTypeSelector: () => <button type='button'>Change status</button> }))
vi.mock('../OrdersTable', () => ({ OrdersTable: () => <div data-testid='table' /> }))
vi.mock('../OrdersCards', () => ({ OrdersCards: () => <div data-testid='cards' /> }))
// OrdersDashboard hands everything it gets to the list; the stand-in mounts the REAL list with those props, so the test sees
// whether the list draws a SelectionBar for what /all-in-one gives it.
vi.mock('../OrdersDashboard', async () => {
  const { OrdersListing } = await import('../OrdersListing')
  return {
    OrdersDashboard: (props) => {
      runtime.dashboard = props
      return (
        <OrdersListing
          {...props}
          orderList={{ loading: false, orders: [{ id: 1 }, { id: 2 }] }}
          pagination={{ total: 2, currentPage: 1, pageSize: 10 }}
          groupStatus={props.ordersStatusGroup}
          orderListView='table'
          allowColumns={{}}
          getPageOrders={vi.fn()}
        />
      )
    }
  }
})

import { AllInOne } from '../AllInOne'

const handlers = {
  handleChangeMultiOrdersStatus: vi.fn(),
  handleDeleteMultiOrders: vi.fn()
}

const baseProps = {
  isUseQuery: true,
  ordersStatusGroup: 'inProgress',
  selectedSubOrderStatus: { inProgress: [4, 7] },
  handleSelectedSubOrderStatus: vi.fn(),
  handleOrdersStatusGroupFilter: vi.fn(),
  handleChangeFilterValues: vi.fn(),
  handleChangeSearch: vi.fn(),
  handleSelectedOrderIds: vi.fn(),
  setSelectedOrderIds: vi.fn(),
  setDetailsOrder: vi.fn(),
  setMapsData: vi.fn(),
  onOrderRedirect: vi.fn(),
  driversList: { drivers: [] },
  mapsData: {},
  selectedOrderIds: [],
  filterValues: { statuses: [] },
  searchValue: '',
  allowColumns: {},
  setAllowColumns: vi.fn(),
  ...handlers
}

const mount = (props = {}) => render(
  <ThemeProvider theme={{ colors: {} }}>
    <MemoryRouter initialEntries={['/all-in-one']}>
      <AllInOne {...baseProps} {...props} />
    </MemoryRouter>
  </ThemeProvider>
)

beforeEach(() => {
  runtime.header = null
  runtime.controls = null
  runtime.exportProps = null
  runtime.dashboard = null
  window.scrollTo = vi.fn()
})

describe('W1-5 (P8): /all-in-one has its own selection controls and no second SelectionBar', () => {
  it('hands the bulk handlers to the head and to the sub-bar controls, never to the list', () => {
    mount()
    expect(runtime.header.handleChangeMultiOrdersStatus).toBe(handlers.handleChangeMultiOrdersStatus)
    expect(runtime.header.handleDeleteMultiOrders).toBe(handlers.handleDeleteMultiOrders)
    // The list gets the selection, not the actions that would draw a bar whose buttons the page does not own.
    expect(runtime.dashboard).toBeTruthy()
    expect(runtime.dashboard.handleChangeMultiOrdersStatus).toBeUndefined()
    expect(runtime.dashboard.handleDeleteMultiOrders).toBeUndefined()
    expect(runtime.dashboard.selectedOrderIds).toEqual([])
  })

  it('with rows selected there is no SelectionBar, and the sub-bar shows its delete and bulk-status controls', () => {
    mount({ selectedOrderIds: [1, 2] })
    expect(screen.queryByRole('region', { name: 'Actions for selected orders' })).toBeNull()
    const subBar = screen.getByRole('button', { name: 'Create custom order' }).parentElement
    expect(within(subBar).getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(within(subBar).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(subBar).getByRole('button', { name: 'Change status' })).toBeInTheDocument()
  })

  it('with nothing selected the sub-bar has no bulk controls either', () => {
    mount({ selectedOrderIds: [] })
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change status' })).toBeNull()
  })
})

describe('W1-5: «Export filtered» on /all-in-one knows the tab and its sub-statuses', () => {
  it('passes ordersStatusGroup and selectedSubOrderStatus to the controls, as /orders does', () => {
    mount()
    expect(runtime.exportProps.ordersStatusGroup).toBe('inProgress')
    expect(runtime.exportProps.selectedSubOrderStatus).toEqual({ inProgress: [4, 7] })
    expect(runtime.exportProps.filterValues).toEqual({ statuses: [] })
  })
})

describe('W1-5: «One order is required» opens one dialog, not two', () => {
  const openAlert = () => {
    // The tour looks for the first row of the list; the mocked list has none, as an empty one.
    act(() => { runtime.header.handleOpenTour() })
  }

  it('shows a single alert dialog with the title, the text and «Accept»', async () => {
    mount()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    openAlert()
    const dialogs = await screen.findAllByRole('alertdialog')
    expect(dialogs).toHaveLength(1)
    expect(screen.getAllByText('One order is required')).toHaveLength(1)
    // redesign all-in-one B2 (decision 5, AIO-06): the title of the dialog is «All in one», as the menu and ⌘K say (was «Orders manager»)
    expect(screen.getAllByText('All in one')).toHaveLength(1)
    expect(within(dialogs[0]).getByText('All in one')).toBeInTheDocument()
    expect(within(dialogs[0]).getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  it('«Accept» closes it', async () => {
    const user = userEvent.setup()
    mount()
    openAlert()
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})
