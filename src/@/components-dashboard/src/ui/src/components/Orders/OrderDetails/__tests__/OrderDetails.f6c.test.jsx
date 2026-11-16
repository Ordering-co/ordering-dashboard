/* eslint-disable import/first */
// redesign F6c (Q2-02): closing the order panel (Escape, the Close button) asks first when a field of the panel holds
// text that was not saved (Edit customer, a custom field Key, the chat composer). Q2-19: the unread count of the Chat
// tab is said in the singular for one message. The tab contents are mocked with a field each: this file only looks at
// the way out and at the frame.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { SplitView } from '../../../Shared/Product'

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
  DetailsTab: (props) => { runtime.tabProps.details = props; return <div data-testid='tab-details'><input aria-label='Notes' defaultValue='Gate 4' /><button type='button'>Plain action</button></div> }
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

const order = { id: 42, status: 7, delivery_type: 1, customer_id: 5, products: [], summary: { total: 0 }, customer: { id: 5, name: 'Ada' }, business: { name: 'Fast Bite' } }

const renderPanelSync = (orderOverrides = {}) => {
  const onClose = vi.fn()
  const view = renderWithProviders(
    <SplitView
      open
      onClose={onClose}
      panelLabel='Order 42'
      resizeLabel='Resize'
      list={<div>list</div>}
      panel={(
        <OrderDetails
          open
          layout='split'
          order={{ loading: false, order: { ...order, ...orderOverrides } }}
          messages={{ messages: [] }}
          setIsTourFlag={vi.fn()}
          handleCloneOrder={vi.fn()}
          setCloneState={vi.fn()}
          cloneState={{ type: 1, loading: false }}
          setCurrentTourStep={vi.fn()}
          setIsTourOpen={vi.fn()}
          onClose={onClose}
          handleBackRedirect={onClose}
        />
      )}
    />,
    { initialEntries: ['/orders?id=42'] }
  )
  return { ...view, onClose }
}

// redesign N-05: the panel is a lazy chunk; it is on screen once the skeleton (aria-busy) is gone.
const panelLoaded = () => waitFor(() => expect(document.querySelector('#orderDetails:not([aria-busy])')).not.toBeNull())
const renderPanel = async (orderOverrides = {}) => {
  const view = renderPanelSync(orderOverrides)
  await panelLoaded()
  return view
}

describe('Order panel: asking before it drops unsaved text', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    runtime.tabProps = {}
    window.innerWidth = 1400
  })

  it('closes at once with Escape when nothing was typed', async () => {
    const user = userEvent.setup()
    const { onClose } = await renderPanel()
    await user.click(screen.getByRole('button', { name: 'Plain action' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close from the field, and asks on the next Escape when text was typed', async () => {
    const user = userEvent.setup()
    const { onClose } = await renderPanel()
    await user.type(screen.getByLabelText('Notes'), ' side door')
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await user.keyboard('{Escape}')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(onClose).not.toHaveBeenCalled()
    expect(within(dialog).getByText('What you typed in this order is not saved yet.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Notes')).toHaveValue('Gate 4 side door')
  })

  // redesign F6d (Q3-09): «Keep editing» gives the focus back to the field the first Escape took it from, not to a
  // button of the panel
  it('returns the focus to the field that had it before the first Escape when the user keeps editing', async () => {
    const user = userEvent.setup()
    await renderPanel()
    await user.type(screen.getByLabelText('Notes'), ' side door')
    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveFocus())
  })

  it('keeps editing from the Escape key of the dialog returns the focus to the field too', async () => {
    const user = userEvent.setup()
    await renderPanel()
    await user.type(screen.getByLabelText('Notes'), '!')
    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')
    await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveFocus())
  })

  it('closes the panel when the change is discarded', async () => {
    const user = userEvent.setup()
    const { onClose } = await renderPanel()
    await user.type(screen.getByLabelText('Notes'), '!')
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not ask when what was typed was undone', async () => {
    const user = userEvent.setup()
    const { onClose } = await renderPanel()
    await user.type(screen.getByLabelText('Notes'), 'x')
    await user.type(screen.getByLabelText('Notes'), '{Backspace}')
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not ask for a field that left the panel (the form was saved or cancelled)', async () => {
    const user = userEvent.setup()
    const { onClose } = await renderPanel()
    const notes = screen.getByLabelText('Notes')
    await user.type(notes, 'x')
    notes.remove()
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Order panel: the unread count of the Chat tab', () => {
  beforeEach(() => {
    runtime.user = { id: 1, level: 0 }
    window.innerWidth = 1400
  })

  it('says «1 unread message» for one, «3 unread messages» for more', async () => {
    const { unmount } = await renderPanel({ unread_count: 1 })
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveTextContent('1 unread message')
    expect(screen.getByRole('tab', { name: /Chat/ })).not.toHaveTextContent('1 unread messages')
    unmount()
    await renderPanel({ unread_count: 3 })
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveTextContent('3 unread messages')
  })
})
