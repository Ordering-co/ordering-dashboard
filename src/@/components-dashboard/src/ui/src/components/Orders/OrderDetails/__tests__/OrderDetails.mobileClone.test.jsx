/* eslint-disable import/first */
// redesign 5.3: the panel is now a tabbed frame (header, tabs, one panel, footer). The old
// assertions about the chat/history/clone Modals and the third panel became assertions about
// the tabs, the `?section` URL contract and the clone Dialog. The file keeps its name so the
// diff stays readable. The tab contents (5.3-B and 5.3-C) are mocked here.
import React from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({
  user: { id: 1, level: 0 },
  tabProps: {},
  chatLifecycle: { mounts: 0, unmounts: 0 },
  footerProps: null,
  headerProps: null,
  addQueryToUrl: null,
  removeQueryToUrl: null
}))

runtime.addQueryToUrl = vi.fn()
runtime.removeQueryToUrl = vi.fn()

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: value => String(value) }],
  useSession: () => [{ user: runtime.user, token: null }],
  useApi: () => [null],
  OrderDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

vi.mock('../../../../utils', () => ({
  getOrderStatuPickUp: () => ({ percentage: 20 }),
  getOrderStatus: () => ({ percentage: 20 }),
  getOrderStatusPrefix: () => 'Pending',
  getCurrenySymbol: () => '$',
  addQueryToUrl: (...args) => runtime.addQueryToUrl(...args),
  removeQueryToUrl: (...args) => runtime.removeQueryToUrl(...args),
  getUserType: () => false
}))

vi.mock('react-hook-form', () => ({
  useForm: () => ({ register: vi.fn(), handleSubmit: fn => fn, formState: { errors: {} } })
}))

vi.mock('../../OrderDetailsHeader', () => ({
  OrderDetailsHeader: (props) => {
    runtime.headerProps = props
    return (
      <div data-testid='header'>
        <button type='button' onClick={() => props.handleShowOption('clone_order')}>Open clone</button>
        <button type='button' onClick={() => props.handleShowOption('chat')}>Open chat</button>
        <button type='button' onClick={() => props.handleShowOption('history')}>Open history</button>
        <button type='button' onClick={() => props.handleShowOption('metafields')}>Open fields</button>
        <button type='button' onClick={() => props.actionSidebar(false)}>Close panel</button>
        <button type='button' onClick={() => props.setIsExpand(prev => !prev)}>Toggle expand</button>
      </div>
    )
  }
}))

vi.mock('../DetailsTab', () => ({
  DetailsTab: (props) => { runtime.tabProps.details = props; return <div data-testid='tab-details'>details content</div> }
}))
vi.mock('../ActivityTab', () => ({
  ActivityTab: (props) => { runtime.tabProps.activity = props; return <div data-testid='tab-activity'>activity content</div> }
}))
vi.mock('../ChatTab', () => ({
  ChatTab: (props) => {
    runtime.tabProps.chat = props
    React.useEffect(() => {
      runtime.chatLifecycle.mounts += 1
      return () => { runtime.chatLifecycle.unmounts += 1 }
    }, [])
    return <div data-testid='tab-chat'>chat content</div>
  }
}))
// The panel's one Messages controller (parity audit 2) is not under test here: the tabs are mocked.
vi.mock('../OrderMessages', () => ({ OrderMessagesProvider: ({ children }) => children }))
vi.mock('../FieldsTab', () => ({
  FieldsTab: (props) => { runtime.tabProps.fields = props; return <div data-testid='tab-fields'>fields content</div> }
}))
vi.mock('../DetailsFooter', () => ({
  DetailsFooter: (props) => {
    runtime.footerProps = props
    return <div data-testid='footer'>footer</div>
  }
}))

vi.mock('../../CloneOrder', () => ({
  CloneOrder: () => <div data-testid='clone-order'>Clone order content</div>
}))
vi.mock('../../OrderToPrint', () => {
  const OrderToPrint = React.forwardRef(function OrderToPrintMock () { return null })
  return { OrderToPrint }
})
vi.mock('../../OrderToPrintTicket', () => {
  const OrderToPrintTicket = React.forwardRef(function OrderToPrintTicketMock () { return null })
  return { OrderToPrintTicket }
})

vi.mock('../../../Shared', () => ({
  Modal: ({ open, children }) => open ? <div role='dialog' aria-label='legacy'>{children}</div> : null,
  Alert: () => null
}))

vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  TextArea: (props) => <textarea {...props} />
}))

import { OrderDetails } from '..'

const baseOrder = { id: 42, customer_id: 7, products: [], delivery_type: 1, status: 0, unread_count: 0 }

const renderOrderDetails = ({ order = baseOrder, loading = false, search = '', layout, ...props } = {}) => {
  const handlers = {
    onClose: vi.fn(),
    handleBackRedirect: vi.fn(),
    setCurrentTourStep: vi.fn(),
    setIsTourOpen: vi.fn()
  }
  const view = renderWithProviders(
    <OrderDetails
      open
      layout={layout}
      order={{ loading, order }}
      messages={{ messages: [] }}
      setIsTourFlag={vi.fn()}
      handleCloneOrder={vi.fn()}
      setCloneState={vi.fn()}
      cloneState={{ type: 1, loading: false }}
      {...handlers}
      {...props}
    />,
    { initialEntries: [`/orders${search}`] }
  )
  return { ...view, ...handlers }
}

const tablist = () => screen.getByRole('tablist', { name: 'Order sections' })

describe('OrderDetails frame · tabs and layouts (redesign 5.3-A)', () => {
  // fila 48: the panel is a lazy chunk (OrderDetailsLazy). The first test waits for it with `findByRole` (1 s) and every
  // later test reads the tabs synchronously, relying on that first one having resolved it. Importing the module graph once up front
  // (1.1 s on a loaded machine, past that 1 s) moves the cost out of the test; the assertions and their limits are untouched.
  beforeAll(async () => { await import('../OrderDetailsPanel') }, 60_000)

  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.tabProps = {}
    runtime.footerProps = null
    runtime.addQueryToUrl.mockClear()
    runtime.removeQueryToUrl.mockClear()
  })

  it('draws header, four tabs, one panel with Details and the footer', async () => {
    renderOrderDetails()
    // fila 48: the first mount of the lazy panel in this file is cold (1.4 s with the module already imported, on a loaded
    // machine), past the 1 s `findBy` default; the wait is for the same dialog, only longer. The rest of the file reads the tabs
    // synchronously because this test left the lazy chunk resolved.
    await screen.findByRole('dialog', { name: 'Order 42' }, { timeout: 10_000 })

    expect(screen.getByTestId('header')).toBeInTheDocument()
    const names = within(tablist()).getAllByRole('tab').map(tab => tab.textContent)
    expect(names).toEqual(['Details', 'Activity', 'Chat', 'Custom fields'])
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(within(screen.getByRole('tabpanel')).getByTestId('tab-details')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('hands every tab the props of the panel plus onSelectTab, and keeps the order controller shape', () => {
    renderOrderDetails({ layout: 'split' })

    expect(runtime.tabProps.details.order).toEqual({ loading: false, order: baseOrder })
    expect(runtime.tabProps.details.messages).toEqual({ messages: [] })
    expect(typeof runtime.tabProps.details.onSelectTab).toBe('function')
    expect(typeof runtime.footerProps.onSelectTab).toBe('function')

    act(() => runtime.tabProps.details.onSelectTab('chat'))
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true')
    expect(runtime.tabProps.chat.order).toEqual({ loading: false, order: baseOrder })
  })

  it('split layout is only the content: no dialog of its own; overlay is a Sheet with focus and Escape', async () => {
    const split = renderOrderDetails({ layout: 'split' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(tablist()).toBeInTheDocument()
    expect(document.getElementById('orderDetails')).not.toBeNull()
    split.unmount()

    const overlay = renderOrderDetails()
    const sheet = await screen.findByRole('dialog', { name: 'Order 42' })
    expect(within(sheet).getByRole('tablist', { name: 'Order sections' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(overlay.onClose).toHaveBeenCalledTimes(1)
    expect(overlay.setIsTourOpen).toHaveBeenCalledWith(false)
  })

  it('Chat shows the unread count with a readable name and is hidden for level 5', () => {
    renderOrderDetails({ layout: 'split', order: { ...baseOrder, unread_count: 3 } })
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveTextContent('3 unread messages')
  })

  it('hides the Chat tab for level 5, like the old button', () => {
    runtime.user = { id: 1, level: 5 }
    renderOrderDetails({ layout: 'split' })
    expect(screen.queryByRole('tab', { name: /Chat/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('keeps data-tour on the panel content and the panel id used by the e2e specs', () => {
    renderOrderDetails({ layout: 'split' })
    expect(document.querySelector('[data-tour="tour_detail"]')).not.toBeNull()
    expect(document.getElementById('orderDetails')).not.toBeNull()
  })

  it('shows a skeleton shaped like the panel while loading, with a way out', () => {
    const view = renderOrderDetails({ layout: 'split', loading: true, order: null })
    expect(document.getElementById('orderDetails')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(view.onClose).toHaveBeenCalledTimes(1)
  })

  it('says the order was not found and offers the way back', () => {
    const view = renderOrderDetails({ layout: 'split', loading: false, order: null })
    expect(screen.getByText("Sorry, we couldn't find the requested order.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to Orders' }))
    expect(view.handleBackRedirect).toHaveBeenCalledTimes(1)
  })
})

describe('OrderDetails frame · the ?section contract', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.tabProps = {}
    runtime.addQueryToUrl.mockClear()
    runtime.removeQueryToUrl.mockClear()
  })

  it.each([
    ['Activity', 'history'],
    ['Chat', 'chat'],
    ['Custom fields', 'metafields']
  ])('selecting %s writes ?section=%s', async (name, section) => {
    renderOrderDetails({ layout: 'split' })
    await userEvent.click(screen.getByRole('tab', { name }))
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
    expect(runtime.addQueryToUrl).toHaveBeenLastCalledWith({ section })
  })

  it('selecting Details clears section and tab', async () => {
    renderOrderDetails({ layout: 'split', search: '?section=chat' })
    await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
    expect(runtime.removeQueryToUrl).toHaveBeenLastCalledWith(['section', 'tab'])
  })

  it.each([
    ['chat', 'Chat'],
    ['history', 'Activity'],
    ['metafields', 'Custom fields']
  ])('?section=%s opens the %s tab without rewriting the URL', (section, name) => {
    renderOrderDetails({ layout: 'split', search: `?section=${section}` })
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
    expect(runtime.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('leaving Activity drops the activity filter from the URL before writing the new section', async () => {
    renderOrderDetails({ layout: 'split', search: '?section=history&tab=logistics' })
    await userEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    expect(runtime.removeQueryToUrl).toHaveBeenCalledWith(['tab'])
    expect(runtime.addQueryToUrl).toHaveBeenLastCalledWith({ section: 'chat' })
  })

  it('the header opens the same tabs through handleShowOption', () => {
    renderOrderDetails({ layout: 'split' })
    fireEvent.click(screen.getByRole('button', { name: 'Open fields' }))
    expect(screen.getByRole('tab', { name: 'Custom fields' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Open history' }))
    expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true')
  })

  it('closing the panel clears section and tab and calls onClose', () => {
    const view = renderOrderDetails({ layout: 'split', search: '?section=chat&tab=order_history' })
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(runtime.removeQueryToUrl).toHaveBeenCalledWith(['section', 'tab'])
    expect(view.onClose).toHaveBeenCalledTimes(1)
  })
})

// inside a user's record (isSelectedOrders) `section` and `tab` are the record's (?section=orders, ?tab=orders):
// the order keeps its tab in memory and never writes, reads or clears them
describe('OrderDetails frame · inside a user record the URL is the record\'s', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.tabProps = {}
    runtime.addQueryToUrl.mockClear()
    runtime.removeQueryToUrl.mockClear()
  })

  it('changing tabs does not write ?section', async () => {
    renderOrderDetails({ isSelectedOrders: true, search: '?id=133&section=orders' })
    await userEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
    expect(runtime.addQueryToUrl).not.toHaveBeenCalled()
    expect(runtime.removeQueryToUrl).not.toHaveBeenCalled()
  })

  it('closing keeps the record\'s section and tab and still calls onClose', () => {
    const view = renderOrderDetails({ isSelectedOrders: true, search: '?id=9406&tab=orders' })
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(runtime.removeQueryToUrl).not.toHaveBeenCalled()
    expect(view.onClose).toHaveBeenCalledTimes(1)
  })

  it('the record\'s ?section is not read as an order tab', () => {
    renderOrderDetails({ isSelectedOrders: true, search: '?id=133&section=chat' })
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
  })

  it('the clone dialog does not write ?section either', () => {
    renderOrderDetails({ isSelectedOrders: true, search: '?id=133&section=orders' })
    fireEvent.click(screen.getByRole('button', { name: 'Open clone' }))
    expect(runtime.addQueryToUrl).not.toHaveBeenCalled()
  })
})

describe('OrderDetails frame · clone dialog', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.addQueryToUrl.mockClear()
    runtime.removeQueryToUrl.mockClear()
  })

  it('Open clone shows CloneOrder in a small dialog and writes ?section=clone_order', async () => {
    renderOrderDetails({ layout: 'split' })
    expect(screen.queryByTestId('clone-order')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open clone' }))
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    expect(within(dialog).getByTestId('clone-order')).toBeInTheDocument()
    expect(runtime.addQueryToUrl).toHaveBeenLastCalledWith({ section: 'clone_order' })
  })

  it('?section=clone_order opens the dialog on load and closing it clears the section', async () => {
    renderOrderDetails({ layout: 'split', search: '?section=clone_order' })
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    expect(runtime.addQueryToUrl).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Clone order' })).not.toBeInTheDocument()
    expect(runtime.removeQueryToUrl).toHaveBeenLastCalledWith(['section', 'tab'])
  })

  it('closing the dialog while another tab is open puts that tab back in the URL', async () => {
    renderOrderDetails({ layout: 'split', search: '?section=chat' })
    fireEvent.click(screen.getByRole('button', { name: 'Open clone' }))
    const dialog = await screen.findByRole('dialog', { name: 'Clone order' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(runtime.addQueryToUrl).toHaveBeenLastCalledWith({ section: 'chat' })
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true')
  })

  it.each([
    ['an order that is already a clone', { ...baseOrder, cloned_order_id: 9 }],
    ['an order without customer', { ...baseOrder, customer_id: null }]
  ])('never draws CloneOrder for %s', async (_, order) => {
    renderOrderDetails({ layout: 'split', order })
    fireEvent.click(screen.getByRole('button', { name: 'Open clone' }))
    expect(screen.queryByTestId('clone-order')).not.toBeInTheDocument()
  })
})

describe('OrderDetails frame · expand and the Learn tour', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.tabProps = {}
    vi.useRealTimers()
  })

  it('owns the expanded flag when nobody controls it and tells the tabs', () => {
    renderOrderDetails({ layout: 'split' })
    expect(runtime.headerProps.isExpand).toBe(false)
    expect(runtime.tabProps.details.expanded).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Toggle expand' }))
    expect(runtime.headerProps.isExpand).toBe(true)
    expect(runtime.tabProps.details.expanded).toBe(true)
  })

  it('a controlled expanded flag goes through onExpandedChange (the SplitView owns it)', () => {
    const onExpandedChange = vi.fn()
    renderOrderDetails({ layout: 'split', expanded: false, onExpandedChange })
    fireEvent.click(screen.getByRole('button', { name: 'Toggle expand' }))
    expect(onExpandedChange).toHaveBeenCalledWith(true)
    expect(runtime.headerProps.isExpand).toBe(false)
  })

  // redesign fix-qa E8: the tab is written to window.history (addQueryToUrl) and the router's location does not follow it.
  // Opening as a page (and back) mounts the panel in another place, so it remounts: it has to open on the tab the address
  // bar says, not on the section the router saw when the panel first opened («Back to split view» landed on Details).
  describe('remounting while the address bar and the router disagree', () => {
    const address = url => window.history.replaceState(null, '', url)
    afterEach(() => address('/'))

    it('opens on the tab the address bar says', () => {
      address('/orders?id=42&section=history')
      renderOrderDetails({ layout: 'split', search: '' })
      expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true')
      expect(runtime.addQueryToUrl).not.toHaveBeenCalled()
    })

    it('opens on Details when the address bar has the order but no section, even if the router still has one', () => {
      address('/orders?id=42')
      renderOrderDetails({ layout: 'split', search: '?section=chat' })
      expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
    })

    it('falls back to the router when the address bar says nothing (a memory router)', () => {
      renderOrderDetails({ layout: 'split', search: '?section=metafields' })
      expect(screen.getByRole('tab', { name: 'Custom fields' })).toHaveAttribute('aria-selected', 'true')
    })

    it('does not open the Chat tab for level 5, which has none', () => {
      runtime.user = { id: 1, level: 5 }
      address('/orders?id=42&section=chat')
      renderOrderDetails({ layout: 'split', search: '' })
      expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('the overlay sheet takes the whole width when expanded', async () => {
    renderOrderDetails()
    const sheet = await screen.findByRole('dialog', { name: 'Order 42' })
    expect(sheet).not.toHaveAttribute('data-expanded')
    fireEvent.click(screen.getByRole('button', { name: 'Toggle expand' }))
    expect(sheet).toHaveAttribute('data-expanded')
  })

  it('during the tour a click in the panel moves to the Chat tab and to step 3', () => {
    vi.useFakeTimers()
    const view = renderOrderDetails({
      layout: 'split',
      order: { ...baseOrder, delivery_type: 2 },
      isTourOpen: true,
      currentTourStep: 1
    })
    fireEvent.click(document.querySelector('[data-tour="tour_detail"]'))
    act(() => { vi.advanceTimersByTime(5) })
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveAttribute('aria-selected', 'true')
    expect(view.setCurrentTourStep).toHaveBeenCalledWith(3)
    vi.useRealTimers()
  })

  it('the tour on a delivery order goes to step 2 first', () => {
    const view = renderOrderDetails({ layout: 'split', isTourOpen: true, currentTourStep: 1 })
    fireEvent.click(document.querySelector('[data-tour="tour_detail"]'))
    expect(view.setCurrentTourStep).toHaveBeenCalledWith(2)
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true')
  })
})

// redesign fix-qa E6 (parity with main, where the chat was a panel next to the detail): switching
// tab must not lose the draft, the attached image or the chosen recipients, which live inside the
// chat. The chat stays mounted (hidden) while another tab shows; it is told whether it is the one
// on screen so it only marks messages as read when the user can see them.
describe('OrderDetails frame · the chat stays mounted across tabs (fix-qa E6)', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.tabProps = {}
    runtime.chatLifecycle = { mounts: 0, unmounts: 0 }
  })

  it('mounts the chat once, hidden, and shows it with Chat without remounting', () => {
    renderOrderDetails({ layout: 'split' })
    expect(runtime.chatLifecycle).toEqual({ mounts: 1, unmounts: 0 })
    const chat = screen.getByTestId('tab-chat', { hidden: true })
    expect(chat.closest('[hidden]')).not.toBeNull()
    expect(runtime.tabProps.chat.active).toBe(false)

    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    expect(screen.getByTestId('tab-chat').closest('[hidden]')).toBeNull()
    expect(runtime.tabProps.chat.active).toBe(true)
    expect(runtime.chatLifecycle).toEqual({ mounts: 1, unmounts: 0 })
  })

  it('Details, Activity and Chat and back: still one chat instance, never remounted', () => {
    renderOrderDetails({ layout: 'split' })
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }))
    expect(screen.getByTestId('tab-chat', { hidden: true }).closest('[hidden]')).not.toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    expect(runtime.chatLifecycle).toEqual({ mounts: 1, unmounts: 0 })
  })

  it('keeps exactly one tab panel and the other tabs are still unmounted', () => {
    renderOrderDetails({ layout: 'split' })
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    expect(screen.queryByTestId('tab-activity')).toBeNull()
    expect(screen.queryByTestId('tab-fields')).toBeNull()
  })

  it('level 5 has no chat at all, mounted or not', () => {
    runtime.user = { id: 1, level: 5 }
    renderOrderDetails({ layout: 'split' })
    expect(screen.queryByTestId('tab-chat', { hidden: true })).toBeNull()
    expect(runtime.chatLifecycle.mounts).toBe(0)
  })

  it('the chat goes away with the panel', () => {
    const view = renderOrderDetails({ layout: 'split' })
    expect(runtime.chatLifecycle.mounts).toBe(1)
    view.unmount()
    expect(runtime.chatLifecycle.unmounts).toBe(1)
  })
})
