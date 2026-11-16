/* eslint-disable import/first */
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ addQueryToUrl: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../../utils', () => ({ addQueryToUrl: runtime.addQueryToUrl }))

import { OrderStatusFilterBar, ORDERS_AMOUNT_UNAVAILABLE } from '..'
import { TabPanel } from '../../../Shared/Product'

const amounts = { pending: 3, inProgress: 12, completed: 0, cancelled: 5 }

const mount = (props = {}, route = '/orders') => {
  const changeOrderStatus = vi.fn()
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <OrderStatusFilterBar
        selectedOrderStatus='pending'
        changeOrderStatus={changeOrderStatus}
        ordersAmountByStatus={amounts}
        {...props}
      />
    </MemoryRouter>
  )
  return { changeOrderStatus, ...view }
}

describe('OrderStatusFilterBar · tabs', () => {
  beforeEach(() => {
    runtime.addQueryToUrl.mockClear()
    window.scrollTo = vi.fn()
  })

  it('is a tablist named Order status with the four statuses and their counts read as «3 orders»', () => {
    mount()
    const list = screen.getByRole('tablist', { name: 'Order status' })
    const tabs = within(list).getAllByRole('tab')
    expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false'])
    expect(tabs).toHaveLength(4)
    expect(within(list).getByRole('tab', { name: 'Pending 3 orders' })).toBeInTheDocument()
    expect(within(list).getByRole('tab', { name: 'In progress 12 orders' })).toBeInTheDocument()
    expect(within(list).getByRole('tab', { name: 'Completed 0 orders' })).toBeInTheDocument()
    expect(within(list).getByRole('tab', { name: 'Cancelled 5 orders' })).toBeInTheDocument()
  })

  it('keeps the e2e hook on the container', () => {
    const { container } = mount()
    const hook = container.querySelector('.order_status_filter')
    expect(hook).not.toBeNull()
    expect(within(hook).getByRole('tablist')).toBeInTheDocument()
  })

  // redesign bugs-d row 59 (deliveries Q-06): in a narrow list column (1280/1024) the four tabs break into lines instead of hiding «Cancelled» behind a scroll
  it('lets the tabs wrap instead of scrolling', () => {
    const { container } = mount()
    expect(container.querySelector('.order_status_filter')).toHaveAttribute('data-wrap', 'true')
  })

  it('marks the selected status', () => {
    mount({ selectedOrderStatus: 'inProgress' })
    expect(screen.getByRole('tab', { name: /In progress/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Pending/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('asks for attention only on Pending, and only when it is above zero', () => {
    const { container, rerender } = mount()
    const counts = [...container.querySelectorAll('.odc-count')]
    expect(counts.map(count => count.hasAttribute('data-attention'))).toEqual([true, false, false, false])
    rerender(
      <MemoryRouter initialEntries={['/orders']}>
        <OrderStatusFilterBar selectedOrderStatus='pending' changeOrderStatus={vi.fn()} ordersAmountByStatus={{ ...amounts, pending: 0 }} />
      </MemoryRouter>
    )
    expect(container.querySelector('.odc-count[data-attention]')).toBeNull()
  })

  it('while a total is null it shows a skeleton, not a spinner and not a zero', () => {
    const { container } = mount({ ordersAmountByStatus: { pending: null, inProgress: 4, completed: null, cancelled: null } })
    expect(container.querySelectorAll('.odc-skeleton')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: /^Pending$/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /In progress 4 orders/ })).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })

  // redesign 5.2 audit-1: one order reads «1 order», not «1 orders».
  it('reads a single order in the singular, and zero or many in the plural', () => {
    mount({ ordersAmountByStatus: { pending: 1, inProgress: 0, completed: 2, cancelled: 1 } })
    expect(screen.getByRole('tab', { name: 'Pending 1 order' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'In progress 0 orders' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Completed 2 orders' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Cancelled 1 order' })).toBeInTheDocument()
  })

  // redesign 5.2 audit-1: a list that failed to load leaves its counter as a dash, not a skeleton for ever.
  it('shows a dash, with a spoken «count unavailable», for a total the list could not load', () => {
    const { container } = mount({
      ordersAmountByStatus: { pending: ORDERS_AMOUNT_UNAVAILABLE, inProgress: 4, completed: null, cancelled: 0 }
    })
    const pending = screen.getByRole('tab', { name: 'Pending count unavailable' })
    expect(within(pending).getByText('—')).toBeInTheDocument()
    expect(pending.querySelector('.odc-skeleton')).toBeNull()
    // never asks for attention on a number nobody knows
    expect(pending.querySelector('.odc-count[data-attention]')).toBeNull()
    // the others keep their own state: a number, a skeleton while loading, a zero
    expect(screen.getByRole('tab', { name: 'In progress 4 orders' })).toBeInTheDocument()
    expect(container.querySelectorAll('.odc-skeleton')).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'Cancelled 0 orders' })).toBeInTheDocument()
  })

  it('changing the tab scrolls up, changes the group and writes ?status when it uses the query', async () => {
    const { changeOrderStatus } = mount({ isUseQuery: true }, '/orders?status=pending')
    changeOrderStatus.mockClear()
    runtime.addQueryToUrl.mockClear()
    await userEvent.setup().click(screen.getByRole('tab', { name: /Completed/ }))
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
    expect(changeOrderStatus).toHaveBeenCalledWith('completed')
    expect(runtime.addQueryToUrl).toHaveBeenCalledWith({ status: 'completed' })
  })

  it('without the query it changes the group and leaves the URL alone', async () => {
    const { changeOrderStatus } = mount({ isUseQuery: false })
    await userEvent.setup().click(screen.getByRole('tab', { name: /Cancelled/ }))
    expect(changeOrderStatus).toHaveBeenCalledWith('cancelled')
    expect(runtime.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('reads ?status on mount and when the URL changes', () => {
    const { changeOrderStatus } = mount({ isUseQuery: true }, '/orders?status=completed')
    expect(changeOrderStatus).toHaveBeenCalledWith('completed')
    expect(runtime.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('writes ?status=pending when the URL has none', () => {
    const { changeOrderStatus } = mount({ isUseQuery: true }, '/orders')
    expect(changeOrderStatus).not.toHaveBeenCalled()
    expect(runtime.addQueryToUrl).toHaveBeenCalledWith({ status: 'pending' })
  })

  it('arrows move the focus without reloading the list; Enter activates', async () => {
    const { changeOrderStatus } = mount()
    const user = userEvent.setup()
    act(() => screen.getByRole('tab', { name: /Pending/ }).focus())
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /In progress/ })).toHaveFocus()
    expect(changeOrderStatus).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(changeOrderStatus).toHaveBeenCalledWith('inProgress')
  })

  it('renders afterTabs between the tablist and the panel, and the panel is labelled by the selected tab', () => {
    mount({
      selectedOrderStatus: 'inProgress',
      afterTabs: <div data-testid='filters'>filters</div>,
      children: <TabPanel value='inProgress'><p>the list</p></TabPanel>
    })
    const tablist = screen.getByRole('tablist')
    const filters = screen.getByTestId('filters')
    const panel = screen.getByRole('tabpanel')
    expect(tablist.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(filters.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel).toHaveTextContent('the list')
    expect(panel).toHaveAccessibleName(/In progress/)
  })

  // The four lists keep fetching in the background (they feed the counts), so the one
  // panel around them must stay mounted while the selected tab changes.
  it('keeps the panel content mounted when the selected tab changes', () => {
    const mounted = vi.fn()
    const Probe = () => { React.useEffect(() => { mounted() }, []); return <p>the list</p> }
    const tree = status => (
      <MemoryRouter initialEntries={['/orders']}>
        <OrderStatusFilterBar selectedOrderStatus={status} changeOrderStatus={vi.fn()} ordersAmountByStatus={amounts}>
          <TabPanel value={status}><Probe /></TabPanel>
        </OrderStatusFilterBar>
      </MemoryRouter>
    )
    const { rerender } = render(tree('pending'))
    rerender(tree('inProgress'))
    rerender(tree('completed'))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('the list')
    expect(mounted).toHaveBeenCalledTimes(1)
  })

  it('neighbours that pass neither afterTabs nor children get the bare tabs', () => {
    mount()
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()
  })
})
