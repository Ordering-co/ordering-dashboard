/* eslint-disable import/first */
// redesign 5.3: the header is rebuilt on the Product wrappers (Menu, IconButton, StatusBadge,
// Dialog). The D1 delete-confirmation LOGIC is unchanged and asserted exactly as before
// (ConfirmAdmin first, delete once with (null, [id]), the panel closes only on confirm, a
// dismissed dialog deletes nothing). Only how the controls are found changed: «Delete» was a
// react-bootstrap dropdown item, it is now the «Delete order…» menuitem of «More actions»;
// «Print» opened a hand-made disclosure, it is now a Menu; «Order History» and «Chat» left
// the header (they are tabs of the panel now).
// redesign fix-qa E5: the tracking link is two direct items of «More actions» again (as in `main`), not
// one item that opens a dialog with the legacy dropdown inside; Delete order… hands ConfirmAdmin a title
// and a description. Those assertions changed with the markup; the delete LOGIC assertions did not.
import React from 'react'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const runtime = vi.hoisted(() => ({ user: { level: 0 }, configs: {}, printNormal: null, printTicket: null, printOptions: [], tracking: null }))

runtime.printNormal = vi.fn()
runtime.printTicket = vi.fn()

vi.mock('../../../../../../index', () => ({
  useConfig: () => [{ configs: runtime.configs }],
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  useSession: () => [{ user: runtime.user }],
  useUtils: () => [{ parsePrice: value => `$${value}`, parseDate: value => `date(${value})` }]
}))
vi.mock('react-to-print', () => ({
  useReactToPrint: (options) => {
    runtime.printOptions.push(options)
    return options.content()?.kind === 'ticket' ? runtime.printTicket : runtime.printNormal
  }
}))
vi.mock('../../../Shared', () => ({
  ConfirmAdmin: ({ open, onClose, onConfirm, title, description, confirmLabel }) => open
    ? (
      <div role='dialog' aria-label='Confirm admin' data-title={title} data-description={description} data-confirm-label={confirmLabel}>
        <button type='button' onClick={() => onConfirm()}>mock-confirm</button>
        <button type='button' onClick={() => onConfirm('482915')}>mock-confirm-otp</button>
        <button type='button' onClick={onClose}>mock-close</button>
      </div>
      )
    : null
}))
// The hook of the tracking link is stubbed with its contract: two menu items and the domain dialog node.
vi.mock('../../OrderTrackingLink', () => ({
  useOrderTrackingLink: (order) => {
    runtime.tracking.order = order
    return {
      menuItems: [
        { key: 'tracking-open', label: 'Open tracking url', disabled: runtime.tracking.disabled, description: runtime.tracking.disabled ? 'This order has no tracking link yet' : undefined, onSelect: runtime.tracking.open },
        { key: 'tracking-edit', label: 'Edit tracking url…', disabled: runtime.tracking.disabled, description: runtime.tracking.disabled ? 'This order has no tracking link yet' : undefined, onSelect: runtime.tracking.edit }
      ],
      dialog: <div data-testid='tracking-dialog' />
    }
  }
}))

import { SplitView, useSplitView } from '../../../Shared/Product'
import { OrderDetailsHeader } from '..'

// jsdom answers matchMedia with `matches: false`. The split view reads the window through
// (min|max)-width queries, so the tests install one that evaluates them against a width.
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

const printRef = { current: { kind: 'normal' } }
const printTicketRef = { current: { kind: 'ticket' } }

const baseOrder = {
  id: 42,
  customer_id: 7,
  status: 0,
  delivery_type: 1,
  created_at: '2026-10-06 08:26',
  payment_events: []
}

const headerProps = (overrides = {}) => ({
  order: baseOrder,
  handleShowOption: vi.fn(),
  handleDeleteOrder: vi.fn(),
  actionSidebar: vi.fn(),
  setIsTourOpen: vi.fn(),
  isTourOpen: false,
  currentTourStep: 0,
  printRef,
  printTicketRef,
  isExpand: false,
  setIsExpand: vi.fn(),
  ...overrides
})

const renderHeader = (overrides = {}) => {
  const props = headerProps(overrides)
  renderWithProviders(<OrderDetailsHeader {...props} />)
  return props
}

const openMore = async (user) => {
  await user.click(screen.getByRole('button', { name: 'More actions' }))
  return screen.findByRole('menu')
}

beforeEach(() => {
  runtime.user = { level: 0 }
  runtime.configs = {}
  runtime.printNormal.mockClear()
  runtime.printTicket.mockClear()
  runtime.printOptions = []
  runtime.tracking = { disabled: false, open: vi.fn(), edit: vi.fn() }
})

describe('OrderDetailsHeader · identity and metadata line', () => {
  it('names the order with the id in a mono heading and shows the exact status in a badge', () => {
    renderHeader()
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('#42')
    expect(heading.querySelector('.odc-mono')).not.toBeNull()
    const badge = screen.getByText('Pending').closest('.odc-badge')
    expect(badge).toHaveAttribute('data-family', 'pending')
  })

  it('keeps the appointment wording for service orders and hides the delivery type', () => {
    renderHeader({ isServiceOrder: true })
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Appointment No. 42')
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument()
  })

  it('lists created time, delivery type, channel and external id (only with the config on)', () => {
    runtime.configs = { change_order_id: { value: '1' } }
    renderHeader({ order: { ...baseOrder, app_id: 'ordering-web', external_id: 'EXT-9' } })
    const meta = screen.getByTestId('order-meta')
    expect(meta).toHaveTextContent('Created at date(2026-10-06 08:26)')
    expect(meta).toHaveTextContent('Delivery')
    expect(meta).toHaveTextContent('ordering-web')
    expect(meta).toHaveTextContent('External ID')
    expect(within(meta).getByText('EXT-9')).toBeInTheDocument()
  })

  it('does not show the external id unless change_order_id is on', () => {
    renderHeader({ order: { ...baseOrder, external_id: 'EXT-9' } })
    expect(screen.getByTestId('order-meta')).not.toHaveTextContent('EXT-9')
  })

  it('cash on delivery reads as the method plus a separate Not prepaid badge and the amount', () => {
    renderHeader({
      order: {
        ...baseOrder,
        cash: 50,
        currency: 'USD',
        payment_events: [{ event: 'payment', paymethod: { gateway: 'cash', name: 'Cash' } }]
      }
    })
    const meta = screen.getByTestId('order-meta')
    expect(meta).toHaveTextContent('Cash')
    expect(meta).toHaveTextContent('Pay with')
    const badge = within(meta).getByText('Not prepaid').closest('.odc-badge')
    expect(badge).not.toBeNull()
    expect(meta).not.toHaveTextContent('NOT_PREPAID:')
  })

  it('keeps the Stripe dashboard link and the refund state in the line', () => {
    renderHeader({
      order: {
        ...baseOrder,
        refund_data: 'refunded',
        payment_events: [{ event: 'payment', paymethod: { gateway: 'stripe', name: 'Stripe' }, data: { gateway: 'stripe', result: { pay_data: 'pi_123' } } }]
      }
    })
    const link = screen.getByRole('link', { name: 'pi_123' })
    expect(link).toHaveAttribute('href', 'https://dashboard.stripe.com/payments/pi_123')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByTestId('order-meta')).toHaveTextContent('Refunded')
  })

  it('without payment events it falls back to the order paymethod', () => {
    renderHeader({ order: { ...baseOrder, paymethod: { gateway: 'card_delivery', name: 'Card on delivery' } } })
    const meta = screen.getByTestId('order-meta')
    expect(meta).toHaveTextContent('Card on delivery')
    expect(within(meta).getByText('Not prepaid')).toBeInTheDocument()
  })
})

describe('OrderDetailsHeader · print menu', () => {
  it('opens a menu with Normal and Ticket; each one prints its own content and the menu closes', async () => {
    const user = userEvent.setup()
    renderHeader()
    const print = screen.getByRole('button', { name: 'Print' })
    expect(print).toHaveAttribute('aria-haspopup', 'menu')
    await user.click(print)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Normal', 'Ticket'])

    await user.click(within(menu).getByRole('menuitem', { name: 'Normal' }))
    expect(runtime.printNormal).toHaveBeenCalledTimes(1)
    expect(runtime.printTicket).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(print).toHaveAttribute('aria-expanded', 'false')

    await user.click(print)
    await user.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Ticket' }))
    expect(runtime.printTicket).toHaveBeenCalledTimes(1)
  })

  it('reads the print content lazily from the refs and removes the frame after printing', () => {
    renderHeader()
    const [normal, ticket] = runtime.printOptions
    expect(normal.removeAfterPrint).toBe(true)
    expect(ticket.removeAfterPrint).toBe(true)
    expect([normal.content(), ticket.content()]).toEqual([printRef.current, printTicketRef.current])
  })

  // redesign fix-qa E8: react-to-print leaves the focus on <body> (its hidden iframe is removed after printing).
  it('gives the focus back to the Print trigger when printing is done, for both prints', () => {
    renderHeader()
    const print = screen.getByRole('button', { name: 'Print' })
    for (const options of runtime.printOptions.slice(0, 2)) {
      print.blur()
      expect(print).not.toHaveFocus()
      options.onAfterPrint()
      expect(print).toHaveFocus()
    }
  })
})

describe('OrderDetailsHeader · more actions menu', () => {
  it('lists clone, custom fields, the two tracking items and, after a separator, Delete order…', async () => {
    const user = userEvent.setup()
    renderHeader({ order: { ...baseOrder, uuid: 'u', hash_key: 'h' } })
    const menu = await openMore(user)
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Clone order…',
      'Custom fields',
      'Open tracking url',
      'Edit tracking url…',
      'Delete order…'
    ])
    expect(within(menu).getAllByRole('separator')).toHaveLength(1)
  })

  it('opens the clone dialog of the panel and the custom fields tab through handleShowOption', async () => {
    const user = userEvent.setup()
    const props = renderHeader()
    await user.click(within(await openMore(user)).getByRole('menuitem', { name: 'Clone order…' }))
    expect(props.handleShowOption).toHaveBeenLastCalledWith('clone_order')

    await user.click(within(await openMore(user)).getByRole('menuitem', { name: 'Custom fields' }))
    expect(props.handleShowOption).toHaveBeenLastCalledWith('metafields')
  })

  it.each([
    ['an order that is already a clone', { cloned_order_id: 9 }, { level: 0 }],
    ['an order without customer', { customer_id: null }, { level: 0 }],
    ['a user that is not admin', {}, { level: 2 }]
  ])('does not offer Clone order… for %s', async (_, orderOverrides, user) => {
    runtime.user = user
    const player = userEvent.setup()
    renderHeader({ order: { ...baseOrder, ...orderOverrides } })
    const menu = await openMore(player)
    expect(within(menu).queryByRole('menuitem', { name: 'Clone order…' })).not.toBeInTheDocument()
  })

  it('has no Delete order… when the neighbour did not pass handleDeleteOrder', async () => {
    const user = userEvent.setup()
    renderHeader({ handleDeleteOrder: undefined })
    const menu = await openMore(user)
    expect(within(menu).queryByRole('menuitem', { name: /Delete order/ })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('separator')).not.toBeInTheDocument()
  })

  it('the tracking items are disabled with their reason while the order has no tracking link', async () => {
    runtime.tracking.disabled = true
    const user = userEvent.setup()
    renderHeader()
    const menu = await openMore(user)
    for (const name of ['Open tracking url', 'Edit tracking url…']) {
      const item = within(menu).getByRole('menuitem', { name })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).toHaveAccessibleDescription('This order has no tracking link yet')
    }
  })

  it('each tracking item runs its own action and there is no intermediate tracking dialog', async () => {
    const user = userEvent.setup()
    const order = { ...baseOrder, uuid: 'u', hash_key: 'h' }
    renderHeader({ order })
    expect(runtime.tracking.order).toBe(order)
    await user.click(within(await openMore(user)).getByRole('menuitem', { name: 'Open tracking url' }))
    expect(runtime.tracking.open).toHaveBeenCalledTimes(1)
    expect(runtime.tracking.edit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Tracking link' })).not.toBeInTheDocument()
    await user.click(within(await openMore(user)).getByRole('menuitem', { name: 'Edit tracking url…' }))
    expect(runtime.tracking.edit).toHaveBeenCalledTimes(1)
    expect(screen.getAllByTestId('tracking-dialog')).toHaveLength(1)
  })
})

describe('OrderDetailsHeader · expand and close', () => {
  it('Open as page toggles the expanded flag and flips its name', async () => {
    const user = userEvent.setup()
    const props = renderHeader()
    const expand = screen.getByRole('button', { name: 'Open as page' })
    await user.click(expand)
    expect(props.setIsExpand).toHaveBeenCalledTimes(1)
    expect(props.setIsExpand.mock.calls[0][0](false)).toBe(true)
  })

  // redesign fix-qa E8: the name says where the button goes («Click to expand» / «Collapse» said neither);
  // the name carries the state, so it is a plain button, not an aria-pressed toggle.
  it('reads Back to split view while expanded', () => {
    renderHeader({ isExpand: true })
    const back = screen.getByRole('button', { name: 'Back to split view' })
    expect(back).not.toHaveAttribute('aria-pressed')
    expect(screen.queryByRole('button', { name: 'Open as page' })).not.toBeInTheDocument()
  })

  it('Close closes the panel and, on tour step 1, ends the tour', async () => {
    const user = userEvent.setup()
    const props = renderHeader({ isTourOpen: true, currentTourStep: 1 })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.actionSidebar).toHaveBeenCalledWith(false)
    expect(props.setIsTourOpen).toHaveBeenCalledWith(false)
  })

  it('no longer carries the Chat and Order History buttons: they are tabs of the panel', () => {
    renderHeader()
    expect(screen.queryByRole('button', { name: 'Chat' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Order History' })).not.toBeInTheDocument()
  })

  // Owner decision 22 B (2026-10-21, RV-3): from the overlay, «Open as page» moves the panel and drops the typing, so it asks the panel's
  // guard first (the chat draft, OrderDetailsPanel); inline it toggles at once, as before
  it('in the overlay, Open as page goes through the panel guard first (owner decision 22)', async () => {
    const restoreViewport = installViewport(1100)
    try {
      const user = userEvent.setup()
      const props = headerProps()
      let proceed = null
      const Guard = () => {
        const { registerCloseGuard } = useSplitView()
        React.useEffect(() => registerCloseGuard(next => { proceed = next; return true }), [registerCloseGuard])
        return null
      }
      renderWithProviders(
        <SplitView
          open
          list={<div>list</div>}
          panel={<><Guard /><OrderDetailsHeader {...props} /></>}
          panelLabel='Order 42'
          resizeLabel='Resize'
        />
      )
      await user.click(await screen.findByRole('button', { name: 'Open as page' }))
      expect(props.setIsExpand).not.toHaveBeenCalled()
      expect(typeof proceed).toBe('function')
      proceed()
      expect(props.setIsExpand).toHaveBeenCalledTimes(1)
    } finally {
      restoreViewport()
    }
  })

  it('on a phone (split view in full mode) it shows Back to orders instead of Close and Open as page', async () => {
    const restoreViewport = installViewport(500)
    try {
      const user = userEvent.setup()
      const props = headerProps()
      renderWithProviders(
        <SplitView
          open
          list={<div>list</div>}
          panel={<OrderDetailsHeader {...props} />}
          panelLabel='Order 42'
          resizeLabel='Resize'
        />
      )
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open as page' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Back to orders' }))
      expect(props.actionSidebar).toHaveBeenCalledWith(false)
    } finally {
      restoreViewport()
    }
  })

  it('outside a phone there is no Back button', () => {
    renderHeader()
    expect(screen.queryByRole('button', { name: 'Back to orders' })).not.toBeInTheDocument()
  })

  it('while the tour is on step 1 the actions it does not teach are disabled', () => {
    renderHeader({ isTourOpen: true, currentTourStep: 1 })
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDisabled()
  })
})

describe('OrderDetailsHeader delete confirmation', () => {
  const renderWithHandlers = () => {
    const handlers = { handleDeleteOrder: vi.fn(), actionSidebar: vi.fn() }
    renderWithProviders(
      <OrderDetailsHeader
        {...headerProps({ handleDeleteOrder: handlers.handleDeleteOrder, actionSidebar: handlers.actionSidebar })}
      />
    )
    return handlers
  }

  const openDelete = async (user) => {
    await user.click(within(await openMore(user)).getByRole('menuitem', { name: 'Delete order…' }))
  }

  it('opens ConfirmAdmin on Delete without deleting or closing the panel', async () => {
    const user = userEvent.setup()
    const { handleDeleteOrder, actionSidebar } = renderWithHandlers()
    expect(screen.queryByRole('dialog', { name: 'Confirm admin' })).not.toBeInTheDocument()

    await openDelete(user)

    expect(await screen.findByRole('dialog', { name: 'Confirm admin' })).toBeInTheDocument()
    expect(handleDeleteOrder).not.toHaveBeenCalled()
    expect(actionSidebar).not.toHaveBeenCalled()
  })

  it('tells what is deleted: «Delete order #42?» and that it cannot be undone', async () => {
    const user = userEvent.setup()
    renderWithHandlers()
    await openDelete(user)
    const dialog = await screen.findByRole('dialog', { name: 'Confirm admin' })
    expect(dialog).toHaveAttribute('data-title', 'Delete order #42?')
    expect(dialog).toHaveAttribute('data-description', 'Type your password to confirm. This can’t be undone.')
  })

  // redesign F6d (Q3-13, C8): the confirm button says the verb with the object, not a generic «Confirm».
  it('asks ConfirmAdmin for a «Delete order» button instead of the generic Confirm', async () => {
    const user = userEvent.setup()
    renderWithHandlers()
    await openDelete(user)
    expect(await screen.findByRole('dialog', { name: 'Confirm admin' })).toHaveAttribute('data-confirm-label', 'Delete order')
  })

  it('deletes the order once, closes the dialog and the panel only on confirm', async () => {
    const user = userEvent.setup()
    const { handleDeleteOrder, actionSidebar } = renderWithHandlers()
    await openDelete(user)
    await user.click(await screen.findByRole('button', { name: 'mock-confirm' }))

    expect(handleDeleteOrder).toHaveBeenCalledTimes(1)
    expect(handleDeleteOrder).toHaveBeenCalledWith(null, [42])
    expect(actionSidebar).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('dialog', { name: 'Confirm admin' })).not.toBeInTheDocument()
  })

  // redesign W0-12 (T0-48): with an OTP the code travels to the DELETE (deleted_action_code); with the
  // password it stays null, as in the test above.
  it('with an OTP, deletes the order passing the code', async () => {
    const user = userEvent.setup()
    const { handleDeleteOrder, actionSidebar } = renderWithHandlers()
    await openDelete(user)
    await user.click(await screen.findByRole('button', { name: 'mock-confirm-otp' }))

    expect(handleDeleteOrder).toHaveBeenCalledTimes(1)
    expect(handleDeleteOrder).toHaveBeenCalledWith('482915', [42])
    expect(actionSidebar).toHaveBeenCalledWith(false)
  })

  it('does not delete when the dialog is closed', async () => {
    const user = userEvent.setup()
    const { handleDeleteOrder, actionSidebar } = renderWithHandlers()
    await openDelete(user)
    await user.click(await screen.findByRole('button', { name: 'mock-close' }))

    expect(handleDeleteOrder).not.toHaveBeenCalled()
    expect(actionSidebar).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Confirm admin' })).not.toBeInTheDocument()
  })
})
