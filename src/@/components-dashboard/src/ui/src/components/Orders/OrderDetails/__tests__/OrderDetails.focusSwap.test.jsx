/* eslint-disable import/first */
// redesign bugs H (W1-QC2-01): where the focus is when the lazy skeleton Sheet gives way to the panel's Sheet (overlay layout).
// Same mocks as OrderDetails.skeleton.test.jsx: the tab contents are not under test.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// The chunk of the panel arrives when the test says so, so the skeleton phase can be looked at.
const chunk = vi.hoisted(() => {
  const gate = { open: () => {}, promise: null }
  gate.promise = new Promise(resolve => { gate.open = resolve })
  return gate
})
vi.mock('~/utils/chunkReload', () => ({
  lazyWithReload: (load) => chunk.promise.then(load)
}))

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

const handlers = () => ({ onClose: vi.fn(), handleBackRedirect: vi.fn(), setCurrentTourStep: vi.fn(), setIsTourOpen: vi.fn() })
const baseProps = () => ({
  open: true,
  layout: 'overlay',
  messages: { messages: [] },
  setIsTourFlag: vi.fn(),
  handleCloneOrder: vi.fn(),
  setCloneState: vi.fn(),
  cloneState: { type: 1, loading: false },
  ...handlers()
})
const order = { id: 42, customer_id: 7, products: [], delivery_type: 1, status: 0, unread_count: 0 }

// redesign bugs H (W1-QC2-01): opening an appointment (order detail in an overlay Sheet) by keyboard leaves the focus on <body> once
// the lazy panel replaces the skeleton: the skeleton Sheet and the real panel's Sheet are different nodes, and the node that had the focus
// is gone. The focus must be inside the dialog before and after the swap.
describe('OrderDetails overlay: the focus survives the swap of the skeleton Sheet for the panel Sheet (W1-QC2-01)', () => {
  it('has the focus inside the dialog while the panel loads, and on the title of the panel once it has loaded', async () => {
    renderWithProviders(<OrderDetails {...baseProps()} order={{ loading: false, order }} />, { initialEntries: ['/appointments'] })
    // the skeleton Sheet of the lazy boundary: the focus is already inside it
    const skeletonDialog = await screen.findByRole('dialog')
    await waitFor(() => expect(skeletonDialog.contains(document.activeElement)).toBe(true))
    expect(document.body).not.toHaveFocus()
    // the chunk arrives: the skeleton leaves and the panel's Sheet takes its place
    await act(async () => { chunk.open() })
    await waitFor(() => expect(skeletonDialog.isConnected).toBe(false))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Order 42')
    const title = within(dialog).getByRole('heading', { name: 'Order 42' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(document.body).not.toHaveFocus()
    expect(document.activeElement).toBe(title)
    expect(title).toHaveAttribute('tabindex', '-1')
  })

  it('keeps the way out reachable: the next Tab goes to «Close» of the panel', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrderDetails {...baseProps()} order={{ loading: false, order }} />, { initialEntries: ['/appointments'] })
    await act(async () => { chunk.open() })
    const dialog = await screen.findByRole('dialog')
    const title = within(dialog).getByRole('heading', { name: 'Order 42' })
    await waitFor(() => expect(document.activeElement).toBe(title))
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toHaveAccessibleName('Close')
  })
})
