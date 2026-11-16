/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign messages B3b: the /messages inbox page. ConversationList (B3a) and ConversationChat (B1) are mocked against their
// contracts; the header and the draft store are the real ones.
const runtime = vi.hoisted(() => ({ list: null, chat: null, orders: [], mounts: [], phone: false, configs: {}, router: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (key, fallback) => fallback || key],
  useConfig: () => [{ configs: runtime.configs }],
  useUtils: () => [{ parsePrice: value => `$${value}` }]
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => runtime.phone }))
vi.mock('../ConversationList', () => ({
  ConversationList: props => {
    runtime.list = props
    const announced = React.useRef(false)
    React.useEffect(() => {
      props.onOrdersChange?.(runtime.orders)
    }, [])
    React.useEffect(() => {
      if (props.autoSelectFirst && props.selectedId == null && runtime.orders.length && !announced.current) {
        announced.current = true
        props.onSelect(runtime.orders[0], { byUser: false })
      }
    })
    return (
      <ul data-testid='conversation-list' data-show-business={String(props.showBusiness)}>
        {runtime.orders.map(order => (
          <li key={order.id}>
            <button type='button' aria-current={props.selectedId === order.id ? 'true' : undefined} onClick={() => props.onSelect(order, { byUser: true })}>
              {`Open order ${order.id}`}
            </button>
          </li>
        ))}
      </ul>
    )
  }
}))
vi.mock('../../OrderDetails/ChatTab', () => ({
  ConversationChat: props => {
    runtime.chat = props
    const [text, setText] = React.useState(props.initialDraft?.text ?? '')
    React.useEffect(() => {
      runtime.mounts.push(props.order.id)
    }, [])
    return (
      <section
        aria-label={`chat ${props.order.id}`}
        data-status={props.order.status}
        data-engaged={String(props.engaged)}
        data-read-policy={props.readPolicy}
        data-recipients={JSON.stringify(props.initialDraft?.recipients ?? null)}
      >
        <input
          aria-label='draft'
          value={text}
          onChange={event => { setText(event.target.value); props.onDraftChange(props.order.id, { text: event.target.value, image: null, recipients: null }) }}
        />
        {/* redesign messages R1 (Q-01): the chat reports the recipients it has (decision 5A), here «store only» */}
        <button type='button' onClick={() => props.onDraftChange(props.order.id, { text: '', image: null, recipients: STORE_ONLY })}>Store only</button>
        <button type='button' onClick={() => props.handleUpdateOrderForUnreadCount(props.order.id)}>Report read</button>
        {/* redesign messages R2.2 (M-08): the chat controller calls it with null first, then with the id, in the same tick */}
        <button type='button' onClick={() => props.handleUpdateOrderForUnreadCount(null)}>Report null</button>
        <button type='button' onClick={() => { props.handleUpdateOrderForUnreadCount(null); props.handleUpdateOrderForUnreadCount(props.order.id) }}>Report read as the controller</button>
      </section>
    )
  }
}))

const STORE_ONLY = { administrator: true, business: true, customer: false, driver: true }

import { Inbox } from '../Inbox'
import { ConversationHeader } from '../ConversationHeader'
import { useConversationDrafts } from '../useConversationDrafts'

const makeOrder = (id, extra = {}) => ({
  id,
  status: 7,
  delivery_type: 1,
  customer: { name: 'Ada', lastname: `Lovelace ${id}`, address: '1 Main St' },
  business: { name: `Store ${id}` },
  driver: null,
  summary: { total: 25 },
  ...extra
})

// redesign messages R1 (Q-05): the inbox reads and writes the history on a phone, so it lives inside a router. `runtime.router` holds the
// history and the location the router has right now.
const RouterProbe = () => <Route render={({ history, location }) => { runtime.router = { history, location }; return null }} />
const inRouter = (element, entry = '/messages') => <MemoryRouter initialEntries={[entry]}>{element}<RouterProbe /></MemoryRouter>
const baseProps = { searchValue: '', filterValues: {}, driversList: { drivers: [] }, onOpenOrder: vi.fn(), showBusiness: true }
const renderInbox = (props = {}, entry) => {
  const view = render(inRouter(<Inbox {...baseProps} {...props} />, entry))
  return { ...view, rerenderInbox: next => view.rerender(inRouter(<Inbox {...baseProps} {...props} {...next} />, entry)) }
}
const rowOf = id => screen.getByRole('button', { name: `Open order ${id}` })

beforeEach(() => {
  runtime.list = runtime.chat = null
  runtime.orders = [makeOrder(1), makeOrder(2)]
  runtime.mounts = []
  runtime.phone = false
  runtime.configs = {}
  runtime.router = null
})

describe('Inbox, 768px and up', () => {
  it('auto-selects the first conversation without engaging it, and a row click engages it', async () => {
    const user = userEvent.setup()
    renderInbox()
    expect(runtime.list.autoSelectFirst).toBe(true)
    expect(screen.getByRole('region', { name: 'chat 1' })).toHaveAttribute('data-engaged', 'false')
    expect(screen.getByRole('region', { name: 'chat 1' })).toHaveAttribute('data-read-policy', 'interaction')
    await user.click(rowOf(1))
    expect(screen.getByRole('region', { name: 'chat 1' })).toHaveAttribute('data-engaged', 'true')
    expect(rowOf(1)).toHaveAttribute('aria-current', 'true')
  })

  it('starts on the active scope, newest message first, and follows the list handlers', () => {
    renderInbox()
    expect(runtime.list.scope).toBe('active')
    expect(runtime.list.sort).toBe('last_direct_message_at')
    act(() => runtime.list.onScopeChange('all'))
    expect(runtime.list.scope).toBe('all')
    act(() => runtime.list.onSortChange('id'))
    expect(runtime.list.sort).toBe('id')
  })

  it('passes the search, filters and showBusiness through to the list', () => {
    const filterValues = { statuses: [1] }
    const { rerenderInbox } = renderInbox({ searchValue: 'ada', filterValues, showBusiness: false })
    expect(runtime.list).toMatchObject({ searchValue: 'ada', filterValues, showBusiness: false })
    expect(screen.getByTestId('conversation-list')).toHaveAttribute('data-show-business', 'false')
    rerenderInbox({ showBusiness: true })
    expect(screen.getByTestId('conversation-list')).toHaveAttribute('data-show-business', 'true')
  })

  it('keys the chat by the order and hands it the live order when the list brings a new status', async () => {
    const user = userEvent.setup()
    renderInbox()
    expect(runtime.mounts).toEqual([1])
    act(() => runtime.list.onOrdersChange([makeOrder(1, { status: 3 }), makeOrder(2)]))
    expect(screen.getByRole('region', { name: 'chat 1' })).toHaveAttribute('data-status', '3')
    expect(runtime.mounts).toEqual([1]) // same conversation: not mounted again
    await user.click(rowOf(2))
    expect(runtime.mounts).toEqual([1, 2])
    expect(screen.queryByRole('region', { name: 'chat 1' })).not.toBeInTheDocument()
  })

  it('keeps the last snapshot when the open order leaves the list', () => {
    renderInbox()
    act(() => runtime.list.onOrdersChange([makeOrder(2)]))
    expect(screen.getByRole('region', { name: 'chat 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Ada')
  })

  it('keeps each conversation draft across a switch A to B to A', async () => {
    const user = userEvent.setup()
    renderInbox()
    await user.type(screen.getByLabelText('draft'), 'on my way')
    await user.click(rowOf(2))
    expect(screen.getByLabelText('draft')).toHaveValue('')
    await user.click(rowOf(1))
    expect(screen.getByLabelText('draft')).toHaveValue('on my way')
  })

  // redesign messages R1 (Q-01): the draft carries the recipients, so a «store only» note is not widened to the customer on the way back
  it('restores the recipients of a conversation after a switch A to B to A: customer stays off', async () => {
    const user = userEvent.setup()
    renderInbox()
    expect(screen.getByRole('region', { name: 'chat 1' })).toHaveAttribute('data-recipients', 'null')
    await user.click(screen.getByRole('button', { name: 'Store only' }))
    await user.click(rowOf(2))
    expect(screen.getByRole('region', { name: 'chat 2' })).toHaveAttribute('data-recipients', 'null')
    await user.click(rowOf(1))
    expect(JSON.parse(screen.getByRole('region', { name: 'chat 1' }).getAttribute('data-recipients'))).toEqual(STORE_ONLY)
  })

  it('does not mount the chat while the order panel is open, and brings it back with its draft', async () => {
    const user = userEvent.setup()
    const { rerenderInbox } = renderInbox()
    await user.type(screen.getByLabelText('draft'), 'later')
    rerenderInbox({ orderDetailOpen: true })
    expect(screen.queryByRole('region', { name: 'chat 1' })).not.toBeInTheDocument()
    rerenderInbox({ orderDetailOpen: false })
    expect(screen.getByRole('region', { name: 'chat 1' })).toBeInTheDocument()
    expect(screen.getByLabelText('draft')).toHaveValue('later')
  })

  // redesign messages R2.2 (M-08): the inbox tells the list with a signal { orderId, seq }, a new seq on every read, so a second read of
  // the same conversation reaches the list
  it('tells the list which order was read with a signal that has a new seq on every read, the same order too', async () => {
    const user = userEvent.setup()
    renderInbox()
    expect(runtime.list.unreadResetSignal ?? null).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Report read' }))
    expect(runtime.list.unreadResetSignal).toEqual({ orderId: 1, seq: 1 })
    await user.click(screen.getByRole('button', { name: 'Report read' }))
    expect(runtime.list.unreadResetSignal).toEqual({ orderId: 1, seq: 2 })
  })

  it('ignores null: the chat resets with null and then the id, and the list gets one new seq', async () => {
    const user = userEvent.setup()
    renderInbox()
    await user.click(screen.getByRole('button', { name: 'Report null' }))
    expect(runtime.list.unreadResetSignal ?? null).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Report read as the controller' }))
    expect(runtime.list.unreadResetSignal).toEqual({ orderId: 1, seq: 1 })
    await user.click(screen.getByRole('button', { name: 'Report null' }))
    expect(runtime.list.unreadResetSignal).toEqual({ orderId: 1, seq: 1 })
    await user.click(screen.getByRole('button', { name: 'Report read as the controller' }))
    expect(runtime.list.unreadResetSignal).toEqual({ orderId: 1, seq: 2 })
  })

  it('does not hand the list the old orderIdForUnreadCountUpdate any more', async () => {
    const user = userEvent.setup()
    renderInbox()
    await user.click(screen.getByRole('button', { name: 'Report read' }))
    expect(runtime.list.orderIdForUnreadCountUpdate).toBeUndefined()
  })

  it('shows an empty pane with a prompt when nothing is selected', () => {
    runtime.orders = []
    renderInbox()
    expect(screen.getByText('Select a conversation')).toBeInTheDocument()
    expect(runtime.chat).toBeNull()
  })
})

describe('Inbox, below 768px', () => {
  beforeEach(() => { runtime.phone = true })

  it('shows only the list and selects nothing by itself', () => {
    renderInbox()
    expect(runtime.list.autoSelectFirst).toBe(false)
    expect(screen.getByTestId('conversation-list')).toBeInTheDocument()
    expect(runtime.chat).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('opens the conversation full screen on a tap and returns to the row it came from with Back', async () => {
    const user = userEvent.setup()
    renderInbox()
    await user.click(rowOf(2))
    const pane = screen.getByRole('region', { name: 'chat 2' })
    expect(pane).toHaveAttribute('data-engaged', 'true')
    const back = screen.getByRole('button', { name: 'Back' })
    expect(back).toBeInTheDocument()
    expect(pane.closest('[data-pane="conversation"]')).toContainElement(back)
    await user.click(back)
    expect(screen.queryByRole('region', { name: 'chat 2' })).not.toBeInTheDocument()
    await waitFor(() => expect(rowOf(2)).toHaveFocus())
  })

  it('keeps the list out of the tab order while the pane covers it', async () => {
    const user = userEvent.setup()
    renderInbox()
    await user.click(rowOf(1))
    expect(screen.getByTestId('conversation-list').closest('[inert]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByTestId('conversation-list').closest('[inert]')).toBeNull()
  })
})

// redesign messages R1 (Q-05): on a phone the system back closes the open conversation. Opening adds a history entry (react-router v5
// push) with `conversation=<orderId>` in the current query; closing (the browser back, a location without the key, or «Back») returns
// to the row. On desktop the query is not used.
describe('Inbox, below 768px: the system back (Q-05)', () => {
  beforeEach(() => { runtime.phone = true })
  const search = () => new URLSearchParams(runtime.router.location.search)
  const FROM = '/messages?id=9&page=3&pageSize=20'

  it('opens a conversation with a new history entry that adds conversation=<id> and keeps the rest of the query', async () => {
    const user = userEvent.setup()
    renderInbox({}, FROM)
    const before = runtime.router.history.length
    await user.click(rowOf(2))
    expect(runtime.router.history.length).toBe(before + 1)
    expect(runtime.router.history.action).toBe('PUSH')
    expect(runtime.router.location.pathname).toBe('/messages')
    expect(Object.fromEntries(search())).toEqual({ id: '9', page: '3', pageSize: '20', conversation: '2' })
    expect(screen.getByRole('region', { name: 'chat 2' })).toBeInTheDocument()
  })

  it('closes the pane on the system back and puts the focus on the row, as «Back» does', async () => {
    const user = userEvent.setup()
    renderInbox({}, FROM)
    await user.click(rowOf(2))
    act(() => runtime.router.history.goBack())
    expect(screen.queryByRole('region', { name: 'chat 2' })).not.toBeInTheDocument()
    expect(search().has('conversation')).toBe(false)
    expect(Object.fromEntries(search())).toEqual({ id: '9', page: '3', pageSize: '20' })
    await waitFor(() => expect(rowOf(2)).toHaveFocus())
  })

  it('closes the pane when the location loses the key (a replace, a link to the list)', async () => {
    const user = userEvent.setup()
    renderInbox({}, FROM)
    await user.click(rowOf(1))
    act(() => runtime.router.history.replace('/messages?id=9'))
    expect(screen.queryByRole('region', { name: 'chat 1' })).not.toBeInTheDocument()
    await waitFor(() => expect(rowOf(1)).toHaveFocus())
  })

  it('«Back» goes back in the history when the entry was ours: no entry is left behind', async () => {
    const user = userEvent.setup()
    renderInbox({}, FROM)
    await user.click(rowOf(2))
    expect(runtime.router.history.index).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(runtime.router.history.action).toBe('POP')
    expect(runtime.router.history.index).toBe(0)
    expect(search().has('conversation')).toBe(false)
    expect(screen.queryByRole('region', { name: 'chat 2' })).not.toBeInTheDocument()
    await waitFor(() => expect(rowOf(2)).toHaveFocus())
  })

  it('a reload with conversation=<id> opens that conversation once the list holds it', async () => {
    runtime.orders = []
    renderInbox({}, '/messages?conversation=2&page=3')
    expect(screen.queryByRole('region', { name: /chat/ })).not.toBeInTheDocument()
    act(() => runtime.list.onOrdersChange([makeOrder(1), makeOrder(2)]))
    const pane = screen.getByRole('region', { name: 'chat 2' })
    expect(pane).toHaveAttribute('data-engaged', 'true')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('a reload with an id the list does not hold opens nothing', () => {
    renderInbox({}, '/messages?conversation=77')
    expect(screen.queryByRole('region', { name: /chat/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('«Back» on a conversation that came from the URL closes it directly: it drops the key and keeps the rest', async () => {
    const user = userEvent.setup()
    renderInbox({}, '/messages?conversation=2&page=3')
    const before = runtime.router.history.length
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByRole('region', { name: 'chat 2' })).not.toBeInTheDocument()
    expect(runtime.router.history.length).toBe(before)
    expect(runtime.router.history.action).toBe('REPLACE')
    expect(Object.fromEntries(search())).toEqual({ page: '3' })
    await waitFor(() => expect(rowOf(2)).toHaveFocus())
  })

  it('does not reopen a conversation that was closed', async () => {
    const user = userEvent.setup()
    renderInbox({}, '/messages?conversation=2')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    act(() => runtime.list.onOrdersChange([makeOrder(1), makeOrder(2, { status: 3 })]))
    expect(screen.queryByRole('region', { name: /chat/ })).not.toBeInTheDocument()
  })
})

describe('Inbox, 768px and up: the query is not used (Q-05)', () => {
  it('opening a conversation adds no history entry and no key', async () => {
    const user = userEvent.setup()
    renderInbox({}, '/messages?page=3')
    const before = runtime.router.history.length
    await user.click(rowOf(2))
    expect(runtime.router.history.length).toBe(before)
    expect(runtime.router.location.search).toBe('?page=3')
    expect(screen.getByRole('region', { name: 'chat 2' })).toBeInTheDocument()
  })

  it('a conversation key in the URL selects nothing', () => {
    renderInbox({}, '/messages?conversation=2')
    expect(screen.getByRole('region', { name: 'chat 1' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'chat 2' })).not.toBeInTheDocument()
  })
})

describe('ConversationHeader', () => {
  it('shows the customer, number, status, business, driver, delivery and total, and opens the order', async () => {
    const user = userEvent.setup()
    const onOpenOrder = vi.fn()
    const order = makeOrder(15, { driver: { name: 'Dana', lastname: 'Diaz' }, currency: 'USD' })
    render(<ConversationHeader order={order} onOpenOrder={onOpenOrder} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Ada Lovelace 15')
    expect(screen.getByText('15')).toHaveClass('odc-figure')
    expect(screen.getByText('Accepted by business')).toBeInTheDocument()
    expect(screen.getByText('Business')).toBeInTheDocument()
    expect(screen.getByText('Store 15')).toBeInTheDocument()
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText('Dana Diaz')).toBeInTheDocument()
    expect(screen.getByText('Delivery')).toBeInTheDocument()
    expect(screen.getByText('1 Main St')).toBeInTheDocument()
    expect(screen.getByText('$25')).toHaveClass('odc-figure')
    await user.click(screen.getByRole('button', { name: 'View order' }))
    expect(onOpenOrder).toHaveBeenCalledWith(order)
    expect(screen.queryByRole('button', { name: /call/i })).not.toBeInTheDocument()
  })

  it('says «Not assigned» without a driver, drops the address for a pickup and falls back to «Customer»', () => {
    render(<ConversationHeader order={makeOrder(3, { delivery_type: 2, customer: { name: '', lastname: '' } })} onOpenOrder={() => {}} />)
    expect(screen.getByText('Not assigned')).toBeInTheDocument()
    expect(screen.getByText('Pickup')).toBeInTheDocument()
    expect(screen.queryByText('1 Main St')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Customer')
  })

  it('reads a reservation in preorder as «Reservation», as the order cards do', () => {
    render(<ConversationHeader order={makeOrder(4, { delivery_type: 9, status: 13 })} onOpenOrder={() => {}} />)
    expect(within(document.querySelector('.odc-badge')).getByText('Reservation')).toBeInTheDocument()
  })

  it('uses the external id when the order has one and the project asks for it', () => {
    runtime.configs = { change_order_id: { value: '1' } }
    render(<ConversationHeader order={makeOrder(5, { external_id: 'EXT-5' })} onOpenOrder={() => {}} />)
    expect(screen.getByText('EXT-5')).toHaveClass('odc-figure')
  })

  it('leaves the total out when the order carries none', () => {
    render(<ConversationHeader order={makeOrder(6, { summary: undefined })} onOpenOrder={() => {}} />)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  // redesign messages R1 (P-03): the data of main's card that no other place shows
  it('shows the external driver when there is no driver, and the driver company after the name', () => {
    render(<ConversationHeader order={makeOrder(8, { driver: null, external_driver: { name: 'Eddie Ext' }, driver_company: { name: 'Fast Fleet' } })} onOpenOrder={() => {}} />)
    const fact = screen.getByText('Driver').closest('li')
    expect(within(fact).getByText('Eddie Ext')).toBeInTheDocument()
    expect(within(fact).getByText('Fast Fleet')).toBeInTheDocument()
    expect(fact.textContent).toBe('DriverEddie ExtFast Fleet')
  })

  it('shows the company of an own driver too, and nothing extra when there is none', () => {
    const { unmount } = render(<ConversationHeader order={makeOrder(9, { driver: { name: 'Dana', lastname: 'Diaz' }, driver_company: { name: 'Fast Fleet' } })} onOpenOrder={() => {}} />)
    expect(within(screen.getByText('Driver').closest('li')).getByText('Fast Fleet')).toBeInTheDocument()
    unmount()
    render(<ConversationHeader order={makeOrder(10, { driver: { name: 'Dana', lastname: 'Diaz' } })} onOpenOrder={() => {}} />)
    expect(screen.getByText('Driver').closest('li').textContent).toBe('DriverDana Diaz')
  })

  it('shows the pod code with the «Pod» label when the order has one, and no pod otherwise', () => {
    const { unmount } = render(<ConversationHeader order={makeOrder(11, { codigoPod: 'POD-123' })} onOpenOrder={() => {}} />)
    const fact = screen.getByText('Pod').closest('li')
    expect(within(fact).getByText('POD-123')).toHaveClass('odc-figure')
    unmount()
    render(<ConversationHeader order={makeOrder(12)} onOpenOrder={() => {}} />)
    expect(screen.queryByText('Pod')).not.toBeInTheDocument()
  })
})

describe('useConversationDrafts', () => {
  it('stores and returns a draft by order id', () => {
    const { result } = renderHook(() => useConversationDrafts())
    expect(result.current.get(7)).toBeNull()
    result.current.set(7, { text: 'hi', image: null })
    expect(result.current.get(7)).toEqual({ text: 'hi', image: null, recipients: null })
  })

  // redesign messages R1 (Q-01): { text, image, recipients }; recipients are the chat's canRead or null
  it('keeps a draft that has only recipients, and hands them back', () => {
    const { result } = renderHook(() => useConversationDrafts())
    result.current.set(7, { text: '', image: null, recipients: STORE_ONLY })
    expect(result.current.get(7)).toEqual({ text: '', image: null, recipients: STORE_ONLY })
  })

  it('deletes the entry only when text, image and recipients are all empty or null', () => {
    const { result } = renderHook(() => useConversationDrafts())
    result.current.set(7, { text: 'hi', image: null, recipients: STORE_ONLY })
    result.current.set(7, { text: '', image: null, recipients: STORE_ONLY })
    expect(result.current.get(7)).not.toBeNull()
    result.current.set(7, { text: '', image: null, recipients: null })
    expect(result.current.get(7)).toBeNull()
    result.current.set(8, { text: '', image: null })
    expect(result.current.get(8)).toBeNull()
    result.current.set(8, null)
    expect(result.current.get(8)).toBeNull()
  })

  it('deletes the entry when the text is empty and there is no image', () => {
    const { result } = renderHook(() => useConversationDrafts())
    result.current.set(7, { text: 'hi', image: null })
    result.current.set(7, { text: '', image: null })
    expect(result.current.get(7)).toBeNull()
  })

  it('keeps a draft that has only an image', () => {
    const { result } = renderHook(() => useConversationDrafts())
    const image = { name: 'photo.png' }
    result.current.set(7, { text: '', image })
    expect(result.current.get(7)).toEqual({ text: '', image, recipients: null })
  })

  it('has a stable identity across renders and stays in memory only', () => {
    const { result, rerender } = renderHook(() => useConversationDrafts())
    const first = result.current
    const { set } = first
    rerender()
    expect(result.current).toBe(first)
    expect(result.current.set).toBe(set)
    set(9, { text: 'x', image: null }) // `set` works detached, as it is passed to onDraftChange
    expect(result.current.get(9)).toEqual({ text: 'x', image: null, recipients: null })
    const code = readFileSync(resolve(__dirname, '..', 'useConversationDrafts.js'), 'utf8').split('\n').filter(line => !line.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB/)
  })

  it('does not share drafts between mounts', () => {
    const a = renderHook(() => useConversationDrafts())
    a.result.current.set(1, { text: 'a', image: null })
    const b = renderHook(() => useConversationDrafts())
    expect(b.result.current.get(1)).toBeNull()
  })
})
